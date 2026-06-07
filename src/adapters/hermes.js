import { startupPacket } from "../core/commands.js";
import { moduleKey, moduleTitle } from "../core/normalizers.js";

const SESSION_KEY = "world-tree-desktop:sessions";

function headers(config) {
  const result = { "Content-Type": "application/json" };
  if (config.hermesToken) result.Authorization = `Bearer ${config.hermesToken}`;
  if (config.hermesToken) result["X-API-Key"] = config.hermesToken;
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

export async function health(config) {
  if (!baseUrl(config)) throw new Error("未配置 Hermes API 地址");
  const response = await fetch(`${baseUrl(config)}/health`, { headers: headers(config) });
  return parseResponse(response);
}

export async function createSession(model, config) {
  if (!model.selected) throw new Error("未选择模组");
  const response = await fetch(`${baseUrl(config)}/api/sessions`, {
    method: "POST",
    headers: headers(config),
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

export async function sendMessage(model, config, sessionId, message) {
  if (!sessionId) sessionId = await createSession(model, config);
  const sessions = loadSessions();
  const key = moduleKey(model.selected);
  const bucket = sessions[key] || [];
  const current = bucket.find((item) => item.id === sessionId);
  const systemMessage = current?.bootstrapped
    ? `World Tree module: ${moduleTitle(model.selected)}`
    : startupPacket(model);

  const response = await fetch(`${baseUrl(config)}/api/sessions/${encodeURIComponent(sessionId)}/chat`, {
    method: "POST",
    headers: headers(config),
    body: JSON.stringify({ message, system_message: systemMessage })
  });
  const data = await parseResponse(response);

  sessions[key] = bucket.map((item) => item.id === sessionId
    ? { ...item, bootstrapped: true, lastUsedAt: new Date().toISOString() }
    : item);
  saveSessions(sessions);
  return data;
}
