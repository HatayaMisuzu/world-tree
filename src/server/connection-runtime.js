// Bounded server runtime extracted from server.js.
export function createConnectionRuntime(deps = {}) {
  const {
    readJsonSync,
    CONNECTIONS_PATH,
    writeJson,
    loadSecrets,
    secretsPath,
    maskSecret,
    loadPipelineProfiles,
    errorPayload,
    llmProbeMessages,
    strictProbeFailure,
    LLM_CONNECTION_SENTINEL,
    mapLlmError,
    llmHttpError,
    parseChatCompletionProbe,
    partialProbeResult,
    buildOpenAICompatibleChatBody,
    slugName,
    saveConfig,
    saveSecrets,
    saveLlmSecret
  } = deps;

  function connectionTemplates() {
    return [
      { id: "deepseek", label: "DeepSeek", baseUrl: "https://api.deepseek.com/v1", model: "deepseek-v4-flash", provider: "deepseek", thinking: "disabled" },
      { id: "openai-compatible", label: "OpenAI-compatible", baseUrl: "https://api.openai.com/v1", model: "gpt-4.1-mini", provider: "openai-compatible", thinking: "auto" },
      { id: "openrouter", label: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", model: "openrouter/auto", provider: "openai-compatible", thinking: "auto" },
      { id: "ollama", label: "Ollama", baseUrl: "http://127.0.0.1:11434/v1", model: "llama3.1", provider: "ollama", thinking: "auto" },
      { id: "claude-openrouter", label: "Claude via OpenRouter", baseUrl: "https://openrouter.ai/api/v1", model: "anthropic/claude-sonnet-4.5", provider: "openai-compatible", thinking: "auto" },
      { id: "anthropic", label: "Anthropic native", baseUrl: "https://api.anthropic.com/v1", model: "claude-sonnet-4-5", provider: "anthropic" },
      { id: "google", label: "Google Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta", model: "gemini-2.5-flash", provider: "google" },
      { id: "mock", label: "Mock provider", baseUrl: "mock://local", model: "mock-model", provider: "mock" }
    ];
  }
  
  function loadConnectionsRaw() {
    const fallback = {
      active: "deepseek",
      items: [
        { id: "deepseek", label: "DeepSeek", provider: "deepseek", baseUrl: "https://api.deepseek.com/v1", model: "deepseek-v4-flash", thinking: "disabled", apiKeySecretId: "deepseek", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
      ]
    };
    const raw = readJsonSync(CONNECTIONS_PATH(), fallback);
    return { active: raw.active || raw.items?.[0]?.id || "deepseek", items: Array.isArray(raw.items) ? raw.items : fallback.items };
  }
  
  async function saveConnectionsRaw(next) {
    await writeJson(CONNECTIONS_PATH(), next);
    return publicConnections(next);
  }
  
  async function secretValueById(secretId = "") {
    const secrets = await loadSecrets();
    return secrets.llm.items.find(i => i.id === secretId)?.value || "";
  }
  
  function publicConnections(raw = loadConnectionsRaw()) {
    const secrets = readJsonSync(secretsPath(), { llm: { items: [] } });
    const items = raw.items.map((item) => {
      const secret = (secrets.llm?.items || []).find(i => i.id === (item.apiKeySecretId || item.id));
      return { ...item, hasApiKey: Boolean(secret?.value), maskedKey: maskSecret(secret?.value || ""), active: item.id === raw.active };
    });
    return { status: "ok", active: raw.active, templates: connectionTemplates(), pipelineProfiles: loadPipelineProfiles(), items };
  }
  
  async function testConnectionProfile(profile) {
    const started = Date.now();
    const baseUrl = String(profile.baseUrl || "").replace(/\/$/, "");
    const model = String(profile.model || "").trim();
    const providerId = String(profile.provider || "openai-compatible");
    const apiKey = await secretValueById(profile.apiKeySecretId || profile.id);
    const checks = [];
    const suggestions = [];
    const add = (id, label, status, detail = "") => checks.push({ id, label, status, detail });
    const fail = (payload) => ({ ...payload, checks, suggestions, safeToSave: false });
    if (!baseUrl) {
      add("base_url", "Base URL", "fail", "missing");
      suggestions.push("请填写 OpenAI-compatible Base URL。");
      return fail(errorPayload("CONNECTION_BASE_URL_MISSING", "连接地址为空。", "baseUrl is empty"));
    }
    if (providerId !== "mock" && !/^https?:\/\//.test(baseUrl)) {
      add("base_url", "Base URL", "fail", baseUrl);
      suggestions.push("Base URL 应以 http:// 或 https:// 开头。");
      return fail(errorPayload("CONNECTION_BASE_URL_INVALID", "连接地址必须以 http:// 或 https:// 开头。", baseUrl));
    }
    add("base_url", "Base URL", "ok", baseUrl);
    if (providerId !== "mock" && !baseUrl.endsWith("/v1")) suggestions.push("如果服务返回 404，请确认 Base URL 是否需要以 /v1 结尾。");
    if (providerId !== "mock" && !apiKey && !baseUrl.includes("127.0.0.1") && !baseUrl.includes("localhost")) {
      add("api_key", "API Key", "fail", "missing");
      suggestions.push("远程服务通常需要保存 API Key。");
      return fail(errorPayload("CONNECTION_API_KEY_MISSING", "这个连接还没有保存 API Key。", "secret missing"));
    }
    add("api_key", "API Key", apiKey ? "ok" : "warn", apiKey ? "saved" : "local/no key");
    if (!model) {
      add("model", "Model", "fail", "missing");
      suggestions.push("请填写模型名。");
      return fail(errorPayload("CONNECTION_MODEL_MISSING", "这个连接还没有填写模型名。", "model missing"));
    }
    add("model", "Model", "ok", model);
    add("provider", "Provider", "ok", providerId);
    try {
      const { resolveProvider } = await import("../adapters/providers/index.js");
      const provider = resolveProvider(providerId);
      const probe = await provider.chat({
        baseUrl,
        providerId,
        model,
        apiKey,
        messages: llmProbeMessages(),
        temperature: 0,
        maxTokens: 64,
        thinking: profile.thinking || "auto",
        timeoutMs: 5000
      });
      add("chat", "Provider chat", "ok", probe.provider || provider.id);
      const strictProviderProbe = ["openai-compatible", "deepseek", "openrouter", "ollama"].includes(providerId);
      if (strictProviderProbe) {
        const providerProbeFailure = strictProbeFailure({
          content: String(probe.text || "").trim(),
          reasoningContent: String(probe.reasoningContent || probe.raw?.choices?.[0]?.message?.reasoning_content || "").trim(),
          finishReason: probe.raw?.choices?.[0]?.finish_reason || ""
        });
        if (providerProbeFailure) {
          add("provider_chat_content", "Provider non-empty sentinel content", "fail", providerProbeFailure.detail);
          suggestions.push(providerProbeFailure.suggestion);
        } else {
          add("provider_chat_content", "Provider non-empty sentinel content", "ok", LLM_CONNECTION_SENTINEL);
        }
      }
      if (providerId !== "openai-compatible" && providerId !== "deepseek" && providerId !== "openrouter" && providerId !== "ollama") {
        return { status: suggestions.length ? "partial" : "ok", latencyMs: Date.now() - started, checks, suggestions, provider: provider.id, safeToSave: true };
      }
    } catch (providerError) {
      if (providerId !== "openai-compatible" && providerId !== "deepseek" && providerId !== "openrouter" && providerId !== "ollama") {
        const mapped = mapLlmError(providerError);
        add("chat", "Provider chat", "fail", providerError?.message || "provider failed");
        return { ...mapped, checks, suggestions, safeToSave: false };
      }
    }
    try {
      const response = await fetch(`${baseUrl}/models`, {
        method: "GET",
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
        signal: AbortSignal.timeout(5000)
      });
      const text = await response.text();
      if (!response.ok) {
        add("models", "/models", "fail", `HTTP ${response.status}`);
        return { ...llmHttpError(response.status, text), checks, suggestions, safeToSave: false };
      }
      add("models", "/models", "ok");
      try {
        const parsed = text ? JSON.parse(text) : {};
        const ids = Array.isArray(parsed.data) ? parsed.data.map(item => item?.id || item?.name).filter(Boolean) : [];
        if (ids.length && !ids.includes(model)) {
          add("model_exists", "Model exists", "warn", "not listed");
          suggestions.push("模型名没有出现在 /models 列表中，可能需要修正。");
        } else {
          add("model_exists", "Model exists", ids.length ? "ok" : "unknown", ids.length ? model : "not confirmed");
        }
      } catch {
        add("models_format", "Models JSON", "warn", "non-standard response");
      }
      const chat = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
        body: JSON.stringify(buildOpenAICompatibleChatBody({
          baseUrl,
          providerId,
          model,
          messages: llmProbeMessages(),
          maxTokens: 64,
          temperature: 0,
          thinking: profile.thinking || "auto"
        })),
        signal: AbortSignal.timeout(5000)
      });
      const chatText = await chat.text();
      if (!chat.ok) {
        add("chat_completions", "chat/completions", "fail", `HTTP ${chat.status}`);
        return { ...llmHttpError(chat.status, chatText), checks, suggestions, safeToSave: false };
      }
      add("chat_completions", "chat/completions", "ok");
      const strictProbe = parseChatCompletionProbe(chatText);
      const probeFailure = strictProbeFailure(strictProbe);
      if (probeFailure) {
        add("chat_content", "Non-empty sentinel content", probeFailure.status, probeFailure.detail);
        return partialProbeResult({ latencyMs: Date.now() - started, checks, suggestions, detail: probeFailure.suggestion });
      }
      add("chat_content", "Non-empty sentinel content", "ok", LLM_CONNECTION_SENTINEL);
      return { status: suggestions.length ? "partial" : "ok", latencyMs: Date.now() - started, checks, suggestions, safeToSave: true };
    } catch (error) {
      const timedOut = error?.name === "TimeoutError" || /timeout/i.test(String(error?.message || ""));
      add(timedOut ? "timeout" : "network", timedOut ? "Timeout" : "Network", "fail", error?.message || "fetch failed");
      suggestions.push(timedOut ? "服务响应超时，请检查模型服务是否繁忙。" : "无法连接到模型服务；本地服务请确认已经启动。");
      return { ...errorPayload(timedOut ? "CONNECTION_TIMEOUT" : "CONNECTION_NETWORK_ERROR", timedOut ? "连接测试超时。请检查模型服务状态。" : "无法连接到这个模型服务。请检查地址、网络或本地模型是否已启动。", error?.message || "fetch failed"), checks, suggestions, safeToSave: false };
    }
  }
  
  async function handleConnections(body = {}, method = "GET") {
    if (method === "GET") return publicConnections();
    const action = body.action || "upsert";
    const raw = loadConnectionsRaw();
    const now = new Date().toISOString();
    if (action === "delete") {
      const id = String(body.id || "");
      const items = raw.items.filter(i => i.id !== id);
      return saveConnectionsRaw({ active: raw.active === id ? (items[0]?.id || "") : raw.active, items });
    }
    if (action === "duplicate") {
      const source = raw.items.find(i => i.id === body.id);
      if (!source) return { status: "error", errorMsg: "连接档案不存在。" };
      const existing = new Set(raw.items.map(i => i.id));
      let id = slugName(`${source.id}-copy`, "connection-copy");
      let n = 2;
      while (existing.has(id)) id = slugName(`${source.id}-copy-${n++}`, "connection-copy");
      const copy = { ...source, id, label: `${source.label || source.id} Copy`, apiKeySecretId: id, createdAt: now, updatedAt: now };
      return saveConnectionsRaw({ ...raw, items: [copy, ...raw.items] });
    }
    if (action === "setDefault") {
      const id = String(body.id || "");
      const item = raw.items.find(i => i.id === id);
      if (!item) return { status: "error", errorMsg: "连接档案不存在。" };
      await saveConfig({ connectionProfileId: id, llmBaseUrl: item.baseUrl, llmModel: item.model, llmProvider: item.provider || "openai-compatible", llmThinking: item.thinking || "auto" });
      const secrets = await loadSecrets();
      await saveSecrets({ ...secrets, llm: { ...secrets.llm, active: item.apiKeySecretId || item.id } });
      return saveConnectionsRaw({ ...raw, active: id });
    }
    if (action === "test") {
      const item = raw.items.find(i => i.id === body.id) || body.profile;
      if (!item) return { status: "error", errorMsg: "连接档案不存在。" };
      const result = await testConnectionProfile(item);
      const apiKey = await secretValueById(item.apiKeySecretId || item.id);
      return { ...result, hasApiKey: Boolean(apiKey) };
    }
  
    const profile = body.profile || body;
    const id = slugName(profile.id || profile.label || profile.provider || "connection", "connection");
    const item = {
      id,
      label: String(profile.label || id).trim() || id,
      provider: profile.provider || "openai-compatible",
      baseUrl: String(profile.baseUrl || "").trim(),
      model: String(profile.model || "").trim(),
      thinking: ["auto", "disabled", "enabled"].includes(String(profile.thinking || "").trim()) ? String(profile.thinking || "auto").trim() : "auto",
      temperature: profile.temperature === "" || profile.temperature === undefined ? undefined : Number(profile.temperature),
      maxTokens: profile.maxTokens === "" || profile.maxTokens === undefined ? undefined : Number(profile.maxTokens),
      topP: profile.topP === "" || profile.topP === undefined ? undefined : Number(profile.topP),
      apiKeySecretId: profile.apiKeySecretId || id,
      notes: String(profile.notes || "").trim(),
      createdAt: raw.items.find(i => i.id === id)?.createdAt || now,
      updatedAt: now
    };
    const key = String(profile.apiKey || "").trim();
    if (key && !/\*{4,}/.test(key)) await saveLlmSecret({ id: item.apiKeySecretId, label: item.label, value: key });
    const items = [item, ...raw.items.filter(i => i.id !== id)];
    const active = body.setDefault ? id : raw.active;
    if (body.setDefault) await saveConfig({ connectionProfileId: id, llmBaseUrl: item.baseUrl, llmModel: item.model, llmProvider: item.provider || "openai-compatible", llmThinking: item.thinking || "auto" });
    return saveConnectionsRaw({ active, items });
  }

  return { connectionTemplates, loadConnectionsRaw, saveConnectionsRaw, secretValueById, publicConnections, testConnectionProfile, handleConnections };
}
