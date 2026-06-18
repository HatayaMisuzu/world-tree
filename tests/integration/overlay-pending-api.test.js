import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { OVERLAY_FILES, WRITE_POLICY } from "../../src/core/engine/overlay-store.js";

import {
  api,
  createTempDataDir,
  removeTempDir,
  startWorldTreeServer
} from "./helpers/server-process.js";

test("overlay pending API lists and adopts queued overlay operations", async () => {
  const dataDir = await createTempDataDir();
  const server = await startWorldTreeServer({ dataDir });

  try {
    const create = await api(server, "/api/modules/create", {
      method: "POST",
      body: JSON.stringify({
        name: "overlay_api_world",
        displayName: "Overlay API World",
        dataMode: "worldbook",
        subType: "classic",
        preset: "epic"
      })
    });
    assert.equal(create.status, 200);

    const overlayDir = join(dataDir, "engine", "worlds", "overlay_api_world", "runtime", "overlay");
    await mkdir(overlayDir, { recursive: true });
    const pendingItem = {
      id: "pending-test-1",
      file: OVERLAY_FILES.WORLDBOOK,
      op: "merge-json",
      policy: WRITE_POLICY.CONFIRM.level,
      payload: { adopted: true }
    };
    await writeFile(join(overlayDir, OVERLAY_FILES.PENDING), `${JSON.stringify(pendingItem)}\n`, "utf-8");

    const list = await api(server, "/api/overlay/pending?moduleKey=overlay_api_world");
    assert.equal(list.status, 200);
    assert.equal(list.body.pending.length, 1);
    assert.equal(list.body.pending[0].id, "pending-test-1");

    const adopt = await api(server, "/api/overlay/pending", {
      method: "POST",
      body: JSON.stringify({ moduleKey: "overlay_api_world", action: "adopt", id: "pending-test-1" })
    });
    assert.equal(adopt.status, 200);
    assert.equal(adopt.body.status, "ok");
    assert.equal(adopt.body.pending.length, 0);
    assert.equal(JSON.parse(readFileSync(join(overlayDir, OVERLAY_FILES.WORLDBOOK), "utf-8")).adopted, true);
    assert.equal(existsSync(join(overlayDir, OVERLAY_FILES.PENDING)), true);
  } finally {
    await server.stop();
    await removeTempDir(dataDir);
  }
});
