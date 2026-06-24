// tests/unit/local-access.test.js
import test from "node:test";
import assert from "node:assert/strict";
import {
  createRateLimiter,
  isLocalAddress,
  isLocalRequest,
  isLocalUrl,
  isLoopbackAddress,
  parseHostHeader,
  parseOriginHost
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

test("parseOriginHost returns host or empty string for invalid origins", () => {
  assert.equal(parseOriginHost("http://localhost:3000"), "localhost");
  assert.equal(parseOriginHost("http://127.0.0.1:3000"), "127.0.0.1");
  assert.equal(parseOriginHost("not a url"), "");
  assert.equal(parseOriginHost(""), "");
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
