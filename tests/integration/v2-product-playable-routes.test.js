import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { api, createTempDataDir, removeTempDir, startWorldTreeServer } from "./helpers/server-process.js";
import { writeJson } from "../../src/server/fs-utils.js";

test("V2 product playable routes are served through HTTP adapter", async () => {
  const dataDir = await createTempDataDir("wt-v2-product-routes-");
  const worldDir = join(dataDir, "engine", "worlds", "RouteWorld");
  mkdirSync(join(worldDir, "shared"), { recursive: true });
  mkdirSync(join(worldDir, "runtime"), { recursive: true });
  await writeJson(join(worldDir, "shared", "worldbook.json"), { entries: [] });
  const server = await startWorldTreeServer({ dataDir });
  try {
    const worldbook = await api(server, "/api/worldbook-v2/load?moduleKey=world:RouteWorld");
    assert.equal(worldbook.status, 200);
    assert.equal(worldbook.body.status, "ok");

    const strategy = await api(server, "/api/strategy-sim-v2/spec/validate", {
      method: "POST",
      body: JSON.stringify({
        spec: {
          specId: "route_spec",
          resources: [{ id: "supply", min: 0, max: 10, initial: 5, visibility: "public" }]
        }
      })
    });
    assert.equal(strategy.status, 200);
    assert.equal(strategy.body.status, "ok");
  } finally {
    await server.stop();
    await removeTempDir(dataDir);
  }
});
