import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createModuleService } from "../../src/server/module-service.js";
import { ensureDir, readJsonSync as baseReadJsonSync, writeJson } from "../../src/server/fs-utils.js";
import { pathWithinRoot } from "../../src/server/path-security.js";

async function withService(fn) {
  const root = await mkdtemp(join(tmpdir(), "world-tree-module-"));
  let readCount = 0;
  const service = createModuleService({
    dataRoot: () => root,
    worldsDir: () => join(root, "engine", "worlds"),
    profilesDir: () => join(root, "profiles"),
    charactersDir: () => join(root, "engine", "characters"),
    readJsonSync(filePath, fallback) {
      readCount += 1;
      return baseReadJsonSync(filePath, fallback);
    },
    writeJson,
    ensureDir,
    pathWithinRoot,
    safeEntityId(value = "", fallback = "") {
      const raw = String(value || "").replace(/^world:/, "").trim();
      return /^[\w\u4e00-\u9fff-]+$/u.test(raw) ? raw : fallback;
    }
  });

  try {
    await fn({ root, service, getReadCount: () => readCount });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("buildModuleModel reuses cache until a shared file mtime changes", async () => {
  await withService(async ({ service, getReadCount }) => {
    const created = await service.createModule({ name: "cache_world", displayName: "Cache World" });
    assert.equal(created.status, "ok");

    const first = await service.buildModuleModel("cache_world");
    assert.equal(first.moduleData.worldbook.entries.length, 0);
    const afterFirst = getReadCount();
    assert.ok(afterFirst > 0);

    const second = await service.buildModuleModel("cache_world");
    assert.equal(second.moduleData.worldbook.entries.length, 0);
    assert.equal(getReadCount(), afterFirst);

    await new Promise(resolve => setTimeout(resolve, 20));
    await writeFile(
      join(service.worldsDir(), "cache_world", "shared", "worldbook.json"),
      JSON.stringify({ entries: [{ id: "entry_1", keys: ["cache"], content: "updated" }] }),
      "utf-8"
    );

    const third = await service.buildModuleModel("cache_world");
    assert.equal(third.moduleData.worldbook.entries.length, 1);
    assert.ok(getReadCount() > afterFirst);
  });
});

test("mode creation rejects missing source text and reports ignored fields", async () => {
  await withService(async ({ service }) => {
    const result = await service.createModule({
      name: "empty_idea",
      displayName: "Empty Idea",
      mode: "quick-setting",
      idea: "A city under glass"
    });

    assert.equal(result.status, "error");
    assert.equal(result.httpStatus, 400);
    assert.equal(result.code, "MISSING_SOURCE_TEXT");
    assert.deepEqual(result.ignoredFields, ["idea"]);
    assert.match(result.hint, /sourceText/);
  });
});

test("mode creation echoes accepted source chars and ignored fields", async () => {
  await withService(async ({ service }) => {
    const result = await service.createModule({
      name: "accepted_source",
      displayName: "Accepted Source",
      mode: "quick-setting",
      sourceText: "A city under glass",
      idea: "legacy client field"
    });

    assert.equal(result.status, "ok");
    assert.equal(result.acceptedSourceChars, "A city under glass".length);
    assert.deepEqual(result.ignoredFields, ["idea"]);
  });
});
