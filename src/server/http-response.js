// src/server/http-response.js
// HTTP response and error contract helpers for World Tree local server.
// Keep this module small and dependency-free so server.js can gradually shed
// infrastructure code without changing route behavior.

export function errorPayload(code, userMsg, detail = "") {
  return {
    status: "error",
    error: code,
    code,
    userMsg,
    errorMsg: userMsg,
    detail: String(detail || "")
  };
}

export function llmHttpError(status, detail = "") {
  if (status === 401 || status === 403) {
    return errorPayload(
      "LLM_AUTH_FAILED",
      "API Key 无效或没有权限。请检查密钥是否复制完整，或确认服务商账号状态。",
      detail || `HTTP ${status}`
    );
  }
  if (status === 402) {
    return errorPayload(
      "LLM_QUOTA_EXHAUSTED",
      "AI 服务额度不足或账号欠费。请检查服务商控制台的余额和配额。",
      detail || "HTTP 402"
    );
  }
  if (status === 429) {
    return errorPayload(
      "LLM_RATE_LIMITED",
      "AI 服务请求过于频繁。请稍等片刻再试，或降低连续发送速度。",
      detail || "HTTP 429"
    );
  }
  if (status >= 500) {
    return errorPayload(
      "LLM_UPSTREAM_ERROR",
      "AI 服务暂时没有正常响应。请稍后重试。",
      detail || `HTTP ${status}`
    );
  }
  return errorPayload(
    "LLM_HTTP_ERROR",
    "AI 服务返回了无法处理的错误。请查看技术细节并检查配置。",
    detail || `HTTP ${status}`
  );
}

export function jsonResponse(res, data, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

export function jsonError(res, status, code, userMsg, detail = "") {
  return jsonResponse(res, errorPayload(code, userMsg, detail), status);
}

export class HttpError extends Error {
  constructor(status, code, userMsg, detail = "") {
    super(userMsg);
    Object.assign(this, { status, code, userMsg, detail });
  }
}
