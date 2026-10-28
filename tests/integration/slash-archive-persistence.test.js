import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  api,
  createTempDataDir,
  randomPort,
  removeTempDir,
  startWorldTreeServer
} from "./helpers/server-process.js";

async function startNarrativeLlm() {
  const port = randomPort();
  const server = createServer((req, res) => {
    if (req.method === "POST" && req.url === "/v1/chat/completions") {
      let body = "";
      req.on("data", (chunk) => { body += chunk.toString("utf8"); });
      req.on("end", () => {
        const parsed = JSON.parse(body || "{}");
        const wantsJson = parsed.response_format?.type === "json_object";
        const content = wantsJson
          ? JSON.stringify({
              intent: "action",
              emotionalSubtext: "玩家想确认重试后的世界是否继续响应",
              engagementDelta: 1,
              tensionDelta: 0,
              fatigueDelta: 0,
              curiosityDelta: 1,
              pacingSuggestion: "hold",
              pressureSuggestion: "low",
              eventIntensitySuggestion: "light",
              sceneGoal: "恢复叙事",
              suggestedMustInclude: ["灯塔"],
              suggestedMustNotInclude: [],
              emotionalTarget: { increase: ["curiosity"], decrease: [] }
            })
          : "【叙事】\n灯塔重新亮起，旧错误仍留在记录里，而故事继续向前。\n【状态】\nscene: 灯塔";
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content } }] }));
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

async function saveConnection(server, profile) {
  const result = await api(server, "/api/connections", {
    method: "POST",
    body: JSON.stringify({
      action: "upsert",
      setDefault: true,
      profile: {
        id: profile.id,
        label: profile.label || profile.id,
        baseUrl: profile.baseUrl,
        model: "test-model",
        apiKey: "test-key"
      }
    })
  });
  assert.equal(result.body.status, "ok");
}

async function chat(server, moduleKey, input) {
  const res = await api(server, "/api/llm/chat", {
    method: "POST",
    body: JSON.stringify({
      moduleKey, input, modeId: "world-rpg", dataMode: "worldbook",
      engineState: { dataMode: "worldbook", emotionState: { engagement: 5, tension: 5, fatigue: 5, curiosity: 5 } },
      messages: []
    })
  });
  assert.equal(res.body.status, "ok", JSON.stringify(res.body).slice(0, 300));
  return res.body;
}

test("slash /存档 twice and /世界 复制 twice persist distinct files through the real chat pipeline", async () => {
  const dataDir = await createTempDataDir();
  const server = await startWorldTreeServer({ dataDir });
  const fakeLlm = await startNarrativeLlm();
  try {
    const create = await api(server, "/api/modules/create", {
      method: "POST",
      body: JSON.stringify({ name: "存档链路", displayName: "存档链路", mode: "world-rpg", dataMode: "worldbook", sourceText: "灯塔城邦。", sourceType: "test" })
    });
    assert.equal(create.body.status, "ok");
    const moduleKey = create.body.module.id;
    const worldId = String(moduleKey).replace(/^world:/, "");
    await saveConnection(server, { id: "fake-success", baseUrl: fakeLlm.baseUrl });

    const firstSave = await chat(server, moduleKey, "/存档");
    const secondSave = await chat(server, moduleKey, "/存档");
    const archiveDir = join(dataDir, "engine", "worlds", worldId, "runtime", "archives");
    const files = (await readdir(archiveDir)).filter((f) => f.endsWith(".json")).sort();
    assert.equal(files.length, 2, `expected two archive files, got ${files.join(",")}`);
    assert.notEqual(files[0], files[1]);
    const receiptName = (body) => body.narrative.match(/存档「([^」]+)」已保存/)?.[1];
    const savedNames = [receiptName(firstSave), receiptName(secondSave)];
    assert.ok(savedNames[0] && savedNames[1], `receipts must name the archive: ${firstSave.narrative} / ${secondSave.narrative}`);
    assert.deepEqual([...savedNames].sort(), files.map((f) => f.replace(/\.json$/, "")), "receipts must show actual on-disk names");
    assert.equal(`${savedNames[1]}.json`, files.find((f) => f === `${savedNames[1]}.json`), "second receipt equals the second file on disk");
    for (const file of files) {
      const archive = JSON.parse(await readFile(join(archiveDir, file), "utf8"));
      assert.equal(archive.name, file.replace(/\.json$/, ""));
      assert.equal(archive._isolated, true);
      assert.ok(archive._runtime && archive._runtime.version, `archive ${file} must embed runtime snapshot`);
    }

    const worldsDir = join(dataDir, "engine", "worlds");
    const before = new Set(await readdir(worldsDir));
    const firstCopy = await chat(server, moduleKey, `/世界 复制 ${worldId}`);
    const secondCopy = await chat(server, moduleKey, `/世界 复制 ${worldId}`);
    const copies = (await readdir(worldsDir)).filter((d) => !before.has(d)).sort();
    assert.equal(copies.length, 2, `expected two world copies, got ${copies.join(",")}`);
    const copyName = (body) => body.narrative.match(/已复制为「([^」]+)」/)?.[1];
    assert.deepEqual([copyName(firstCopy), copyName(secondCopy)].sort(), copies, "copy receipts must show actual on-disk world names");
    assert.notEqual(copyName(firstCopy), copyName(secondCopy));
    for (const copy of copies) {
      const world = JSON.parse(await readFile(join(worldsDir, copy, "world.json"), "utf8"));
      assert.ok(world, `copy ${copy} must contain world.json`);
      const copiedArchives = await readdir(join(worldsDir, copy, "runtime", "archives"));
      assert.equal(copiedArchives.length, 2, `copy ${copy} must carry the archives`);
    }
  } finally {
    await server.stop();
    await fakeLlm.stop();
    await removeTempDir(dataDir);
  }
});

