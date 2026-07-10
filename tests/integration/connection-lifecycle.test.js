import test from "node:test";
import assert from "node:assert/strict";

import {
  api,
  createTempDataDir,
  removeTempDir,
  startWorldTreeServer
} from "./helpers/server-process.js";

async function saveConnection(server, id, apiKey) {
  const result = await api(server, "/api/connections", {
    method: "POST",
    body: JSON.stringify({
      action: "upsert",
      setDefault: true,
      profile: {
        id,
        label: id,
        provider: "deepseek",
        baseUrl: "https://example.test/v1",
        model: "model-1",
        apiKey
      }
    })
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.status, "ok");
}

test("connection deletion synchronizes config, active secret, and health", async () => {
  const dataDir = await createTempDataDir("world-tree-connection-lifecycle-");
  const server = await startWorldTreeServer({ dataDir });

  try {
    await saveConnection(server, "alpha", "key-alpha");
    await saveConnection(server, "beta", "key-beta");

    const deleteNonActive = await api(server, "/api/connections", {
      method: "POST",
      body: JSON.stringify({ action: "delete", id: "alpha" })
    });
    assert.equal(deleteNonActive.body.active, "beta");
    let config = await api(server, "/api/config");
    assert.equal(config.body.connectionProfileId, "beta");
    assert.equal(config.body.llmModel, "model-1");
    let secrets = await api(server, "/api/secrets");
    assert.equal(secrets.body.llm.active, "beta");
    assert.deepEqual(secrets.body.llm.items.map(item => item.id), ["beta"]);

    await saveConnection(server, "gamma", "key-gamma");
    const deleteActive = await api(server, "/api/connections", {
      method: "POST",
      body: JSON.stringify({ action: "delete", id: "gamma" })
    });
    assert.equal(deleteActive.body.active, "beta");
    config = await api(server, "/api/config");
    assert.equal(config.body.connectionProfileId, "beta");
    secrets = await api(server, "/api/secrets");
    assert.equal(secrets.body.llm.active, "beta");
    assert.deepEqual(secrets.body.llm.items.map(item => item.id), ["beta"]);

    const deleteLast = await api(server, "/api/connections", {
      method: "POST",
      body: JSON.stringify({ action: "delete", id: "beta" })
    });
    assert.equal(deleteLast.body.active, "deepseek");
    config = await api(server, "/api/config");
    assert.equal(config.body.connectionProfileId, "deepseek");
    secrets = await api(server, "/api/secrets");
    assert.equal(secrets.body.llm.active, "");
    assert.deepEqual(secrets.body.llm.items, []);

    const deleteFallback = await api(server, "/api/connections", {
      method: "POST",
      body: JSON.stringify({ action: "delete", id: "deepseek" })
    });
    assert.equal(deleteFallback.body.active, "");
    config = await api(server, "/api/config");
    assert.equal(config.body.connectionProfileId, "");
    assert.equal(config.body.llmBaseUrl, "");
    assert.equal(config.body.llmModel, "");
    secrets = await api(server, "/api/secrets");
    assert.equal(secrets.body.llm.active, "");
    assert.deepEqual(secrets.body.llm.items, []);
    const health = await api(server, "/api/health");
    assert.equal(health.body.llmProfileConfigured, false);
    assert.equal(health.body.llmHasApiKey, false);
  } finally {
    await server.stop();
    await removeTempDir(dataDir);
  }
});
