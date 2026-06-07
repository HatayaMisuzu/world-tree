import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { MODULES } from "../src/core/engine/modules.js";

const root = resolve(import.meta.dirname, "..");
const outDir = resolve(root, "defaults", "engine-profile", "modules");

const moduleRules = {
  M1: ["所有模组、角色、世界书和写入路径必须隔离。", "任意写入必须位于 _desktop_engine overlay。", "跨模组角色引用需要被守门人标记。"],
  M2: ["每轮扫描玩家输入和场景关键词。", "按 exact/semantic/both 匹配世界书条目。", "按 priority 降序注入，受 context budget 限制。"],
  M3: ["动态状态以变量、事件和因果链记录。", "LLM 变化进入 runtime-overlay，不覆盖原 runtime.json。"],
  M4: ["组织是实体，层级、关系、关键人物需要合并注入。"],
  M5: ["组织层级依赖 M4，关闭 M4 时自动关闭。"],
  M6: ["关系网络依赖 M4，用于冲突、盟友和势力变化。"],
  M7: ["关键人物依赖 M4，不能与 M8 普通角色混淆。"],
  M8: ["角色预设负责人格、状态、表达和场景响应。", "M8 角色不同于 M19 独立角色卡。"],
  M9: ["认知层过滤角色已知/未知/秘密。", "角色不能泄露上帝视角。"],
  M10: ["种族维度依赖组织/世界设定，影响能力和社会关系。"],
  M11: ["场景会话负责当前场景、切换、嵌套和摘要链。"],
  M12: ["故事模板和风格预设影响节奏、语气和叙事结构。"],
  M13: ["叙事按角色层、环境层、剧情层、语气层、记忆层组织。"],
  M15: ["行为可行性要检查物理、魔法、代价和世界规则。"],
  M15c: ["叙事审查非阻塞，记录一致性、节奏、风格和连续性。"],
  M16: ["时间模块记录世界轴和场景级时间推进。"],
  M17: ["随机事件是提案而非强制结果，按权重和场景压力触发。"],
  M18: ["基于当前局势生成 2-3 个可能走向，注入下一轮上下文。"],
  M19: ["角色卡模式中角色直接与 user 互动，DM 隐退。", "M19 关闭世界书提案式 DM 口吻，保留隐性关系和情绪轨道。"],
  "M-创作": ["创作模块服务设定生产，不参与普通运行时。", "用于世界书创作、素材吸收、七步法和提案。"]
};

await mkdir(outDir, { recursive: true });

for (const mod of MODULES) {
  const card = {
    moduleId: mod.id,
    name: mod.name,
    version: "v12.19",
    type: mod.type,
    summary: `${mod.id} ${mod.name} 的 Desktop LLM 适配知识卡。代码层执行可确定逻辑，LLM 层遵守叙事规则和标记段协议。`,
    activatedBy: ["epic", "wuxia", "urban", "campus", "daily", "character_card", "minimal", "all"],
    rules: moduleRules[mod.id] || [`${mod.name} 已在 Desktop 引擎中登记，运行时按激活模块注入。`],
    edgeCases: [
      "解析失败不阻塞叙事，只跳过本轮状态写入。",
      "持久化只进入 _desktop_engine overlay。",
      "用户可在 Power User 中调整模块启停和上下文预算。"
    ],
    referencePath: `engine-knowledge/fulltext/references/${mod.id}.md`
  };
  await writeFile(resolve(outDir, `${mod.id.replace(/[^\w.-]/g, "_")}.json`), JSON.stringify(card, null, 2), "utf8");
}

console.log(`Generated ${MODULES.length} knowledge cards`);
