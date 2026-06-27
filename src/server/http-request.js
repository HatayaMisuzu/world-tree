// src/server/http-request.js
// HTTP request body parsing helpers for World Tree local server.
// This module intentionally owns only JSON body reading and body-size failures.
// It must not know about routes, persistence, proposal/canon, LLM, or module logic.

import { HttpError } from "./http-response.js";

export function parseContentLength(headers = {}) {
  const raw = headers["content-length"] ?? headers["Content-Length"] ?? 0;
  const value = Number(raw || 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function bodyTooLargeError(detail = "") {
  return new HttpError(413, "BODY_TOO_LARGE", "请求内容过大。", detail);
}

export function badJsonError(detail = "") {
  return new HttpError(400, "INVALID_JSON", "请求内容不是有效 JSON。", detail);
}

export function invalidJsonBodyError(detail = "") {
  return new HttpError(400, "INVALID_JSON_BODY", "请求内容必须是 JSON 对象。", detail);
}

export function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function readJsonBody(req, limit) {
  if (!Number.isFinite(limit) || limit <= 0) {
    throw new TypeError("readJsonBody requires a positive numeric limit");
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const chunks = [];
    let received = 0;

    const fail = (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    };

    const contentLength = parseContentLength(req.headers || {});
    if (contentLength > limit) {
      // Drain the request body without destroying the socket
      req.resume();
      fail(bodyTooLargeError(`content-length=${contentLength}, limit=${limit}`));
      // Drain the request without destroying the response socket so the route
      // catch can still return the documented JSON 413 error.
      if (typeof req.resume === "function") req.resume();
      return;
    }

    req.on("data", (chunk) => {
      if (settled) return;

      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
      received += buffer.length;

      if (received > limit) {
        // Stop accumulating, drain the rest, reject
        req.resume();
        fail(bodyTooLargeError(`received=${received}, limit=${limit}`));
        if (typeof req.resume === "function") req.resume();
        return;
      }

      chunks.push(buffer);
    });

    req.on("end", () => {
      if (settled) return;
      settled = true;

      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw.trim()) {
        resolve({});
        return;
      }

      let parsed;
      try {
        const parsed = JSON.parse(raw);
        if (!isPlainObject(parsed)) {
          reject(invalidJsonBodyError(`received ${parsed === null ? "null" : Array.isArray(parsed) ? "array" : typeof parsed}`));
          return;
        }
        resolve(parsed);
      } catch (err) {
        if (err instanceof HttpError) {
          reject(err);
          return;
        }
        reject(badJsonError(err?.message || String(err)));
        return;
      }

      if (requireObject && !isPlainObject(parsed)) {
        reject(invalidJsonBodyError());
        return;
      }

      resolve(parsed);
    });

    req.on("error", fail);
  });
}

export function createReadBody({ limit, requireObject = true } = {}) {
  if (!Number.isFinite(limit) || limit <= 0) {
    throw new TypeError("createReadBody requires a positive numeric limit");
  }

  return function readBody(req, overrideLimit = limit) {
    return readJsonBody(req, overrideLimit, { requireObject });
  };
}
