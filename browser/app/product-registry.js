"use strict";

(function registerWorldTreeProducts(global) {
  const entries = [
    { id: "quick-setting", name: "快速设定", enName: "Quick Setting", category: "creation", maturity: "available", route: "quick-setting", capability: "setting-intake", guidance: "从一段灵感快速建立可继续的世界。", limitation: "轻量创建流程" },
    { id: "character", name: "人物互动", enName: "Character", category: "experience", maturity: "available", route: "character", capability: "character-chat", guidance: "导入或创建角色并持续对话。", limitation: "高级角色编辑器仍在完善" },
    { id: "world-rpg", name: "世界探索", enName: "World RPG", category: "experience", maturity: "recommended", route: "world-rpg", capability: "world-exploration", guidance: "在可保存、可分支的世界中自由探索。", limitation: "世界书高级编辑仍在完善" },
    { id: "tabletop", name: "桌面叙事", enName: "Tabletop", category: "experience", maturity: "early-access", route: "tabletop", capability: "tabletop-loop", guidance: "用场景、判定与时钟推进单人桌面叙事。", limitation: "基础版，不是完整规则系统" },
    { id: "mystery-puzzle", name: "解谜调查", enName: "Mystery Puzzle", category: "experience", maturity: "early-access", route: "mystery-puzzle", capability: "detective-loop", guidance: "调查地点、整理线索并提交推理。", limitation: "基础调查流程" },
    { id: "strategy-sim", name: "策略模拟", enName: "Strategy Sim", category: "experience", maturity: "early-access", route: "strategy-sim", capability: "strategy-loop", guidance: "围绕资源和事件推进轻量策略回合。", limitation: "基础版，不是完整 4X" },
    { id: "murder-mystery", name: "单人剧本杀", enName: "Murder Mystery", category: "experience", maturity: "early-access", route: "murder-mystery", capability: "scriptkill-loop", guidance: "导入自有剧本并与陌生 AI 玩家共同推进。", limitation: "需要用户自有内容" },
    { id: "creation-forge", name: "炼金台", enName: "Creation Forge", category: "creation", maturity: "available", route: "creation-forge", capability: "content-production", guidance: "把素材整理为可预览、可审核、可交付的内容。", limitation: "创作工具，不是普通玩法" }
  ].map(entry => Object.freeze(entry));

  const byId = Object.freeze(Object.fromEntries(entries.map(entry => [entry.id, entry])));
  const api = Object.freeze({
    entries: Object.freeze(entries),
    byId,
    get(id) { return byId[String(id || "")] || null; },
    list(category = "") { return category ? entries.filter(entry => entry.category === category) : [...entries]; },
    assertComplete() {
      const ids = new Set(entries.map(entry => entry.id));
      if (entries.length !== 8 || ids.size !== 8) throw new Error("World Tree must expose exactly 8 canonical entries");
      for (const entry of entries) {
        for (const field of ["id", "name", "category", "maturity", "route", "capability", "guidance", "limitation"]) {
          if (!entry[field]) throw new Error(`Canonical entry ${entry.id || "unknown"} is missing ${field}`);
        }
      }
      return true;
    }
  });
  api.assertComplete();
  global.WorldTreeProductRegistry = api;
})(globalThis);
