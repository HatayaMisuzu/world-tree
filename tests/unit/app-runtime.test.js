import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { once } from "node:events";

import { listenOnAvailablePort } from "../../src/server/app-runtime.js";

async function close(server) {
  if (!server.listening) return;
  server.close();
  await once(server, "close");
}

test("server selects another port without terminating the process that owns the requested port", async () => {
  const occupied = createServer((_req, res) => res.end("unrelated-service"));
  const worldTree = createServer((_req, res) => res.end("world-tree"));
  try {
    await new Promise((resolve) => occupied.listen(0, "127.0.0.1", resolve));
    const requestedPort = occupied.address().port;
    const result = await listenOnAvailablePort(worldTree, { host: "127.0.0.1", port: requestedPort, maxAttempts: 10 });
    assert.equal(result.usedFallback, true);
    assert.notEqual(result.port, requestedPort);
    assert.equal(occupied.listening, true);
    assert.equal(await (await fetch(`http://127.0.0.1:${requestedPort}`)).text(), "unrelated-service");
  } finally {
    await close(worldTree);
    await close(occupied);
  }
});

test("Windows launcher never scans ports or kills processes", async () => {
  const source = await readFile(new URL("../../start.bat", import.meta.url), "utf8");
  assert.doesNotMatch(source, /taskkill/i);
  assert.doesNotMatch(source, /netstat/i);
  assert.match(source, /start-local\.mjs/);
});
