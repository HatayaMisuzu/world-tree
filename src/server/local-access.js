// src/server/local-access.js
// Local-only access and lightweight rate-limit helpers for World Tree.
// This module must stay dependency-free and must not know about routes,
// persistence, LLM, proposal/canon, modules, or assets.

export const LOCAL_HOST_VALUES = ["localhost", "127.0.0.1", "::1", "[::1]"];
export const LOCAL_HOSTS = new Set(LOCAL_HOST_VALUES);

export function isLoopbackAddress(addr = "") {
  const value = String(addr || "");
  return value === "127.0.0.1" || value === "::1" || value === "::ffff:127.0.0.1";
}

export function parseOriginHost(value = "") {
  try {
    return value ? new URL(value).hostname : "";
  } catch {
    return "";
  }
}

/** Parse Host header while preserving the existing [::1]:3000 behavior. */
export function parseHostHeader(host = "") {
  const value = String(host || "").trim();
  if (value.startsWith("[")) {
    const end = value.indexOf("]");
    return end >= 0 ? value.slice(0, end + 1) : value;
  }
  return value.split(":")[0];
}

export function isLocalRequest(req, { localHosts = LOCAL_HOSTS } = {}) {
  const remote = req?.socket?.remoteAddress || "";
  if (!isLoopbackAddress(remote)) return false;

  const host = parseHostHeader(req?.headers?.host || "");
  if (host && !localHosts.has(host)) return false;

  const originHost = parseOriginHost(req?.headers?.origin || "");
  if (originHost && !localHosts.has(originHost)) return false;

  const refererHost = parseOriginHost(req?.headers?.referer || "");
  if (refererHost && !localHosts.has(refererHost)) return false;

  return true;
}

export function isLocalAddress(value = "") {
  const addr = String(value || "").replace(/^::ffff:/, "");
  return addr === "127.0.0.1" || addr === "::1" || addr === "localhost";
}

export function isLocalUrl(value = "") {
  try {
    const host = new URL(value).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
  } catch {
    return false;
  }
}

export function createRateLimiter({ windowMs, getNow = () => Date.now() } = {}) {
  if (!Number.isFinite(windowMs) || windowMs <= 0) {
    throw new TypeError("createRateLimiter requires a positive numeric windowMs");
  }

  const rateMap = new Map();

  function checkRateLimit(remoteAddr, limit) {
    const now = getNow();
    const key = remoteAddr || "127.0.0.1";
    let entry = rateMap.get(key);

    if (!entry || now - entry.windowStart > windowMs) {
      entry = { windowStart: now, count: 0 };
      rateMap.set(key, entry);
    }

    entry.count++;
    return entry.count <= limit;
  }

  function cleanupExpired(maxAgeMs = windowMs * 2) {
    const now = getNow();
    for (const [key, entry] of rateMap) {
      if (now - entry.windowStart > maxAgeMs) rateMap.delete(key);
    }
  }

  function size() {
    return rateMap.size;
  }

  return { checkRateLimit, cleanupExpired, size };
}
