import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import {
  api,
  createTempDataDir,
  removeTempDir,
  startWorldTreeServer
} from "./helpers/server-process.js";

const REPO_USER_DATA = resolve("userData");
const PROTECTED_FILES = ["config.json", "connections.json", "secrets.json", "corrupt-files.jsonl"];

async function fileHash(filePath) {
  if (!existsSync(filePath)) return null;
  const content = await readFile(filePath);
  return createHash("sha256").update(content).digest("hex");
}

async function protectedHashes() {
  return Object.fromEntries(await Promise.all(PROTECTED_FILES.map(async (name) => [
    name,
    await fileHash(join(REPO_USER_DATA, name))
  ])));
}

test("integration server writes config, connections and secrets only to temporary userData", async () => {
  const before = await protectedHashes();
  const dataDir = await createTempDataDir("world-tree-user-data-isolation-");
  const server = await startWorldTreeServer({ dataDir });

  try {
    const config = await api(server, "/api/config", {
      method: "POST",
      body: JSON.stringify({ theme: "isolation-test" })
    });
    assert.equal(config.status, 200);

    const connection = await api(server, "/api/connections", {
      method: "POST",
      body: JSON.stringify({
        action: "upsert",
        setDefault: true,
        profile: {
          id: "isolation-test",
          label: "Isolation Test",
          baseUrl: "http://127.0.0.1:9/v1",
          model: "isolation-model",
          apiKey: "isolation-test-key"
        }
      })
    });
    assert.equal(connection.status, 200);

    for (const name of ["config.json", "connections.json", "secrets.json"]) {
      assert.equal(existsSync(join(server.userDataDir, name)), true, `${name} should be written to temporary userData`);
    }
  } finally {
    await server.stop();
  }

  const after = await protectedHashes();
  assert.deepEqual(after, before, "repo-root userData hashes must remain unchanged");
  await removeTempDir(dataDir);
});
