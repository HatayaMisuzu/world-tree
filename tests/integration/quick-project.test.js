import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  api,
  createTempDataDir,
  removeTempDir,
  startWorldTreeServer
} from "./helpers/server-process.js";

test("quick project creates a persisted draft world from pasted text", async () => {
  const dataDir = await createTempDataDir();
  const server = await startWorldTreeServer({ dataDir });

  try {
    const create = await api(server, "/api/modules/create", {
      method: "POST",
      body: JSON.stringify({
        name: "quick_project_test",
        displayName: "Quick Project Test",
        quickProject: true,
        draft: true,
        sourceType: "pasted_text",
        sourceText: "A city under glass. The archivist remembers every storm.",
        dataMode: "worldbook",
        subType: "quick",
        preset: "minimal"
      })
    });

    assert.equal(create.status, 200);
    assert.equal(create.body.status, "ok");
    assert.equal(create.body.module.draft, true);

    const worldDir = join(dataDir, "engine", "worlds", "quick_project_test");
    assert.equal(existsSync(join(worldDir, "runtime", "source.txt")), true);
    assert.match(readFileSync(join(worldDir, "runtime", "source.txt"), "utf-8"), /archivist/);

    const list = await api(server, "/api/modules");
    const module = list.body.find((item) => item.id === "quick_project_test");
    assert.equal(module.draft, true);
    assert.equal(module.sourceType, "pasted_text");

    const finalize = await api(server, "/api/modules/finalize-draft", {
      method: "POST",
      body: JSON.stringify({ moduleKey: "quick_project_test", displayName: "Glass City" })
    });
    assert.equal(finalize.body.status, "ok");
    assert.equal(finalize.body.module.draft, false);
  } finally {
    await server.stop();
    await removeTempDir(dataDir);
  }
});
