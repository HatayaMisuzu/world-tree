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

const MODES = [
  { mode: "world-rpg", title: "风暴大陆", text: "一片被永恒风暴包围的大陆。冒险者从避风港出发。" },
  { mode: "mystery-puzzle", title: "密室之谜", text: "一间反锁的密室，死者身旁只有一封未写完的信。" },
  { mode: "tabletop", title: "龙牙酒馆", text: "冒险者们聚集在龙牙酒馆，墙上贴着一张悬赏令。" },
  { mode: "strategy-sim", title: "三国边境", text: "三方势力在边境对峙，资源匮乏，决策迫在眉睫。" },
  { mode: "murder-mystery", title: "樱花庄事件", text: "樱花庄发生了一起案件。六位住客，一个死者，无数秘密。" }
];

for (const { mode, title, text } of MODES) {
  test(`${mode} project creates with correct metadata and survives roundtrip`, async () => {
    const dataDir = await createTempDataDir();
    const server = await startWorldTreeServer({ dataDir });

    try {
      const name = `${mode.replace(/-/g, "_")}_test`;
      const create = await api(server, "/api/modules/create", {
        method: "POST",
        body: JSON.stringify({
          name,
          displayName: title,
          mode,
          dataMode: "worldbook",
          subType: "classic",
          preset: "epic",
          draft: true,
          sourceType: "pasted_text",
          sourceText: text
        })
      });

      assert.equal(create.status, 200);
      assert.equal(create.body.status, "ok");
      assert.equal(create.body.module.mode, mode);
      assert.equal(create.body.module.dataMode, "worldbook");

      const worldDir = join(dataDir, "engine", "worlds", name);

      // world.json
      const world = JSON.parse(readFileSync(join(worldDir, "world.json"), "utf-8"));
      assert.equal(world.mode, mode);
      assert.ok(world.modeMetadata);

      // runtime/state.json
      const state = JSON.parse(readFileSync(join(worldDir, "runtime", "state.json"), "utf-8"));
      assert.equal(state.engineState.dataMode, "worldbook");
      assert.equal(state.engineState.worldSubType, "classic");
      assert.equal(state.mode, mode);
      assert.ok(state.modeStateEnvelope);

      // runtime/source.txt
      assert.equal(existsSync(join(worldDir, "runtime", "source.txt")), true);

      // chat.jsonl exists
      assert.equal(existsSync(join(worldDir, "runtime", "chat.jsonl")), true);

      // Mode-specific shared file exists
      const sharedFiles = {
        "world-rpg": "shared/world_rpg.json",
        "mystery-puzzle": "shared/mystery.json",
        tabletop: "shared/tabletop.json",
        "strategy-sim": "shared/strategy.json",
        "murder-mystery": "shared/murder_mystery.json"
      };
      const sharedPath = sharedFiles[mode];
      assert.equal(existsSync(join(worldDir, sharedPath)), true, `${sharedPath} missing`);

      // .worldtree roundtrip
      const exported = await api(server, "/api/world-pack/export", {
        method: "POST",
        body: JSON.stringify({ moduleKey: name })
      });
      assert.equal(exported.body.status, "ok");
      assert.equal(exported.body.pack.files["world.json"].mode, mode);

      const imported = await api(server, "/api/world-pack/import", {
        method: "POST",
        body: JSON.stringify({
          pack: exported.body.pack,
          name: `${name}_imported`,
          preview: false,
          confirm: true
        })
      });
      assert.equal(imported.body.status, "ok");
      const importedWorld = JSON.parse(readFileSync(join(dataDir, "engine", "worlds", imported.body.module.id, "world.json"), "utf-8"));
      assert.equal(importedWorld.mode, mode);
      assert.equal(importedWorld.modeMetadata.dataMode, "worldbook");
    } finally {
      await server.stop();
      await removeTempDir(dataDir);
    }
  });
}
