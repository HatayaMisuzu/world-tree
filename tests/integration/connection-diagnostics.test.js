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
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content: parsed.model ? "pong" : "" } }] }));
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
    assert.equal(testResult.body.checks.some((check) => check.id === "model_exists" && check.status === "warn"), true);
    assert.match(testResult.body.suggestions.join("\n"), /模型名/);
  } finally {
    await server.stop();
    await fakeLlm.stop();
    await removeTempDir(dataDir);
  }
});
