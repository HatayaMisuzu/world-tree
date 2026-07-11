import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";

import { listenOnAvailablePort } from "../../src/server/app-runtime.js";

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
