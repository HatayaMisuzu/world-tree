// @deprecated v2.3.0 — Hermes 本地服务器适配器，当前未使用（走直连 LLM 模式）。
// 保留供将来 Hermes 服务恢复时启用。
import { startupPacket } from "../../src/core/commands.js";
import { moduleKey, moduleTitle } from "../../src/core/normalizers.js";

const SESSION_KEY = "world-tree:legacy-hermes:sessions";

function headers(config, apiKey = "") {
  const result = { "Content-Type": "application/json" };
  // 🆕 v1.0.1 统一使用 LLM API Key 认证（OpenAI 格式）
  // 优先使用传入的 apiKey，其次尝试 config 中的 hermesBaseUrl 无 token 连接
  const key = apiKey || config.hermesToken || "";
  if (key) result.Authorization = `Bearer ${key}`;
  return result;
}

function baseUrl(config) {
  return (config.hermesBaseUrl || "").replace(/\/$/, "");
}

async function parseResponse(response) {
  const text = await response.text();
  if (!response.ok) throw new Error(text || `HTTP ${response.status}`);
  try {
    return JSON.parse(text);
  } catch {
    return { text };
  }
}

export function loadSessions() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || "{}");
  } catch {
    return {};
  }
}

export function saveSessions(sessions) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(sessions));
}

export function sessionsFor(model) {
  if (!model.selected) return [];
  return loadSessions()[moduleKey(model.selected)] || [];
}

export async function health(config, apiKey = "") {
  if (!baseUrl(config)) throw new Error("未配置 API 地址");
  const response = await fetch(`${baseUrl(config)}/health`, { headers: headers(config, apiKey) });
  return parseResponse(response);
}

export async function createSession(model, config, apiKey = "") {
  if (!model.selected) throw new Error("未选择模组");
  const response = await fetch(`${baseUrl(config)}/api/sessions`, {
    method: "POST",
    headers: headers(config, apiKey),
    body: JSON.stringify({ title: `World Tree - ${moduleTitle(model.selected)}` })
  });
  const data = await parseResponse(response);
  const sessionId = data?.session?.id || data?.id;
  if (!sessionId) throw new Error("Hermes 未返回 session id");

  const sessions = loadSessions();
  const key = moduleKey(model.selected);
  const bucket = sessions[key] || [];
  sessions[key] = [
    {
      id: sessionId,
      title: data?.session?.title || moduleTitle(model.selected),
      createdAt: new Date().toISOString(),
      bootstrapped: false,
      startupPreview: startupPacket(model).slice(0, 320)
    },
    ...bucket.filter((item) => item.id !== sessionId)
  ].slice(0, 12);
  saveSessions(sessions);
  return sessionId;
}

export async function sendMessage(model, config, sessionId, message, apiKey = "") {
  if (!sessionId) sessionId = await createSession(model, config, apiKey);
  const sessions = loadSessions();
  const key = moduleKey(model.selected);
  const bucket = sessions[key] || [];
  const current = bucket.find((item) => item.id === sessionId);
  const systemMessage = current?.bootstrapped
    ? `World Tree module: ${moduleTitle(model.selected)}`
    : startupPacket(model);

  const response = await fetch(`${baseUrl(config)}/api/sessions/${encodeURIComponent(sessionId)}/chat`, {
    method: "POST",
    headers: headers(config, apiKey),
    body: JSON.stringify({ message, system_message: systemMessage })
  });
  const data = await parseResponse(response);

  sessions[key] = bucket.map((item) => item.id === sessionId
    ? { ...item, bootstrapped: true, lastUsedAt: new Date().toISOString() }
    : item);
  saveSessions(sessions);
  return data;
}
