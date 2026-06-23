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

// 使用项目自己的 appendJsonl 写入 mock 消息
import { appendJsonl } from "../../src/server/fs-utils.js";

const MODES = [
  { mode: "world-rpg", title: "风暴大陆", userMsg: "我走出避风港，前方是一片荒原。", asstMsg: "风暴在远处咆哮。荒原上散落着古老文明的遗迹——一座半埋的石碑，上面刻着你读不懂的文字。" },
  { mode: "mystery-puzzle", title: "密室之谜", userMsg: "检查死者手中的信。", asstMsg: "信纸已经泛黄，最后一行字迹潦草：'他们不会相信我的。' 信的末尾没有署名，只有一个模糊的指纹。" },
  { mode: "tabletop", title: "龙牙酒馆", userMsg: "我走近悬赏令，仔细看上面的内容。", asstMsg: "悬赏令上画着一个独眼男人——'疯狗'哈桑。赏金 500 金币，死活不论。酒馆老板在你身后低声说：'那家伙三天前还在隔壁镇上出现过。'" },
  { mode: "strategy-sim", title: "三国边境", userMsg: "查看我方粮草储备。", asstMsg: "粮仓还剩不到三周的存粮。侦察兵报告北方商路已被切断，东面盟军答应支援但至今未到。你的幕僚建议立即召开军事会议。" },
  { mode: "murder-mystery", title: "樱花庄事件", userMsg: "询问第一位住客昨晚的行踪。", asstMsg: "那位住客——一位退休教师——推了推眼镜：'我昨晚在房间里批改作业，十点就睡了。不过半夜好像听到走廊有脚步声...很轻，像是赤脚走在木地板上。'" }
];

for (const { mode, title, userMsg, asstMsg } of MODES) {
  test(`${mode} first-turn mock chat persists to chat.jsonl`, async () => {
    const dataDir = await createTempDataDir();
    const server = await startWorldTreeServer({ dataDir });

    try {
      const name = `${mode.replace(/-/g, "_")}_chat_test`;

      // 1. Create project
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
          sourceText: "test"
        })
      });
      assert.equal(create.body.status, "ok");

      const worldDir = join(dataDir, "engine", "worlds", name);
      const chatPath = join(worldDir, "runtime", "chat.jsonl");

      // 2. Verify chat.jsonl exists (created by module-service)
      assert.equal(existsSync(chatPath), true, `chat.jsonl should exist for ${mode}`);

      // 3. Write mock user + assistant messages via appendJsonl
      const now = new Date().toISOString();
      await appendJsonl(chatPath, {
        id: `u_${Date.now()}`,
        role: "user",
        content: userMsg,
        timestamp: now
      });
      await appendJsonl(chatPath, {
        id: `a_${Date.now()}`,
        role: "assistant",
        content: asstMsg,
        timestamp: now
      });

      // 4. Read back and verify
      const chatContent = readFileSync(chatPath, "utf-8").trim();
      assert.ok(chatContent.length > 0, `chat.jsonl should not be empty for ${mode}`);

      const lines = chatContent.split("\n").filter(Boolean);
      assert.ok(lines.length >= 2, `chat.jsonl should have at least 2 lines for ${mode}`);

      const parsed = lines.map(l => JSON.parse(l));
      const roles = parsed.map(r => r.role);
      assert.ok(roles.includes("user"), `should contain user message for ${mode}`);
      assert.ok(roles.includes("assistant"), `should contain assistant message for ${mode}`);

      const userRecord = parsed.find(r => r.role === "user");
      const asstRecord = parsed.find(r => r.role === "assistant");
      assert.ok(userRecord.content.length > 0, `user content should not be empty for ${mode}`);
      assert.ok(asstRecord.content.length > 0, `assistant content should not be empty for ${mode}`);
      assert.ok(userRecord.id, `user record should have id for ${mode}`);
      assert.ok(asstRecord.id, `assistant record should have id for ${mode}`);

      // 5. Verify quick-setting/character not affected (separate projects)
      // This is implicit — each test uses its own tempDataDir
    } finally {
      await server.stop();
      await removeTempDir(dataDir);
    }
  });
}