test("slash /存档 named twice defaults to -2; list and load see runtime/archives", async () => {
  const dataDir = await createTempDataDir();
  const server = await startWorldTreeServer({ dataDir });
  const fakeLlm = await startNarrativeLlm();
  try {
    const create = await api(server, "/api/modules/create", {
      method: "POST",
      body: JSON.stringify({ name: "存档列表对齐", displayName: "存档列表对齐", mode: "world-rpg", dataMode: "worldbook", sourceText: "灯塔城邦。", sourceType: "test" })
    });
    assert.equal(create.body.status, "ok");
    const moduleKey = create.body.module.id;
    const worldId = String(moduleKey).replace(/^world:/, "");
    await saveConnection(server, { id: "fake-success", baseUrl: fakeLlm.baseUrl });

    const first = await chat(server, moduleKey, "/存档 灯塔进度");
    const second = await chat(server, moduleKey, "/存档 灯塔进度");
    const archiveDir = join(dataDir, "engine", "worlds", worldId, "runtime", "archives");
    const files = (await readdir(archiveDir)).filter((f) => f.endsWith(".json")).sort();
    assert.equal(files.length, 2, `expected two files after same-name saves, got ${files.join(",")}`);
    assert.deepEqual(files, ["[W]灯塔进度-2.json", "[W]灯塔进度.json"]);
    const receiptName = (body) => body.narrative.match(/存档「([^」]+)」已保存/)?.[1];
    assert.equal(receiptName(first), "[W]灯塔进度");
    assert.equal(receiptName(second), "[W]灯塔进度-2");

    const list = await chat(server, moduleKey, "/存档列表");
    assert.match(list.narrative, /\[W\]灯塔进度/);
    assert.match(list.narrative, /\[W\]灯塔进度-2/);
    assert.doesNotMatch(list.narrative, /暂无存档/);

    const loaded = await chat(server, moduleKey, "/读档 [W]灯塔进度");
    assert.match(loaded.narrative, /已读档「\[W\]灯塔进度」/);
    assert.match(loaded.narrative, /runtime\/archives/);
  } finally {
    await server.stop();
    await fakeLlm.stop();
    await removeTempDir(dataDir);
  }
});

test("slash /存档 name 覆盖 overwrites the same file when asked", async () => {
  const dataDir = await createTempDataDir();
  const server = await startWorldTreeServer({ dataDir });
  const fakeLlm = await startNarrativeLlm();
  try {
    const create = await api(server, "/api/modules/create", {
      method: "POST",
      body: JSON.stringify({ name: "存档覆盖", displayName: "存档覆盖", mode: "world-rpg", dataMode: "worldbook", sourceText: "灯塔城邦。", sourceType: "test" })
    });
    assert.equal(create.body.status, "ok");
    const moduleKey = create.body.module.id;
    const worldId = String(moduleKey).replace(/^world:/, "");
    await saveConnection(server, { id: "fake-success", baseUrl: fakeLlm.baseUrl });

    await chat(server, moduleKey, "/存档 固定名");
    const overwrite = await chat(server, moduleKey, "/存档 固定名 覆盖");
    const archiveDir = join(dataDir, "engine", "worlds", worldId, "runtime", "archives");
    const files = (await readdir(archiveDir)).filter((f) => f.endsWith(".json")).sort();
    assert.deepEqual(files, ["[W]固定名.json"], "explicit 覆盖 must not allocate -2");
    assert.match(overwrite.narrative, /存档「\[W\]固定名」已保存/);
  } finally {
    await server.stop();
    await fakeLlm.stop();
    await removeTempDir(dataDir);
  }
});


