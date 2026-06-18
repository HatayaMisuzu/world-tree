import test from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  api,
  createTempDataDir,
  removeTempDir,
  startWorldTreeServer
} from "./helpers/server-process.js";

test("dashboard telemetry reads runtime state turnCount and lastScene", async () => {
  const dataDir = await createTempDataDir();
  const server = await startWorldTreeServer({ dataDir });

  try {
    const create = await api(server, "/api/modules/create", {
      method: "POST",
      body: JSON.stringify({
        name: "telemetry_world",
        displayName: "Telemetry World",
        dataMode: "worldbook",
        subType: "classic",
        preset: "epic"
      })
    });
    assert.equal(create.status, 200);

    const statePath = join(dataDir, "engine", "worlds", "telemetry_world", "runtime", "state.json");
    const state = JSON.parse(await readFile(statePath, "utf-8"));
    state.turnCount = 7;
    state.lastScene = "North Bridge";
    state.engineState = { ...(state.engineState || {}), emotionState: { engagement: 6, tension: 4, fatigue: 2, curiosity: 8 } };
    await writeFile(statePath, JSON.stringify(state, null, 2), "utf-8");

    const telemetry = await api(server, "/api/dashboard/telemetry?moduleKey=telemetry_world");
    assert.equal(telemetry.status, 200);
    assert.equal(telemetry.body.status, "ok");
    assert.equal(telemetry.body.turnCount, 7);
    assert.equal(telemetry.body.lastScene, "North Bridge");
  } finally {
    await server.stop();
    await removeTempDir(dataDir);
  }
});
