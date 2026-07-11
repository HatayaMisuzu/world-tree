import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { EventEmitter, once } from "node:events";

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

class FakeServer extends EventEmitter {
  constructor(outcomes) {
    super();
    this.outcomes = outcomes;
    this.attempt = 0;
  }

  listen(port) {
    const outcome = this.outcomes[this.attempt++];
    queueMicrotask(() => {
      if (outcome?.code) this.emit("error", outcome);
      else {
        this.boundPort = port;
        this.emit("listening");
      }
    });
  }

  address() {
    return { port: this.boundPort };
  }
}

test("listenOnAvailablePort validates ports and skips only occupied candidates", async () => {
  await assert.rejects(() => listenOnAvailablePort(new FakeServer([]), { port: "bad" }), /Invalid port/);
  await assert.rejects(() => listenOnAvailablePort(new FakeServer([]), { port: 70000 }), /Invalid port/);
  const fallback = new FakeServer([{ code: "EADDRINUSE" }, null]);
  assert.deepEqual(await listenOnAvailablePort(fallback, { port: 3010, maxAttempts: 2 }), {
    port: 3011,
    requestedPort: 3010,
    usedFallback: true
  });
  await assert.rejects(() => listenOnAvailablePort(new FakeServer([Object.assign(new Error("blocked"), { code: "EACCES" })]), { port: 3012 }), /blocked/);
});
