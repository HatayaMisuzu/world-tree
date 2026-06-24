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
      fail(bodyTooLargeError(`content-length=${contentLength}, limit=${limit}`));
      if (typeof req.destroy === "function") req.destroy();
      return;
    }

    req.on("data", (chunk) => {
      if (settled) return;

      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
      received += buffer.length;

      if (received > limit) {
        fail(bodyTooLargeError(`received=${received}, limit=${limit}`));
        if (typeof req.destroy === "function") req.destroy();
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

      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(badJsonError(err?.message || String(err)));
      }
    });

    req.on("error", fail);
  });
}

export function createReadBody({ limit } = {}) {
  if (!Number.isFinite(limit) || limit <= 0) {
    throw new TypeError("createReadBody requires a positive numeric limit");
  }

  return function readBody(req, overrideLimit = limit) {
    return readJsonBody(req, overrideLimit);
  };
}
