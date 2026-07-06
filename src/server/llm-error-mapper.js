// src/server/llm-error-mapper.js
// Normalize upstream LLM failures into a stable UI and persistence contract.

function textOf(value = "") {
  if (value == null) return "";
  if (typeof value === "string") return value;
  try { return JSON.stringify(value); } catch { return String(value); }
}

function codeFromMessage(message = "") {
  const text = String(message || "");
  const http = text.match(/\b(?:HTTP|status)\s*[:=]?\s*(\d{3})\b/i);
  if (http) return Number(http[1]);
  return 0;
}

function build(code, userMessage, detail = "", retryable = false, statusCode = 200) {
  return {
    status: "error",
    code,
    error: code,
    userMessage,
    userMsg: userMessage,
    errorMsg: userMessage,
    detail: String(detail || ""),
    retryable: Boolean(retryable),
    httpStatus: statusCode
  };
}

export function mapLlmError(error, context = {}) {
  const detail = textOf(error?.detail || error?.body || error?.message || error || "LLM call failed").slice(0, 3000);
  const status = Number(error?.status || error?.statusCode || error?.response?.status || codeFromMessage(detail) || context.status || 0);
  const name = String(error?.name || "");
  const code = String(error?.code || error?.cause?.code || "");
  const lower = `${name} ${code} ${detail}`.toLowerCase();

  if (code === "LLM_TIMEOUT" || name === "AbortError" || name === "TimeoutError" || /timeout|timed?\s*out|aborted/.test(lower)) {
    return build("LLM_TIMEOUT", "AI 服务响应超时。请稍后重试，或检查模型服务是否繁忙。", detail, true);
  }
  if (status === 401 || status === 403 || /unauthori[sz]ed|forbidden|invalid api key|api key/.test(lower)) {
    return build("LLM_AUTH_FAILED", "API Key 无效或没有权限。请到设置里检查连接档案和密钥。", detail, false);
  }
  if (status === 429 || /rate limit|too many requests/.test(lower)) {
    return build("LLM_RATE_LIMITED", "AI 服务请求过于频繁。请稍等片刻后重试。", detail, true);
  }
  if (status === 400 || status === 404 || /model.*(not found|unavailable|invalid)|模型不可用|model_not_found/.test(lower)) {
    return build("LLM_MODEL_NOT_FOUND", "当前模型不可用。请到设置里确认模型名称和服务商接口。", detail, false);
  }
  if (status >= 500 || /upstream|bad gateway|service unavailable|gateway timeout/.test(lower)) {
    return build("LLM_UPSTREAM_ERROR", "AI 服务暂时没有正常响应。请稍后重试。", detail, true);
  }
  if (/econnrefused|enotfound|econnreset|network|fetch failed|failed to fetch|connect failed|undici/.test(lower)) {
    return build("LLM_UNREACHABLE", "无法连接到 AI 服务。请确认本地模型或远程服务地址可用。", detail, true);
  }
  return build("LLM_UNKNOWN_ERROR", "AI 调用失败。请查看技术细节，检查连接配置后重试。", detail, true);
}

export function mapLlmErrorForPublicResponse(error, context = {}) {
  const mapped = mapLlmError(error, context);
  return {
    ...mapped,
    httpStatus: undefined
  };
}