test("legacy <world>/archive alone is visible to /存档列表 and loadable via /读档 chat path", async () => {
  const dataDir = await createTempDataDir();
  const server = await startWorldTreeServer({ dataDir });
  const fakeLlm = await startNarrativeLlm();
  try {
    const create = await api(server, "/api/modules/create", {
      method: "POST",
      body: JSON.stringify({ name: "旧档回退", displayName: "旧档回退", mode: "world-rpg", dataMode: "worldbook", sourceText: "灯塔城邦。", sourceType: "test" })
    });
    assert.equal(create.body.status, "ok");
    const moduleKey = create.body.module.id;
    const worldId = String(moduleKey).replace(/^world:/, "");
    await saveConnection(server, { id: "fake-success", baseUrl: fakeLlm.baseUrl });

    // Only write legacy path; do NOT create runtime/archives
    const legacyDir = join(dataDir, "engine", "worlds", worldId, "archive");
    await mkdir(legacyDir, { recursive: true });
    const archiveName = "[W]旧灯塔";
    await writeFile(join(legacyDir, `${archiveName}.json`), JSON.stringify({
      name: archiveName,
      title: "旧灯塔",
      createdAt: "2024-01-01T00:00:00.000Z",
      summary: "legacy-only archive",
      _isolated: true,
      _runtime: { version: 1, emotionState: { engagement: 5, tension: 5, fatigue: 5, curiosity: 5 } }
    }), "utf8");

    const list = await chat(server, moduleKey, "/存档列表");
    assert.match(list.narrative, /\[W\]旧灯塔/);
    assert.doesNotMatch(list.narrative, /暂无存档/);

    const loaded = await chat(server, moduleKey, "/读档 [W]旧灯塔");
    assert.match(loaded.narrative, /已读档「\[W\]旧灯塔」/);
    assert.match(loaded.narrative, /archive\/\[W\]旧灯塔\.json/);
  } finally {
    await server.stop();
    await fakeLlm.stop();
    await removeTempDir(dataDir);
  }
});

test("runtime/archives and legacy archive both appear in /存档列表 (deduped by name)", async () => {
  const dataDir = await createTempDataDir();
  const server = await startWorldTreeServer({ dataDir });
  const fakeLlm = await startNarrativeLlm();
  try {
    const create = await api(server, "/api/modules/create", {
      method: "POST",
      body: JSON.stringify({ name: "双目录合并", displayName: "双目录合并", mode: "world-rpg", dataMode: "worldbook", sourceText: "灯塔城邦。", sourceType: "test" })
    });
    assert.equal(create.body.status, "ok");
    const moduleKey = create.body.module.id;
    const worldId = String(moduleKey).replace(/^world:/, "");
    await saveConnection(server, { id: "fake-success", baseUrl: fakeLlm.baseUrl });

    const worldRoot = join(dataDir, "engine", "worlds", worldId);
    const primaryDir = join(worldRoot, "runtime", "archives");
    const legacyDir = join(worldRoot, "archive");
    await mkdir(primaryDir, { recursive: true });
    await mkdir(legacyDir, { recursive: true });

    await writeFile(join(primaryDir, "[W]新档.json"), JSON.stringify({
      name: "[W]新档", title: "新档", summary: "from runtime/archives", createdAt: "2025-01-01T00:00:00.000Z"
    }), "utf8");
    await writeFile(join(legacyDir, "[W]旧独有.json"), JSON.stringify({
      name: "[W]旧独有", title: "旧独有", summary: "from legacy archive", createdAt: "2024-01-01T00:00:00.000Z"
    }), "utf8");
    // Same name in both dirs: primary must win (still only one list entry)
    await writeFile(join(legacyDir, "[W]同名.json"), JSON.stringify({
      name: "[W]同名", title: "legacy-dup", summary: "legacy copy", createdAt: "2024-06-01T00:00:00.000Z"
    }), "utf8");
    await writeFile(join(primaryDir, "[W]同名.json"), JSON.stringify({
      name: "[W]同名", title: "primary-dup", summary: "primary copy", createdAt: "2025-06-01T00:00:00.000Z"
    }), "utf8");

    const list = await chat(server, moduleKey, "/存档列表");
    assert.match(list.narrative, /\[W\]新档/);
    assert.match(list.narrative, /\[W\]旧独有/);
    assert.match(list.narrative, /\[W\]同名/);
    // Deduped: only one line for 同名; primary summary should appear
    const sameNameHits = [...list.narrative.matchAll(/\[W\]同名/g)];
    assert.equal(sameNameHits.length, 1, `expected one 同名 entry after dedupe, got narrative:\n${list.narrative}`);
    assert.match(list.narrative, /primary copy/);
    assert.doesNotMatch(list.narrative, /legacy copy/);

    const loadedLegacy = await chat(server, moduleKey, "/读档 [W]旧独有");
    assert.match(loadedLegacy.narrative, /已读档「\[W\]旧独有」/);
    const loadedPrimary = await chat(server, moduleKey, "/读档 [W]新档");
    assert.match(loadedPrimary.narrative, /已读档「\[W\]新档」/);
  } finally {
    await server.stop();
    await fakeLlm.stop();
    await removeTempDir(dataDir);
  }
});
