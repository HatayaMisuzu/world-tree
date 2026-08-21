// tests/unit/local-access.test.js
import test from "node:test";
import assert from "node:assert/strict";
import {
  createRateLimiter,
  LOCAL_HOSTS,
  isLocalAddress,
  isLocalRequest,
  isLocalUrl,
  isLoopbackAddress,
  parseHostHeader,
  parseOriginHost,
  validateListenHost
} from "../../src/server/local-access.js";

function req({ remoteAddress = "127.0.0.1", host = "localhost:3000", origin = "", referer = "" } = {}) {
  return {
    socket: { remoteAddress },
    headers: { host, origin, referer }
  };
}

test("isLoopbackAddress preserves existing loopback behavior", () => {
  assert.equal(isLoopbackAddress("127.0.0.1"), true);
  assert.equal(isLoopbackAddress("::1"), true);
  assert.equal(isLoopbackAddress("::ffff:127.0.0.1"), true);
  assert.equal(isLoopbackAddress("192.168.0.2"), false);
  assert.equal(isLoopbackAddress("localhost"), false);
});

test("parseOriginHost returns host, empty string for absent, sentinel for invalid/null origins", () => {
  assert.equal(parseOriginHost("http://localhost:3000"), "localhost");
  assert.equal(parseOriginHost("http://127.0.0.1:3000"), "127.0.0.1");
  // Absent origin → "" (treated as CLI/no-origin request).
  assert.equal(parseOriginHost(""), "");
  // Unparseable and "null" origins must return a sentinel that fails the
  // LOCAL_HOSTS allowlist — they are cross-origin contexts (sandboxed iframe,
  // file://) and must never be treated as "no origin" (CORS bypass fix).
  const invalid = parseOriginHost("not a url");
  assert.ok(invalid !== "", "unparseable origin must not return empty string");
  assert.equal(invalid === parseOriginHost("null"), true);
  assert.equal(LOCAL_HOSTS.has(invalid), false, "sentinel must not be in LOCAL_HOSTS");
});

test("parseHostHeader preserves IPv6 bracket behavior", () => {
  assert.equal(parseHostHeader("localhost:3000"), "localhost");
  assert.equal(parseHostHeader("127.0.0.1:3000"), "127.0.0.1");
  assert.equal(parseHostHeader("[::1]:3000"), "[::1]");
  assert.equal(parseHostHeader(""), "");
});

test("isLocalRequest accepts local socket, host, origin, and referer", () => {
  assert.equal(isLocalRequest(req()), true);
  assert.equal(isLocalRequest(req({ origin: "http://localhost:3000" })), true);
  assert.equal(isLocalRequest(req({ referer: "http://127.0.0.1:3000/app" })), true);
  assert.equal(isLocalRequest(req({ host: "[::1]:3000", origin: "http://[::1]:3000" })), true);
});

test("isLocalRequest rejects non-local socket, host, origin, or referer", () => {
  assert.equal(isLocalRequest(req({ remoteAddress: "192.168.0.2" })), false);
  assert.equal(isLocalRequest(req({ host: "evil.example:3000" })), false);
  assert.equal(isLocalRequest(req({ origin: "https://evil.example" })), false);
  assert.equal(isLocalRequest(req({ referer: "https://evil.example/path" })), false);
});

test("isLocalAddress and isLocalUrl keep existing local URL rules", () => {
  assert.equal(isLocalAddress("::ffff:127.0.0.1"), true);
  assert.equal(isLocalAddress("localhost"), true);
  assert.equal(isLocalAddress("10.0.0.1"), false);

  assert.equal(isLocalUrl("http://localhost:11434/v1"), true);
  assert.equal(isLocalUrl("http://127.0.0.1:11434/v1"), true);
  assert.equal(isLocalUrl("https://api.deepseek.com/v1"), false);
  assert.equal(isLocalUrl("not a url"), false);
});

test("validateListenHost fails closed before runtime listen", () => {
  for (const host of ["127.0.0.1", "::1", "localhost"]) {
    assert.equal(validateListenHost(host), host);
  }
  for (const host of ["0.0.0.0", "::", "192.168.1.20", "", " ", " 127.0.0.1", "127.0.0.1:3000", "[::1]"]) {
    assert.throws(() => validateListenHost(host), (error) => error?.code === "HOST_NOT_LOOPBACK");
  }
});

test("createRateLimiter enforces per-window limits", () => {
  let now = 1000;
  const limiter = createRateLimiter({ windowMs: 100, getNow: () => now });

  assert.equal(limiter.checkRateLimit("127.0.0.1", 2), true);
  assert.equal(limiter.checkRateLimit("127.0.0.1", 2), true);
  assert.equal(limiter.checkRateLimit("127.0.0.1", 2), false);

  now = 1101;
  assert.equal(limiter.checkRateLimit("127.0.0.1", 2), true);
});

test("createRateLimiter cleanupExpired removes stale entries", () => {
  let now = 1000;
  const limiter = createRateLimiter({ windowMs: 100, getNow: () => now });

  assert.equal(limiter.checkRateLimit("a", 5), true);
  assert.equal(limiter.checkRateLimit("b", 5), true);
  assert.equal(limiter.size(), 2);

  now = 1301;
  limiter.cleanupExpired();
  assert.equal(limiter.size(), 0);
});
