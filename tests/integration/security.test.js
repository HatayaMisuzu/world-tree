import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

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
    await fn(server, dataDir);
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

    for (const body of ["null", '"text"', "42"]) {
      const scalar = await rawRequest(server, "/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body
      });
      assert.equal(scalar.status, 400);
      assertReadableError(scalar, "INVALID_JSON_BODY");
    }

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

test("security: /api/data/export excludes chat/memory/state by default", async () => {
  const dataDir = await createTempDataDir("wt-export-sec-");
  const server = await startWorldTreeServer({ dataDir });
  try {
    const create = await api(server, "/api/modules/create", {
      method: "POST",
      body: JSON.stringify({ name: "export_sec", dataMode: "worldbook" })
    });
    assert.equal(create.status, 200);

    const exported = await api(server, "/api/data/export?moduleKey=export_sec");
    assert.equal(exported.status, 200);
    const files = exported.body.files || {};

    const sensitiveKeys = Object.keys(files).filter(k =>
      k.includes("chat.jsonl") || k.includes("memory.jsonl") ||
      k.includes("runtime/state.json") || k.includes("overlay/") ||
      k.includes("pending.jsonl") || /(?:debug|proposal|session|status|mechanisms|secrets)/i.test(k)
    );
    assert.equal(sensitiveKeys.length, 0,
      `敏感文件不应出现在默认导出中: ${sensitiveKeys.join(", ")}`);

    const sharedKeys = Object.keys(files).filter(k => k.includes("shared/"));
    assert.ok(sharedKeys.length > 0, "shared 文件应出现在导出中");
  } finally {
    await server.stop();
    await removeTempDir(dataDir);
  }
});

test("security: module load and character backup do not expose absolute paths", async () => {
  await withServer(async (server, dataDir) => {
    await api(server, "/api/modules/create", {
      method: "POST",
      body: JSON.stringify({ name: "private_path_world", dataMode: "worldbook" })
    });
    const loaded = await api(server, "/api/modules/load", {
      method: "POST",
      body: JSON.stringify({ id: "private_path_world" })
    });
    const loadedText = JSON.stringify(loaded.body);
    assert.equal(loadedText.includes(dataDir), false);
    assert.equal("path" in loaded.body.model.selected, false);
    assert.equal(loaded.body.model.selected.hasLocalPath, true);

    const characterDir = join(dataDir, "engine", "characters", "hero");
    await mkdir(characterDir, { recursive: true });
    await writeFile(join(characterDir, "card.json"), JSON.stringify({ name: "Hero" }), "utf8");
    const backup = await api(server, "/api/characters/backup", {
      method: "POST",
      body: JSON.stringify({ id: "hero" })
    });
    assert.equal(backup.status, 200);
    assert.equal(typeof backup.body.backupId, "string");
    assert.equal(backup.body.location, "characters-archive");
    assert.equal(JSON.stringify(backup.body).includes(dataDir), false);
    assert.equal("path" in backup.body, false);
  });
});

test("security: deferred plugin API is gated unless explicitly enabled", async () => {
  await withServer(async (server) => {
    const disabled = await rawRequest(server, "/api/plugins");
    assert.equal(disabled.status, 403);
    assertReadableError(disabled, "PLUGINS_DISABLED");
  });
  await withServer(async (server) => {
    const enabled = await rawRequest(server, "/api/plugins");
    assert.equal(enabled.status, 200);
    assert.equal(enabled.body.status, "ok");
  }, { env: { WORLD_TREE_ENABLE_DEFERRED_PLUGINS: "1" } });
});

test("security: /api/status default omits dataRoot and memory", async () => {
  const dataDir = await createTempDataDir("wt-status-");
  const server = await startWorldTreeServer({ dataDir });
  try {
    const basic = await api(server, "/api/status");
    assert.equal(basic.status, 200);
    assert.equal(typeof basic.body.version, "string");
    assert.equal("dataRoot" in basic.body, false, "默认不应包含 dataRoot");
    assert.equal("memory" in basic.body, false, "默认不应包含 memory");

    const full = await api(server, "/api/status?detail=full");
    assert.equal(typeof full.body.dataRoot, "string", "detail=full 应包含 dataRoot");
    assert.equal(typeof full.body.memory, "number", "detail=full 应包含 memory");
  } finally {
    await server.stop();
    await removeTempDir(dataDir);
  }
});
