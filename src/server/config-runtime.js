// Bounded server runtime extracted from server.js.
export function createConfigRuntime(deps = {}) {
  const {
    ROOT,
    DATA_ROOT_OVERRIDE,
    join,
    userDataPath,
    readJson,
    writeJson,
    chmod,
    buildOpenAICompatibleChatBody,
    llmHttpError,
    errorPayload
  } = deps;

  function dataRoot() {
    return DATA_ROOT_OVERRIDE || join(ROOT, "data");
  }
  
  function configPath() {
    return userDataPath("config.json");
  }
  
  function secretsPath() {
    return userDataPath("secrets.json");
  }
  
  const DEFAULT_CONFIG = {
    llmBaseUrl: "https://api.deepseek.com/v1",
    llmModel: "deepseek-v4-flash",
    llmProvider: "deepseek",
    llmThinking: "auto",
    llmTimeoutMs: 60000,
    pipelineProfileId: "balanced",
    connectionProfileId: "deepseek",
    lastModuleKey: "",
    moduleHistory: [],
    theme: "dark",
    language: "zh-CN",
    firstRun: true
  };
  
  // ═══════════════════════════════════════════════════════════════
  //  配置管理
  // ═══════════════════════════════════════════════════════════════
  
  async function loadConfig() {
    return { ...DEFAULT_CONFIG, ...readJson(configPath(), {}) };
  }
  
  async function saveConfig(update) {
    const current = await loadConfig();
    const next = { ...current, ...update };
    delete next.llmApiKey;
    await writeJson(configPath(), next);
    return next;
  }
  
  function maskSecret(value) {
    if (!value) return "";
    if (value.length <= 4) return "****";
    // 短密钥仅保留最后1位
    if (value.length <= 8) return `${"*".repeat(value.length - 1)}${value.slice(-1)}`;
    return `${"*".repeat(6)}${value.slice(-4)}`;
  }
  
  async function loadSecrets() {
    const s = readJson(secretsPath(), {});
    const llm = s.llm || {};
    return { llm: { active: llm.active || "default", items: Array.isArray(llm.items) ? llm.items : [] } };
  }
  
  async function saveSecrets(secrets) {
    await writeJson(secretsPath(), secrets);
    if (process.platform !== "win32") {
      try {
        await chmod(secretsPath(), 0o600);
      } catch (err) {
        console.warn("[secrets] chmod 0600 failed:", err?.message || "unknown error");
      }
    }
    return getSecretState();
  }
  
  async function getSecretState() {
    const secrets = await loadSecrets();
    const active = secrets.llm.items.find(i => i.id === secrets.llm.active) || secrets.llm.items[0] || null;
    return {
      llm: {
        active: active?.id || "",
        items: secrets.llm.items.map(i => ({ id: i.id, label: i.label || i.id, masked: maskSecret(i.value || ""), active: i.id === (active?.id || "") }))
      }
    };
  }
  
  async function getActiveLlmValue() {
    const secrets = await loadSecrets();
    const active = secrets.llm.items.find(i => i.id === secrets.llm.active) || secrets.llm.items[0] || null;
    return active?.value || "";
  }
  
  async function saveLlmSecret(payload) {
    const label = String(payload?.label || "Default").trim() || "Default";
    const value = String(payload?.value || "").trim();
    // 拒绝保存掩码格式的 key（防止旧掩码被写回）
    // 检测4个及以上连续 * 号，或全 * 号字符串
    if (/\*{4,}/.test(value) || /^\*+$/.test(value)) {
      return await getSecretState();
    }
    const id = String(payload?.id || "default").replace(/[^\w.-]/g, "-") || "default";
    const secrets = await loadSecrets();
    const nextItem = { id, label, value };
    const items = [nextItem, ...secrets.llm.items.filter(i => i.id !== id)];
    return saveSecrets({ ...secrets, llm: { active: id, items } });
  }
  
  const LLM_CONNECTION_SENTINEL = "WORLD_TREE_CONNECTION_OK";
  
  function llmProbeMessages() {
    return [{ role: "user", content: `Reply exactly with this token and nothing else: ${LLM_CONNECTION_SENTINEL}` }];
  }
  
  function parseChatCompletionProbe(text = "") {
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { rawText: text };
    }
    const choice = data?.choices?.[0] || {};
    const message = choice.message || {};
    const content = String(message.content || "").trim();
    const reasoningContent = String(message.reasoning_content || message.reasoningContent || "").trim();
    const finishReason = choice.finish_reason || choice.finishReason || "";
    return { data, content, reasoningContent, finishReason };
  }
  
  function strictProbeFailure(probe) {
    if (!probe.content) {
      return {
        status: "fail",
        detail: probe.reasoningContent
          ? `empty content; reasoning_content present; finish_reason=${probe.finishReason || "unknown"}`
          : `empty content; finish_reason=${probe.finishReason || "unknown"}`,
        suggestion: "chat/completions 返回成功但没有可显示 content。DeepSeek V4 Flash 请关闭 thinking，或在启用 thinking 时提高 max_tokens。"
      };
    }
    if (!probe.content.includes(LLM_CONNECTION_SENTINEL)) {
      return {
        status: "fail",
        detail: `sentinel missing; content=${probe.content.slice(0, 80)}`,
        suggestion: "连接测试没有返回指定 sentinel，说明模型/参数可用性仍需确认。"
      };
    }
    return null;
  }
  
  function partialProbeResult({ latencyMs, checks, suggestions, detail }) {
    if (detail) suggestions.push(detail);
    return { status: "partial", latencyMs, checks, suggestions, safeToSave: false };
  }
  
  // ═══════════════════════════════════════════════════════════════
  //  LLM 测试连接
  // ═══════════════════════════════════════════════════════════════
  
  async function testLlmConnection(payload) {
    const started = Date.now();
    const config = { ...DEFAULT_CONFIG, ...(payload?.config || {}) };
    // 从本地 secrets.json 读取密钥（不信任前端传递的明文 key）
    const apiKey = await getActiveLlmValue();
    const baseUrl = String(config.llmBaseUrl || payload?.baseUrl || "").replace(/\/$/, "");
    const model = String(config.llmModel || payload?.model || "").trim();
    const checks = [];
    const suggestions = [];
    const add = (id, label, status, detail = "") => checks.push({ id, label, status, detail });
    const fail = (code, userMsg, detail = "") => ({ ...errorPayload(code, userMsg, detail), checks, suggestions, safeToSave: false });
  
    if (!baseUrl) {
      add("base_url", "Base URL", "fail", "missing");
      suggestions.push("请填写 OpenAI-compatible Base URL，例如 https://api.deepseek.com/v1。");
      return fail("LLM_BASE_URL_MISSING", "还没有填写 AI 服务地址。请在设置中填写 OpenAI 兼容接口地址。", "llmBaseUrl is empty");
    }
    if (!/^https?:\/\//.test(baseUrl)) {
      add("base_url", "Base URL", "fail", baseUrl);
      suggestions.push("Base URL 应以 http:// 或 https:// 开头。");
      return fail("LLM_BASE_URL_INVALID", "AI 服务地址格式不正确。地址应以 http:// 或 https:// 开头。", `Invalid base URL: ${baseUrl}`);
    }
    add("base_url", "Base URL", "ok", baseUrl);
    if (!baseUrl.endsWith("/v1")) suggestions.push("如果服务返回 404，请检查 Base URL 是否需要以 /v1 结尾。");
  
    if (!apiKey) {
      add("api_key", "API Key", "fail", "missing");
      suggestions.push("请先保存 API Key。本地 Ollama 等无鉴权服务也可以保存一个占位 key。");
      return fail("LLM_API_KEY_MISSING", "还没有填写 API Key。请先在设置中保存你的 LLM 访问密钥。", "active LLM secret is empty");
    }
    add("api_key", "API Key", "ok", "saved");
    if (!model) {
      add("model", "Model", "fail", "missing");
      suggestions.push("请填写模型名，例如 deepseek-v4-flash 或本地服务暴露的模型。");
      return fail("LLM_MODEL_MISSING", "还没有填写模型名。请在设置中选择或输入一个模型。", "llmModel is empty");
    }
    add("model", "Model", "ok", model);
  
    try {
      const modelsStarted = Date.now();
      const response = await fetch(`${baseUrl}/models`, {
        method: "GET",
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(Number(config.llmTimeoutMs || 60000))
      });
      const text = await response.text();
      if (!response.ok) {
        add("models", "/models", "fail", `HTTP ${response.status}`);
        if (response.status === 401 || response.status === 403) suggestions.push("API Key 无效或权限不足，请检查密钥是否复制完整。");
        if (response.status === 404) suggestions.push("Base URL 可能不正确，检查是否需要 /v1。");
        return { ...llmHttpError(response.status, text), checks, suggestions, safeToSave: false };
      }
      add("models", "/models", "ok", `${Date.now() - modelsStarted}ms`);
  
      let modelMayExist = "unknown";
      try {
        const parsed = text ? JSON.parse(text) : {};
        const ids = Array.isArray(parsed.data) ? parsed.data.map(item => item?.id || item?.name).filter(Boolean) : [];
        if (ids.length) modelMayExist = ids.includes(model) ? "ok" : "warn";
      } catch {
        add("models_format", "Models JSON", "warn", "服务返回的 /models 不是标准 OpenAI-compatible JSON。");
        suggestions.push("服务返回的 /models 不是标准格式，但仍会继续测试 chat/completions。");
      }
      if (modelMayExist === "warn") suggestions.push("当前模型名没有出现在 /models 列表中，可能需要检查模型名。");
      add("model_exists", "Model exists", modelMayExist, modelMayExist === "ok" ? model : "not confirmed");
  
      const chatStarted = Date.now();
      const chat = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(buildOpenAICompatibleChatBody({
          baseUrl,
          providerId: config.llmProvider || config.provider || "openai-compatible",
          model,
          messages: llmProbeMessages(),
          maxTokens: 64,
          temperature: 0,
          thinking: config.llmThinking ?? config.thinking ?? "auto"
        })),
        signal: AbortSignal.timeout(Math.min(Number(config.llmTimeoutMs || 60000), 60000))
      });
      const chatText = await chat.text();
      if (!chat.ok) {
        add("chat_completions", "chat/completions", "fail", `HTTP ${chat.status}`);
        if (chat.status === 404) suggestions.push("chat/completions 不可用，Base URL 可能错误，或模型名不存在。");
        if (chat.status === 401 || chat.status === 403) suggestions.push("API Key 无效或权限不足。");
        return { ...llmHttpError(chat.status, chatText), checks, suggestions, safeToSave: false };
      }
      add("chat_completions", "chat/completions", "ok", `${Date.now() - chatStarted}ms`);
      const probe = parseChatCompletionProbe(chatText);
      const probeFailure = strictProbeFailure(probe);
      if (probeFailure) {
        add("chat_content", "Non-empty sentinel content", probeFailure.status, probeFailure.detail);
        return partialProbeResult({ latencyMs: Date.now() - started, checks, suggestions, detail: probeFailure.suggestion });
      }
      add("chat_content", "Non-empty sentinel content", "ok", LLM_CONNECTION_SENTINEL);
  
      return { status: suggestions.length ? "partial" : "ok", latencyMs: Date.now() - started, checks, suggestions, safeToSave: true };
    } catch (error) {
      const timedOut = error?.name === "TimeoutError" || /timeout/i.test(String(error?.message || ""));
      add(timedOut ? "timeout" : "network", timedOut ? "Timeout" : "Network", "fail", error?.message || "fetch failed");
      suggestions.push(timedOut ? "服务响应超时，请检查网络、模型服务或 llmTimeoutMs 配置。" : "无法连接到模型服务；如果使用本地 Ollama，请确认服务已经启动。");
      return { ...errorPayload(timedOut ? "LLM_TIMEOUT" : "LLM_NETWORK_ERROR", timedOut ? "LLM 响应超时，请检查网络、模型服务或 llmTimeoutMs 配置。" : "无法连接到 AI 服务。请检查网络、API 地址，或确认本地模型服务已经启动。", error?.message || "fetch failed"), checks, suggestions, safeToSave: false };
    }
  }
  
  // ═══════════════════════════════════════════════════════════════
  //  引擎模块管理
  // ═══════════════════════════════════════════════════════════════

  return { dataRoot, configPath, secretsPath, DEFAULT_CONFIG, loadConfig, saveConfig, maskSecret, loadSecrets, saveSecrets, getSecretState, getActiveLlmValue, saveLlmSecret, LLM_CONNECTION_SENTINEL, llmProbeMessages, parseChatCompletionProbe, strictProbeFailure, partialProbeResult, testLlmConnection };
}
