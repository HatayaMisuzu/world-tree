import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";

import {
  api,
  createTempDataDir,
  randomPort,
  removeTempDir,
  startWorldTreeServer
} from "./helpers/server-process.js";

async function startFakeLlm() {
  const port = randomPort();
  const server = createServer((req, res) => {
    if (req.method === "GET" && req.url === "/v1/models") {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ data: [{ id: "known-model" }] }));
    }
    if (req.method === "POST" && req.url === "/v1/chat/completions") {
      let body = "";
      req.on("data", (chunk) => { body += chunk.toString("utf-8"); });
      req.on("end", () => {
        const parsed = JSON.parse(body || "{}");
        const content = parsed.model === "empty-model"
          ? ""
          : (String(parsed.messages?.[0]?.content || parsed.messages?.at?.(-1)?.content || "").includes("WORLD_TREE_CONNECTION_OK")
              ? "WORLD_TREE_CONNECTION_OK"
              : "pong");
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          choices: [{
            finish_reason: parsed.model === "empty-model" ? "length" : "stop",
            message: { role: "assistant", content, reasoning_content: parsed.model === "empty-model" ? "I used the whole budget thinking." : "" }
          }],
          usage: { promptTokens: 11, completionTokens: 3, totalTokens: 14 }
        }));
      });
      return;
    }
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  });
  server.listen(port, "127.0.0.1");
  await once(server, "listening");
  return {
    baseUrl: `http://127.0.0.1:${port}/v1`,
    async stop() {
      server.close();
      await once(server, "close");
    }
  };
}

test("connection diagnostics reports checks, suggestions, and safe-to-save state", async () => {
  const dataDir = await createTempDataDir();
  const fakeLlm = await startFakeLlm();
  const server = await startWorldTreeServer({ dataDir });

  try {
    const save = await api(server, "/api/connections", {
      method: "POST",
      body: JSON.stringify({
        action: "upsert",
        setDefault: true,
        profile: {
          id: "fake",
          label: "Fake LLM",
          baseUrl: fakeLlm.baseUrl,
          model: "missing-model",
          apiKey: "test-key"
        }
      })
    });
    assert.equal(save.body.status, "ok");

    const testResult = await api(server, "/api/connections", {
      method: "POST",
      body: JSON.stringify({ action: "test", id: "fake" })
    });
    assert.equal(testResult.body.status, "partial");
    assert.equal(testResult.body.safeToSave, true);
    assert.equal(testResult.body.checks.some((check) => check.id === "chat_completions" && check.status === "ok"), true);
    assert.equal(testResult.body.checks.some((check) => check.id === "chat_content" && check.status === "ok"), true);
    assert.equal(testResult.body.checks.some((check) => check.id === "model_exists" && check.status === "warn"), true);
    assert.match(testResult.body.suggestions.join("\n"), /模型名/);
  } finally {
    await server.stop();
    await fakeLlm.stop();
    await removeTempDir(dataDir);
  }
});

test("connection diagnostics marks HTTP 200 with reasoning-only empty content as partial", async () => {
  const dataDir = await createTempDataDir();
  const fakeLlm = await startFakeLlm();
  const server = await startWorldTreeServer({ dataDir });

  try {
    const save = await api(server, "/api/connections", {
      method: "POST",
      body: JSON.stringify({
        action: "upsert",
        setDefault: true,
        profile: {
          id: "reasoning-empty",
          label: "Reasoning Empty",
          provider: "deepseek",
          baseUrl: fakeLlm.baseUrl,
          model: "empty-model",
          thinking: "enabled",
          apiKey: "test-key"
        }
      })
    });
    assert.equal(save.body.status, "ok");

    const testResult = await api(server, "/api/connections", {
      method: "POST",
      body: JSON.stringify({ action: "test", id: "reasoning-empty" })
    });
    assert.equal(testResult.body.status, "partial");
    assert.equal(testResult.body.safeToSave, false);
    assert.equal(testResult.body.checks.some((check) => check.id === "chat_completions" && check.status === "ok"), true);
    assert.equal(testResult.body.checks.some((check) => check.id === "chat_content" && check.status === "fail" && /reasoning_content/.test(check.detail)), true);
    assert.match(testResult.body.suggestions.join("\n"), /thinking/);
  } finally {
    await server.stop();
    await fakeLlm.stop();
    await removeTempDir(dataDir);
  }
});

test("connection diagnostics routes provider key to mock adapter without credentials", async () => {
  const dataDir = await createTempDataDir();
  const server = await startWorldTreeServer({ dataDir });

  try {
    const save = await api(server, "/api/connections", {
      method: "POST",
      body: JSON.stringify({
        action: "upsert",
        setDefault: true,
        profile: {
          id: "mock-local",
          label: "Mock Local",
          provider: "mock",
          baseUrl: "mock://local",
          model: "mock-model"
        }
      })
    });
    assert.equal(save.body.status, "ok");

    const testResult = await api(server, "/api/connections", {
      method: "POST",
      body: JSON.stringify({ action: "test", id: "mock-local" })
    });
    assert.equal(testResult.body.status, "ok");
    assert.equal(testResult.body.provider, "mock");
    assert.equal(testResult.body.safeToSave, true);
    assert.equal(testResult.body.checks.some((check) => check.id === "provider" && check.detail === "mock"), true);
    assert.equal(testResult.body.checks.some((check) => check.id === "chat" && check.status === "ok"), true);
  } finally {
    await server.stop();
    await removeTempDir(dataDir);
  }
});
