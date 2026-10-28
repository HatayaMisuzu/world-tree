import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import { readFile, readdir } from "node:fs/promises";
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
