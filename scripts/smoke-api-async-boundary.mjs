import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHttpApiRouter } from "../src/server/http-api-router.js";

function createResponse({ headersSent = false } = {}) {
  return {
    headersSent,
    writableEnded: false,
    destroyed: false,
    setHeader() {},
    writeHead() { return this; },
    end() { this.writableEnded = true; return this; },
    destroy() { this.destroyed = true; }
  };
}

function createDeps(capture) {
  return {
    checkRateLimit: () => true,
    RATE_MAX_API: 60,
    jsonError: (...args) => capture.errors.push(args),
    jsonResponse: (...args) => capture.responses.push(args),
    parseOriginHost: () => "",
    isLocalRequest: () => true,
    LOCAL_HOSTS: new Set(["localhost", "127.0.0.1"]),
    handleV2ProductPlayableRoute: async () => false,
    loadConfig: async () => ({ llmBaseUrl: "", llmModel: "" }),
    getActiveLlmValue: async () => "",
    userDataPath: () => ".",
    writeFileSync() {},
    rmSync() {},
    listModules: () => [],
    getLatestVersion: () => null,
    PKG_VERSION: "test",
    calcDirectorySizeLimited: async () => ({ sizeBytes: 0, truncated: false, entries: 0 })
  };
}

const capture = { errors: [], responses: [] };
const originalConsoleError = console.error;
console.error = () => {};
const router = createHttpApiRouter(createDeps(capture));
const healthResponse = createResponse();
await router.handleAPI({ url: "/api/health", method: "GET", headers: {}, socket: {} }, healthResponse);
assert.equal(capture.responses.at(-1)?.[1]?.status, "ok");
assert.equal(capture.errors.length, 0);

await router.handleAPI({ url: "/api/does-not-exist", method: "GET", headers: {}, socket: {} }, createResponse());
assert.equal(capture.errors.at(-1)?.[1], 404);
assert.equal(capture.errors.at(-1)?.[2], "NOT_FOUND");

const malformedResponse = createResponse();
await router.handleAPI({ url: "/api/%", method: "GET", headers: { host: "[" }, socket: {} }, malformedResponse);
assert.equal(capture.errors.at(-1)?.[1], 500);
assert.equal(capture.errors.at(-1)?.[2], "INTERNAL_ERROR");

const sentResponse = createResponse({ headersSent: true });
await router.handleAPI({ url: "/api/%", method: "GET", headers: { host: "[" }, socket: {} }, sentResponse);
assert.equal(sentResponse.destroyed, true);

const rejectingCapture = { errors: [], responses: [] };
const rejectingRouter = createHttpApiRouter({ ...createDeps(rejectingCapture), checkRateLimit: () => { throw new Error("rate check failed"); } });
await rejectingRouter.handleAPI({ url: "/api/health", method: "GET", headers: {}, socket: {} }, createResponse());
assert.equal(rejectingCapture.errors.at(-1)?.[1], 500);
assert.equal(rejectingCapture.errors.at(-1)?.[2], "INTERNAL_ERROR");

const serverSource = readFileSync("server.js", "utf8");
assert.match(serverSource, /void handleAPI\(req, res\)\.catch/);
assert.match(serverSource, /res\.writableEnded/);
assert.match(serverSource, /serveStatic\(req, res\)/);
console.error = originalConsoleError;

console.log(JSON.stringify({
  status: "PASS",
  health: "200",
  unknown: "404",
  rejected: "structured-500",
  headersSent: "destroyed-without-second-write",
  serverBoundary: "catch-and-static-delegation-verified"
}));
