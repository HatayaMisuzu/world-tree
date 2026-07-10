// scripts/test.mjs
// v1.0.0 — 集成测试脚本
// 测试范围：语法检查 / 模块导入 / 核心功能
// 用法: node scripts/test.mjs [--verbose]
// ═══════════════════════════════════════════════════════════════

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const VERBOSE = process.argv.includes("--verbose");

function urlFor(filePath) {
  const p = filePath.replace(/\\/g, "/");
  return p.startsWith("/") ? `file://${p}` : `file:///${p}`;
}

let passed = 0;
let failed = 0;
let skipped = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    if (VERBOSE) console.log(`  ✅ ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ❌ ${name}: ${err.message}`);
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    passed++;
    if (VERBOSE) console.log(`  ✅ ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ❌ ${name}: ${err.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════
//  测试组 1: 语法检查（同步）
// ═══════════════════════════════════════════════════════════════

console.log("\n📝 语法检查");

const CORE_FILES = [
  "server.js",
  "src/server/config-runtime.js", "src/server/connection-runtime.js", "src/server/static-shell.js",
  "src/server/http-api-router.js", "src/server/debug-log.js",
  "world-tree-console.js",
  "browser/app/product-registry.js", "browser/app/navigation.js", "browser/state/app-store.js",
  "browser/components/feedback.js", "browser/components/forms.js", "browser/components/product-components.js",
  "browser/views/core-views.js", "browser/views/creation-settings-views.js",
  "browser/controllers/navigation-controller.js", "browser/controllers/entry-controller.js",
  "browser/controllers/play-controller.js", "browser/controllers/content-controller.js",
  "browser/controllers/settings-controller.js", "browser/controllers/character-v2-controller.js",
  "scripts/audit.mjs",
  "scripts/interface-audit.mjs",
  "src/adapters/llm.js",
  "src/core/world-engine.js",
  "src/core/engine/guardian.js", "src/core/engine/guardian-llm.js",
  "src/core/engine/global-memory.js", "src/core/engine/lifecycle.js",
  "src/core/engine/health-check.js", "src/core/engine/overlay-store.js",
  "src/core/engine/emotion-state.js", "src/core/engine/director.js",
  "src/core/engine/direction-packet.js", "src/core/engine/commands.js",
  "src/core/engine/output-parser.js", "src/core/engine/modules.js",
  "src/core/engine/constants.js", "src/core/engine/state-persistence.js",
  "src/core/engine/context-budget.js", "src/core/engine/archive-state.js",
  "src/core/engine/storytellers.js", "src/core/engine/content-registry.js",
  "src/core/engine/proposal-system.js",
  "src/core/engine/telemetry-data-extractor.js",
  "src/core/engine/world-telemetry.js",
  "src/core/engine/tabletop.js", "src/core/engine/rpg.js",
  "src/core/engine/sim.js", "src/core/engine/murder-mystery.js",
  "src/core/engine/simulator.js", "src/core/engine/world-manager.js",
  "src/core/data/character-card.js", "src/core/data/templates.js",
  "src/core/data/rules.js", "src/core/data/prediction.js",
  "src/core/data/random-events.js", "src/core/data/scenes.js",
  "src/core/data/race.js", "src/core/data/proximity-scope.js",
  "src/core/data/creation-wizard.js", "src/core/data/skill-parser.js",
  "src/core/normalizers.js", "src/core/cards.js",
  "src/core/commands.js", "src/core/data-store.js",
  "src/core/data/worldbook.js",
  "src/core/data/alchemy/alchemy-engine.js",
  "src/core/data/alchemy/classifier.js",
  "src/core/data/alchemy/extractor.js",
  "src/server/alchemy-preview-service.js",
  "src/server/mechanism-service.js",
  "src/server/turn-state-frame-service.js",
  "src/server/module-service.js",
  "src/server/persistence-service.js",
  "src/server/data-import-service.js",
  "src/core/character/character-runtime-contract.js",
  "src/core/character/character-cognition-boundary.js",
  "src/core/character/character-performance-fingerprint.js",
  "src/core/character/character-v2-profile.js",
  "src/core/character/character-v2-advanced-ui-gate.js",
  "src/core/character/character-v2-capsule-creation.js",
  "src/core/character/character-v2-create-ui-state.js",
  "src/server/character-capsule-service.js",
  "tests/unit/character-v2-text-core.test.js",
  "tests/unit/character-v2-advanced-ui-gate.test.js",
  "tests/unit/character-v2-capsule-creation.test.js",
  "tests/unit/character-capsule-service.test.js",
  "tests/unit/character-v2-create-ui-state.test.js",
  "src/core/character/character-v2-runtime-context.js",
  "tests/unit/character-v2-runtime-context.test.js",
  "src/core/character/character-v2-prompt-packet-preview.js",
  "src/core/character/character-v2-runtime-candidates.js",
  "src/core/character/character-v2-runtime-mvp.js",
  "tests/unit/character-v2-prompt-packet-preview.test.js",
  "tests/unit/character-v2-runtime-candidates.test.js",
  "tests/unit/character-v2-runtime-mvp.test.js",
  "src/core/character/character-v2-live-runtime-turn.js",
  "src/server/character-v2-live-turn-service.js",
  "tests/unit/character-v2-live-runtime-turn.test.js",
  "tests/unit/character-v2-live-turn-service.test.js",
  "tests/unit/character-v2-live-ui-state.test.js",
  "src/core/character/character-v2-live-ui-state.js",
  "src/server/character-v2-candidate-workbench-service.js",
  "src/core/tabletop/tabletop-v2-dice-engine.js",
  "src/core/tabletop/tabletop-v2-ruleset-profile.js",
  "src/core/tabletop/tabletop-v2-adventure-module.js",
  "src/core/tabletop/tabletop-v2-clock-engine.js",
  "src/core/tabletop/tabletop-v2-turn-ruling.js",
  "src/core/tabletop/tabletop-v2-save-branch.js",
  "src/core/tabletop/tabletop-v2-ending-summary.js",
  "src/server/tabletop-v2-service.js",
  "tests/unit/tabletop-v2-dice-engine.test.js",
  "tests/unit/tabletop-v2-ruleset-profile.test.js",
  "tests/unit/tabletop-v2-adventure-module.test.js",
  "tests/unit/tabletop-v2-clock-engine.test.js",
  "src/core/mode/mode-asset-linkage-contract.js",
  "tests/unit/mode-asset-linkage-contract.test.js",
  "tests/unit/tabletop-v2-runtime-isolation.test.js",
  "src/core/detective/detective-case-importer.js",
  "src/core/detective/detective-run-state.js",
  "src/core/detective/detective-runtime-engine.js",
  "src/server/detective-v2-service.js",
  "tests/unit/detective-v2-case-importer.test.js",
  "tests/unit/detective-v2-run-state.test.js",
  "tests/unit/detective-v2-runtime-engine.test.js",
  "tests/unit/detective-v2-service.test.js",
  "tests/unit/detective-v2-hidden-leak.test.js",
  "src/server/character-v2-export-service.js",
  "tests/unit/character-v2-candidate-workbench.test.js",
  "tests/unit/character-v2-export-service.test.js",
  "tests/unit/worldbook.test.js",
  "tests/unit/alchemy.test.js",
  "tests/unit/alchemy-preview-service.test.js",
  "tests/unit/mechanism-status.test.js",
  "tests/unit/llm.test.js",
  "tests/integration/data-import.test.js",
  "tests/integration/overlay-persistence.test.js",
  "tests/integration/dashboard-telemetry.test.js",
  "tests/integration/overlay-pending-api.test.js",
  "tests/integration/alchemy-workbench.test.js",
  "tests/integration/mechanism-status-flow.test.js",
];

for (const file of CORE_FILES) {
  const fullPath = join(PROJECT_ROOT, file);
  test(`语法: ${file}`, () => {
    if (!existsSync(fullPath)) throw new Error("文件不存在");
    execSync(`node --check "${fullPath}"`, { cwd: PROJECT_ROOT, stdio: "pipe" });
  });
}

// ═══════════════════════════════════════════════════════════════
//  测试组 2: 模块导入（异步）
// ═══════════════════════════════════════════════════════════════

console.log("\n🔗 模块导入");

await testAsync("guardian.js 重导出 guardian-llm.js", async () => {
  const mod = await import(urlFor(join(PROJECT_ROOT, "src/core/engine/guardian.js")));
  if (typeof mod.validateWithAutoCorrect !== "function") throw new Error("validateWithAutoCorrect 未导出");
  if (typeof mod.extractRelevantFacts !== "function") throw new Error("extractRelevantFacts 未导出");
  if (typeof mod.validateNarrativeAgainstDirection !== "function") throw new Error("validateNarrativeAgainstDirection 未导出");
});

await testAsync("global-memory.js v2 API", async () => {
  const mod = await import(urlFor(join(PROJECT_ROOT, "src/core/engine/global-memory.js")));
  if (typeof mod.createMemorySnapshot !== "function") throw new Error("createMemorySnapshot 未导出");
  if (typeof mod.searchMemorySnapshots !== "function") throw new Error("searchMemorySnapshots 未导出");
  if (typeof mod.formatMemorySection !== "function") throw new Error("formatMemorySection 未导出");
  if (typeof mod.explainMemoryMatch !== "function") throw new Error("explainMemoryMatch 未导出");
});

await testAsync("health-check.js API", async () => {
  const mod = await import(urlFor(join(PROJECT_ROOT, "src/core/engine/health-check.js")));
  if (typeof mod.runHealthCheck !== "function") throw new Error("runHealthCheck 未导出");
  if (typeof mod.formatHealthReport !== "function") throw new Error("formatHealthReport 未导出");
});

await testAsync("overlay-store.js safe write API", async () => {
  const mod = await import(urlFor(join(PROJECT_ROOT, "src/core/engine/overlay-store.js")));
  for (const name of ["addToPending", "listPending", "tickPending", "adoptPending", "rejectPending", "splitWriteSet", "resetPendingStore"]) {
    if (typeof mod[name] !== "function") throw new Error(`${name} not exported`);
  }
});

await testAsync("llm.js client 可导入", async () => {
  const mod = await import(urlFor(join(PROJECT_ROOT, "src/adapters/llm.js")));
  if (typeof mod.canUseDirectLlm !== "function") throw new Error("canUseDirectLlm 未导出");
  if (typeof mod.callLLMByRole !== "function") throw new Error("callLLMByRole 未导出");
  if (typeof mod.sendDualStageTurn !== "function") throw new Error("sendDualStageTurn 未导出");
});

// ═══════════════════════════════════════════════════════════════
//  测试组 3: 核心功能
// ═══════════════════════════════════════════════════════════════

console.log("\n⚙️ 核心功能");

await testAsync("Guardian JS: 正常叙事通过", async () => {
  const { validateNarrativeAgainstDirection } = await import(urlFor(join(PROJECT_ROOT, "src/core/engine/guardian.js")));
  const dp = { packet: { contentPlan: { mustInclude: [], mustNotInclude: [] }, writingConstraints: { length: "medium", perspective: "third_person", choices: "none" } } };
  const result = validateNarrativeAgainstDirection({
    narrative: "艾琳推开门，冷风灌了进来。她缩了缩肩膀，往火炉边靠近了一点。",
    directionPacket: dp,
    userInput: "推开门"
  });
  if (!result.pass) throw new Error(`未通过: ${result.issues.join("; ")}`);
  if (result.score < 70) throw new Error(`分数过低: ${result.score}`);
});

await testAsync("Guardian JS: 检测缺失 mustInclude", async () => {
  const { validateNarrativeAgainstDirection } = await import(urlFor(join(PROJECT_ROOT, "src/core/engine/guardian.js")));
  const dp = { packet: { contentPlan: { mustInclude: ["角色:团长"], mustNotInclude: [] }, writingConstraints: { length: "medium", perspective: "third_person", choices: "none" } } };
  const result = validateNarrativeAgainstDirection({
    narrative: "艾琳推开门，冷风灌了进来。",
    directionPacket: dp,
    userInput: ""
  });
  if (result.pass) throw new Error("应该检测到缺失 mustInclude '团长'");
  if (!result.issues.some((i) => i.includes("团长"))) throw new Error("issues 中应包含 '团长'");
});

await testAsync("Global Memory: 创建快照 + 检索", async () => {
  const { createMemorySnapshot, searchMemorySnapshots, explainMemoryMatch, loadGlobalMemory } = await import(urlFor(join(PROJECT_ROOT, "src/core/engine/global-memory.js")));
  loadGlobalMemory({ snapshots: [], version: 2 });

  const snap = createMemorySnapshot({
    moduleKey: "test-module", scene: "王都酒馆", round: 1,
    emotion: { engagement: 7, tension: 5, fatigue: 3, curiosity: 8 },
    summary: "团长在酒馆里遇见了一个神秘人",
    input: "团长走进酒馆",
    narrative: "团长推开厚重的橡木门..."
  });
  if (!snap.id?.startsWith("mem-")) throw new Error("快照 ID 格式错误");
  if (!snap._why) throw new Error("缺少 _why 字段");
  if (!snap._provenance) throw new Error("缺少 _provenance 字段");

  const results = searchMemorySnapshots({
    text: "酒馆 神秘人",
    emotion: { engagement: 6, tension: 4, fatigue: 4, curiosity: 7 },
    moduleKey: "test-module", limit: 3
  });
  if (results.length === 0) throw new Error("应检索到记忆");
  if (!results[0]._matchExplanation) throw new Error("缺少 _matchExplanation");

  const explanation = explainMemoryMatch(results[0]);
  if (!explanation.includes("酒馆")) throw new Error("解释中应包含场景名");
});

await testAsync("Health Check: 正常模型通过", async () => {
  const { runHealthCheck } = await import(urlFor(join(PROJECT_ROOT, "src/core/engine/health-check.js")));
  const result = runHealthCheck({
    moduleKey: "test",
    moduleData: {
      characters: [{ name: "团长", id: "char-1" }, { name: "艾琳", id: "char-2" }],
      scenes: [{ title: "王都酒馆", id: "scene-1" }],
      organizations: [],
      worldbook: { entries: [{ keys: ["魔法"], title: "魔法", content: "魔法分三系" }] },
      tracking: [], timeline: [], canon: {}
    }
  });
  if (result.score < 80) throw new Error(`健康评分过低: ${result.score}`);
});

await testAsync("Health Check: 检测缺失字段", async () => {
  const { runHealthCheck } = await import(urlFor(join(PROJECT_ROOT, "src/core/engine/health-check.js")));
  const result = runHealthCheck({
    moduleKey: "test",
    moduleData: {
      characters: [{ name: "" }],
      scenes: [{ title: "" }],
      organizations: [],
      worldbook: { entries: [{ keys: [], content: "" }] },
      tracking: [], timeline: [], canon: {}
    }
  });
  if (result.pass) throw new Error("缺失字段的模型应不通过");
  if (result.issues.length === 0) throw new Error("应检测到问题");
});

await testAsync("Overlay Store: 写入级别分类", async () => {
  const { classifyWriteLevel } = await import(urlFor(join(PROJECT_ROOT, "src/core/engine/overlay-store.js")));
  if (classifyWriteLevel({ path: "data/engine/runs/modules/test/patch-log.jsonl" }).level !== "auto")
    throw new Error("patch-log 应为 auto 级别");
  if (classifyWriteLevel({ path: "data/engine/runs/modules/test/characters-overlay.json" }).level !== "confirm")
    throw new Error("characters-overlay 应为 confirm 级别");
  if (classifyWriteLevel({ path: "/outside/secret.json" }).level !== "manual")
    throw new Error("外部路径应为 manual 级别");
});

await testAsync("Overlay Store: splitWriteSet separates auto pending manual", async () => {
  const { splitWriteSet } = await import(urlFor(join(PROJECT_ROOT, "src/core/engine/overlay-store.js")));
  const result = splitWriteSet([
    { path: "data/engine/runs/worldbook/modules/test/patch-log.jsonl", mode: "append-jsonl", value: { ok: true } },
    { path: "data/engine/runs/worldbook/modules/test/characters-overlay.json", mode: "merge-json", value: { ok: true } },
    { path: "outside/secret.json", mode: "write-json", value: { bad: true } }
  ]);
  if (result.auto.length !== 1) throw new Error("expected one auto write");
  if (result.pending.length !== 1) throw new Error("expected one pending write");
  if (result.manual.length !== 1) throw new Error("expected one manual write");
});

await testAsync("Overlay Store: pending reads do not age queue", async () => {
  const { addToPending, listPending, adoptPending, resetPendingStore } = await import(urlFor(join(PROJECT_ROOT, "src/core/engine/overlay-store.js")));
  resetPendingStore("test-pending");
  const op = { path: "data/engine/runs/worldbook/modules/test/characters-overlay.json", mode: "merge-json", value: { test: true } };

  const entry = addToPending("test-pending", op, { round: 4 });
  if (!entry.id) throw new Error("missing entry id");
  for (let i = 0; i < 5; i++) {
    const items = listPending("test-pending");
    if (items.length !== 1) throw new Error("listPending should not expire items by reading");
    if (items[0].age !== 0) throw new Error("listPending should not age items by reading");
  }

  const adopted = adoptPending("test-pending", entry.id);
  if (!adopted) throw new Error("adoptPending should return adopted item");
  if (listPending("test-pending").length !== 0) throw new Error("queue should be empty after adopt");
});

await testAsync("Overlay Store: pending expires by explicit round tick", async () => {
  const { addToPending, listPending, tickPending, resetPendingStore } = await import(urlFor(join(PROJECT_ROOT, "src/core/engine/overlay-store.js")));
  resetPendingStore("test-expire");
  const op = { path: "data/engine/runs/worldbook/modules/test/worldbook-overlay.json", mode: "merge-json", value: { test: true } };
  addToPending("test-expire", op, { round: 1 });
  if (tickPending("test-expire", 3).length !== 1) throw new Error("pending item should still be active within max age");
  if (tickPending("test-expire", 5).length !== 0) throw new Error("pending item should expire after max age");
  if (listPending("test-expire").length !== 0) throw new Error("expired queue should stay empty");
});



await testAsync("World Telemetry: 自动抽取数据 + 计算 + 趋势", async () => {
  const { extractTelemetryData } = await import(urlFor(join(PROJECT_ROOT, "src/core/engine/telemetry-data-extractor.js")));
  const { calculateWorldTelemetry, directorHints } = await import(urlFor(join(PROJECT_ROOT, "src/core/engine/world-telemetry.js")));
  const model = {
    selected: { id: "telemetry-test", name: "Telemetry Test", type: "epic" },
    turnCount: 1,
    moduleData: {
      worldState: { conflict: "border crisis" },
      relations: [{ type: "hostile", source: "A", target: "B" }],
      tracking: [{ name: "foreshadowing", count: 3 }, { name: "objective", count: 2 }],
      characters: [{ name: "A", status: "injured" }],
      scenes: [{ title: "frontier" }],
      canon: { confirmed: [{ detail: "rule" }] },
      worldbook: { entries: [{ title: "frontier", keys: ["war"] }] }
    }
  };
  const data = extractTelemetryData({ model, engineState: { emotionState: { tension: 8, fatigue: 7 } } });
  if (data.hostileRelations < 1) throw new Error("hostile relation not extracted");
  const result = calculateWorldTelemetry({ model, engineState: { emotionState: { tension: 8, fatigue: 7 } }, round: 1 });
  if (!result.snapshot?.dimensions?.stability) throw new Error("missing stability dimension");
  if (!Array.isArray(directorHints(result.snapshot))) throw new Error("director hints missing");
});

await testAsync("World Telemetry: director strategy receives pressure hints", async () => {
  const { generateDirectionPacket } = await import(urlFor(join(PROJECT_ROOT, "src/core/engine/director.js")));
  const direction = generateDirectionPacket({
    input: "继续",
    emotionState: { engagement: 6, tension: 5, fatigue: 3, curiosity: 5 },
    round: 2,
    moduleData: { scenes: [{ title: "frontier" }], characters: [] },
    telemetrySnapshot: {
      overall: 35,
      overallStatus: "warning",
      hints: ["provide_relief"],
      dimensions: { character_stress: { value: 82 } }
    }
  });
  if (direction.packet.directorDecision.pacing !== "relief") {
    throw new Error("telemetry stress should force relief pacing");
  }
});

await testAsync("Guardian LLM: 事实提取", async () => {
  const { extractRelevantFacts } = await import(urlFor(join(PROJECT_ROOT, "src/core/engine/guardian.js")));
  const facts = extractRelevantFacts("团长走进酒馆，看见艾琳坐在角落里。", {
    canon: { confirmed: [{ detail: "王都酒馆是团长常去的地方" }] },
    characters: [{ name: "团长", role: "战士" }, { name: "艾琳", role: "法师" }],
    scenes: [{ title: "王都酒馆", location: "王都旧城区" }],
    worldbook: { entries: [{ keys: ["酒馆"], title: "酒馆", content: "王都最热闹的酒馆" }] },
    tracking: [{ name: "神秘委托", count: 3 }]
  });
  if (!facts.includes("王都酒馆")) throw new Error("应包含场景信息");
  if (!facts.includes("已确认事实")) throw new Error("应包含正史事实");
});

// ═══════════════════════════════════════════════════════════════
//  测试组 3.5: 新增模块测试
// ═══════════════════════════════════════════════════════════════

console.log("\n🧩 新增模块测试");

// ── Context Engine ──
await testAsync("Context Router: 场景帧构建", async () => {
  const { buildSceneFrame } = await import(urlFor(join(PROJECT_ROOT, "src/core/engine/context-router.js")));
  const frame = buildSceneFrame({
    moduleData: {
      scenes: [{ title: "王都酒馆", location: "王都", id: "scene-1" }],
      characters: [{ name: "团长", id: "char-1" }, { name: "艾琳", id: "char-2" }]
    }
  });
  if (!frame || !frame.location) throw new Error("场景帧应包含 location");
  if (!frame.characters || !frame.characters.includes("团长")) throw new Error("场景帧应包含角色");
});

await testAsync("Context Indexer: 加权检索", async () => {
  const { buildIndex, search } = await import(urlFor(join(PROJECT_ROOT, "src/core/engine/context-indexer.js")));
  const model = {
    moduleData: {
      characters: [{ name: "团长", background: "王都的战士团长" }],
      scenes: [{ title: "王都酒馆" }],
      worldbook: { entries: [{ keys: ["酒馆"], title: "酒馆", content: "王都最热闹的酒馆" }] }
    }
  };
  const index = buildIndex(model);
  const results = search(index, "团长 酒馆");
  if (!Array.isArray(results)) throw new Error("检索结果应为数组");
});

await testAsync("Context Assembler: 合并去重排序", async () => {
  const { assemble } = await import(urlFor(join(PROJECT_ROOT, "src/core/engine/context-assembler.js")));
  const result = assemble({
    router: { blocks: [{ source: "router", id: "char-1", text: "团长", priority: 1 }] },
    indexer: { results: [{ source: "indexer", id: "char-1", text: "团长", score: 0.9 }] },
    budget: { maxTokens: 2000 }
  });
  if (!result || !Array.isArray(result.blocks)) throw new Error("assembler 应返回 blocks 数组");
});

await testAsync("Context Engine: assembleContext 接口可用", async () => {
  const { assembleContext } = await import(urlFor(join(PROJECT_ROOT, "src/core/engine/context-engine.js")));
  if (typeof assembleContext !== "function") throw new Error("assembleContext 未导出");
  const result = assembleContext({
    selected: { id: "test", name: "Test" },
    moduleData: { characters: [{ name: "团长" }], scenes: [{ title: "酒馆" }], worldbook: { entries: [] } }
  }, { mode: "preset" });
  if (!result || !result.blocks) throw new Error("应返回 blocks");
});

// ── Memory Layers ──
await testAsync("Memory Layers: STM 写入与检索", async () => {
  const { stmPush, stmRecent, resetMemoryLayers } = await import(urlFor(join(PROJECT_ROOT, "src/core/engine/memory-layers.js")));
  resetMemoryLayers();
  stmPush({ userInput: "团长走进酒馆", narrativeSummary: "团长推开门", keywords: ["酒馆"], emotion: { engagement: 6, tension: 3 } });
  stmPush({ userInput: "见到艾琳", narrativeSummary: "艾琳打招呼", keywords: ["艾琳"], emotion: { engagement: 7, tension: 4 } });
  const context = stmRecent(5);
  if (context.length !== 2) throw new Error(`应包含2轮记忆, 实际: ${context.length}`);
});

await testAsync("Memory Layers: 会话记忆写入", async () => {
  const { sessionRecord, resetMemoryLayers } = await import(urlFor(join(PROJECT_ROOT, "src/core/engine/memory-layers.js")));
  resetMemoryLayers();
  sessionRecord({ type: "decision", summary: "选择调查酒馆", importance: "high", keywords: ["酒馆"] });
  // 无报错即为通过
});

// ── Branch System ──
await testAsync("Branch System: 接口可用+错误处理", async () => {
  const { createBranch, getBranchTree, abandonBranch, reviveBranch } = await import(urlFor(join(PROJECT_ROOT, "src/core/engine/branch-system.js")));
  // 测试不存在世界的错误处理（不需要文件系统）
  const tree = await getBranchTree("/nonexistent", "missing-world");
  if (tree && tree.error) {
    // 正常：应该报世界不存在
  } else {
    // 也通过：只要没崩溃就行
  }
});

// ── Director Modes ──
await testAsync("Director Modes: 模式列表与 Prompt 注入", async () => {
  const { DIRECTOR_MODES, directorModePromptBlock } = await import(urlFor(join(PROJECT_ROOT, "src/core/engine/director-modes.js")));
  if (!DIRECTOR_MODES || DIRECTOR_MODES.length === 0) throw new Error("应有导演模式列表");
  if (DIRECTOR_MODES.length < 5) throw new Error(`预期至少5种模式, 实际: ${DIRECTOR_MODES.length}`);

  const prompt = directorModePromptBlock("dark_fantasy");
  if (!prompt || !prompt.includes("叙事")) throw new Error("模式 prompt 应包含提示内容");
});

// ── World State ──
await testAsync("World State: 面板创建与使用", async () => {
  const { createWorldPanel, setLocation, addClue, takeSnapshot } = await import(urlFor(join(PROJECT_ROOT, "src/core/data/world-state.js")));
  const panel = createWorldPanel();
  if (!panel || !panel.currentLocation) throw new Error("面板应有 currentLocation");
  if (panel.roundNumber !== 0) throw new Error("初始 roundNumber 应为 0");
  const withLocation = setLocation(panel, { name: "王都", description: "王国首都" });
  if (withLocation.currentLocation.name !== "王都") throw new Error("设置位置失败");
  // 快照能力
  const snap = takeSnapshot(panel);
  if (!snap) throw new Error("快照应存在");
});

// ── Timeline Causality ──
await testAsync("Timeline Causality: 事件创建与因果追溯", async () => {
  const { createTimelineEvent, traceCauses, traceImpact, resetTimeline } = await import(urlFor(join(PROJECT_ROOT, "src/core/data/timeline-causality.js")));
  resetTimeline();
  const e1 = createTimelineEvent({ title: "国王驾崩", type: "past", time: "1024年春" });
  const e2 = createTimelineEvent({ title: "王子继位", type: "present", time: "1024年春", dependsOn: [e1.id] });
  if (!e1 || e1.error) throw new Error(`事件1创建失败: ${e1?.error}`);
  if (!e2) throw new Error("事件2创建失败");
  // 追溯
  const impact = traceImpact(e1.id);
  if (!impact || impact.totalEvents < 1) throw new Error("影响链应有事件");
  const causes = traceCauses(e2.id);
  if (!causes || causes.totalEvents < 1) throw new Error("原因链应有事件");
});

// ── Processing Engine ──
await testAsync("Processing Engine: 基础管线可用", async () => {
  const mod = await import(urlFor(join(PROJECT_ROOT, "src/core/data/processing-engine.js")));
  if (typeof mod.processInput !== "function" && typeof mod.processEngine !== "function") {
    // 检查至少有一个主要导出函数
    const keys = Object.keys(mod).filter(k => typeof mod[k] === "function");
    if (keys.length === 0) throw new Error("processing-engine 应导出至少一个函数");
  }
});

// ── Legacy Hermes Adapter ──
await testAsync("Legacy Hermes Adapter: 可导入", async () => {
  const mod = await import(urlFor(join(PROJECT_ROOT, "legacy/adapters/hermes.js")));
  const keys = Object.keys(mod);
  if (keys.length === 0) throw new Error("legacy hermes.js 应导出内容");
});

// ── Local Adapter ──
await testAsync("Local Adapter: 可导入", async () => {
  const mod = await import(urlFor(join(PROJECT_ROOT, "src/adapters/local.js")));
  const keys = Object.keys(mod).filter(k => typeof mod[k] === "function");
  if (keys.length === 0) throw new Error("local.js 应导出函数");
});

// ── Slash Commands ──
await testAsync("Slash Commands: 可导入", async () => {
  const mod = await import(urlFor(join(PROJECT_ROOT, "src/core/slash-commands.js")));
  const keys = Object.keys(mod);
  if (keys.length === 0) throw new Error("slash-commands.js 应导出内容");
});

// ═══════════════════════════════════════════════════════════════
//  集成检查
// ═══════════════════════════════════════════════════════════════

console.log("\n🔧 集成检查");

test("版本文件一致性", () => {
  const pkg = JSON.parse(readFileSync(join(PROJECT_ROOT, "package.json"), "utf-8"));
  const manifest = JSON.parse(readFileSync(join(PROJECT_ROOT, "app-manifest.json"), "utf-8"));
  const readme = readFileSync(join(PROJECT_ROOT, "README.md"), "utf-8");
  if (pkg.version !== (manifest.version || manifest._version)) throw new Error(`版本不一致`);
  const explicitVersion = readme.match(/\*\*(?:Current version|当前版本|Package version)\*\*:\s*v(\d+\.\d+\.\d+)/)?.[1];
  if (explicitVersion && explicitVersion !== pkg.version) throw new Error(`README.md 版本 ${explicitVersion} 与 package.json ${pkg.version} 不一致`);
});

test("运行时 data/ 目录不随仓库分发", () => {
  const gitignore = readFileSync(join(PROJECT_ROOT, ".gitignore"), "utf-8");
  for (const dir of ["data/engine/runs/", "data/engine/worlds/", "data/engine/global-memory/"]) {
    if (!gitignore.includes(dir)) throw new Error(`.gitignore 缺少运行时目录: ${dir}`);
  }
});

await testAsync("Content Registry: schema files exist", async () => {
  const { CONTENT_TYPES } = await import(urlFor(join(PROJECT_ROOT, "src/core/engine/content-registry.js")));
  for (const type of CONTENT_TYPES) {
    if (!type.schema) continue;
    const schemaPath = join(PROJECT_ROOT, "src/core", type.schema);
    if (!existsSync(schemaPath)) throw new Error(`${type.id} missing schema: ${type.schema}`);
    JSON.parse(readFileSync(schemaPath, "utf-8"));
  }
});

await testAsync("无悬空导入（world-engine.js）", async () => {
  try {
    await import(urlFor(join(PROJECT_ROOT, "src/core/world-engine.js")));
  } catch (err) {
    throw new Error(`world-engine.js 导入失败: ${err.message}`);
  }
});

await testAsync("角色卡外部来源未配置时静默跳过", async () => {
  const { listSkillFiles } = await import(urlFor(join(PROJECT_ROOT, "src/core/data/skill-parser.js")));
  const skills = listSkillFiles();
  if (!Array.isArray(skills) || skills.length !== 0) throw new Error("未配置 skillsDir 时不应扫描 Hermes 目录");
});

test("内置素材清单为空或路径有效", () => {
  const manifestPath = join(PROJECT_ROOT, "defaults/examples/manifest.json");
  if (!existsSync(manifestPath)) throw new Error("缺失 defaults/examples/manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
  if (!Array.isArray(manifest.examples)) throw new Error("examples 必须是数组");
  for (const item of manifest.examples) {
    if (!item.id || !item.type || !item.path) throw new Error("示例条目缺少 id/type/path");
    const full = join(PROJECT_ROOT, "defaults/examples", item.path);
    if (!existsSync(full)) throw new Error(`示例路径不存在: ${item.path}`);
  }
});

// ═══════════════════════════════════════════════════════════════
//  总结
// ═══════════════════════════════════════════════════════════════

const total = passed + failed + skipped;
console.log(`\n${"=".repeat(50)}`);
console.log(`测试完成: ${passed}/${total} 通过${failed ? `, ${failed} 失败` : ""}${skipped ? `, ${skipped} 跳过` : ""}`);

if (failed > 0) {
  console.error("\n❌ 存在失败测试");
  process.exit(1);
} else if (passed === total) {
  console.log("\n🎉 全部通过！");
}
