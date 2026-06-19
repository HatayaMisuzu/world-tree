import test from "node:test";
import assert from "node:assert/strict";

import {
  api,
  createTempDataDir,
  removeTempDir,
  startWorldTreeServer
} from "./helpers/server-process.js";

async function withServer(fn, options = {}) {
  const dataDir = await createTempDataDir("world-tree-security-");
  const server = await startWorldTreeServer({ dataDir, ...(options || {}) });
  try {
    await fn(server);
  } finally {
    await server.stop();
    await removeTempDir(dataDir);
  }
}

async function rawRequest(server, path, options = {}) {
  const response = await fetch(`${server.baseUrl}${path}`, options);
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  return { response, status: response.status, body };
}

function assertReadableError(result, code) {
  assert.equal(result.body?.status, "error");
  assert.equal(result.body?.error, code);
  assert.equal(typeof result.body?.userMsg, "string");
  assert.ok(result.body.userMsg.length > 0);
}

test("security: rejects non-local Origin and allows localhost Origin", async () => {
  await withServer(async (server) => {
    const rejected = await rawRequest(server, "/api/health", {
      headers: { Origin: "https://evil.example" }
    });
    assert.equal(rejected.status, 403);
    assertReadableError(rejected, "LOCAL_ONLY");
    assert.equal(rejected.response.headers.get("access-control-allow-origin"), null);

    const allowed = await rawRequest(server, "/api/health", {
      headers: { Origin: "http://localhost:3000" }
    });
    assert.equal(allowed.status, 200);
    assert.equal(allowed.response.headers.get("access-control-allow-origin"), "http://localhost:3000");
  });
});

test("security: rate limit returns a readable 429 error", async () => {
  await withServer(async (server) => {
    let limited = null;
    for (let i = 0; i < 130; i += 1) {
      const result = await rawRequest(server, "/api/health");
      if (result.status === 429) {
        limited = result;
        break;
      }
    }

    assert.ok(limited, "expected API rate limit to trigger");
    assertReadableError(limited, "RATE_LIMITED");
  });
});

test("security: body limit, invalid JSON, non-object JSON, and empty body are readable errors", async () => {
  await withServer(async (server) => {
    const tooLarge = await rawRequest(server, "/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: "x".repeat(64) })
    });
    assert.equal(tooLarge.status, 413);
    assertReadableError(tooLarge, "BODY_TOO_LARGE");
  }, { env: { WORLD_TREE_MAX_BODY_BYTES: "20" } });

  await withServer(async (server) => {
    const invalid = await rawRequest(server, "/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{ bad"
    });
    assert.equal(invalid.status, 400);
    assertReadableError(invalid, "INVALID_JSON");

    const nonObject = await rawRequest(server, "/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "[]"
    });
    assert.equal(nonObject.status, 400);
    assertReadableError(nonObject, "INVALID_JSON_BODY");

    const empty = await rawRequest(server, "/api/modules/load", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: ""
    });
    assert.equal(empty.status, 400);
    assertReadableError(empty, "MODULE_ID_MISSING");
  });
});

test("security: data import rejects traversal and encoded traversal keys", async () => {
  await withServer(async (server) => {
    for (const key of ["../evil.json", "%2e%2e/evil.json"]) {
      const result = await api(server, "/api/data/import", {
        method: "POST",
        body: JSON.stringify({
          worldName: `import_${key.length}`,
          files: {
            "world.json": JSON.stringify({ name: "ok" }),
            [key]: JSON.stringify({ name: "bad" })
          }
        })
      });

      assert.equal(result.status, 400);
      assertReadableError(result, "IMPORT_FILE_KEY_INVALID");
    }
  });
});
