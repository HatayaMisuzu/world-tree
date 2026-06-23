import { MODULE_STATUS, normalizeModuleDefinition } from "./module-contract.js";

const STANDARD_WRAPPER_HOOKS = ["buildContext", "buildPromptBlock", "getDebugInfo"];

function define(id, legacyId, name, category, status, sourceFiles, capabilities, usedByModes, dependsOn = [], notes = "") {
  const definition = normalizeModuleDefinition({ id, legacyId, name, category, status, sourceFiles, capabilities, usedByModes, dependsOn, notes });
  return Object.freeze({
    ...definition,
    sourceFiles: Object.freeze(definition.sourceFiles),
    capabilities: Object.freeze(definition.capabilities),
    usedByModes: Object.freeze(definition.usedByModes),
    dependsOn: Object.freeze(definition.dependsOn)
  });
}

const entries = [
  define("core.world_container", "M1", "世界书隔离容器", "core", MODULE_STATUS.LEGACY_WRAPPED,
    ["src/core/world-engine.js", "src/core/data-store.js", "src/core/engine/world-manager.js", "src/core/modules/wrappers/core-world-container.wrapper.js"], ["isolateWorld", "loadWorld", "manageWorld", ...STANDARD_WRAPPER_HOOKS],
    ["quick-setting", "character", "tabletop", "mystery-puzzle", "world-rpg", "strategy-sim", "creation-forge"], [], "旧 M1。P1 wrapper 提供只读容器摘要；现有运行编排保持不变。"),
  define("lore.worldbook_trigger", "M2", "触发式条目系统", "lore", MODULE_STATUS.LEGACY_WRAPPED,
    ["src/core/data/worldbook.js", "src/core/runtime/worldbook-runtime.js", "src/core/modules/wrappers/lore-worldbook-trigger.wrapper.js"], ["matchEntries", "prepareWorldbookInjection", "diagnostics", ...STANDARD_WRAPPER_HOOKS],
    ["quick-setting", "tabletop", "world-rpg", "creation-forge"], ["core.world_container"], "旧 M2。已有明确的匹配和注入 API。"),
  define("core.dynamic_state", "M3", "动态世界状态", "core", MODULE_STATUS.LEGACY_WRAPPED,
    ["src/core/data/world-state.js", "src/core/engine/state-persistence.js", "src/core/modules/wrappers/core-dynamic-state.wrapper.js"], ["createWorldPanel", "takeSnapshot", "persistState", ...STANDARD_WRAPPER_HOOKS],
    ["quick-setting", "character", "tabletop", "mystery-puzzle", "world-rpg", "strategy-sim", "creation-forge"], ["core.world_container"], "旧 M3。状态能力已有函数边界，运行编排仍沿用旧生命周期。"),
  define("entity.organization", "M4", "组织实体", "entity", MODULE_STATUS.LEGACY_WRAPPED,
    ["src/core/data/organizations.js"], ["normalizeOrganizations", "organizationSummary"], ["strategy-sim"], ["core.world_container"], "旧 M4。"),
  define("entity.organization_hierarchy", "M5", "组织层级", "entity", MODULE_STATUS.LEGACY_INLINE,
    ["src/core/data/organizations.js", "src/core/schemas/organization.schema.json"], ["representHierarchy"], ["strategy-sim"], ["entity.organization"], "旧 M5。层级数据存在，但尚无独立调用边界。"),
  define("entity.relationship_network", "M6", "关系网络", "entity", MODULE_STATUS.LEGACY_WRAPPED,
    ["src/core/data/relations.js"], ["setRelation", "getRelationGraph", "networkSummary"], ["world-rpg", "strategy-sim"], ["entity.organization"], "旧 M6。"),
  define("entity.key_character", "M7", "关键人物", "entity", MODULE_STATUS.LEGACY_INLINE,
    ["src/core/data/characters.js", "src/core/data/character-card.js"], ["normalizeCharacterState", "characterSnapshot"], ["world-rpg"], ["entity.organization"], "旧 M7。人物数据能力存在，关键人物编排仍在运行时内联。"),
  define("character.preset", "M8", "角色预设系统", "character", MODULE_STATUS.LEGACY_WRAPPED,
    ["src/core/data/character-card.js", "src/core/data/templates.js", "src/core/modules/wrappers/character-preset.wrapper.js"], ["parseCharacterCard", "characterCardMode", "presetSummary", ...STANDARD_WRAPPER_HOOKS], ["character", "murder-mystery", "world-rpg", "creation-forge"], ["core.world_container"], "旧 M8。P1 wrapper 提供只读角色预设摘要。"),
  define("character.cognition", "M9", "角色认知层", "character", MODULE_STATUS.LEGACY_WRAPPED,
    ["src/core/data/cognition.js", "src/core/data/character-card.js", "src/core/modules/wrappers/character-cognition.wrapper.js"], ["filterKnownFacts", "cognitionBoundary", "cardCognitionModel", ...STANDARD_WRAPPER_HOOKS], ["character", "world-rpg", "creation-forge"], ["core.dynamic_state", "character.preset"], "旧 M9。P1 wrapper 复用人格层与情绪梯度解析。"),
  define("lore.race_dimension", "M10", "种族维度", "lore", MODULE_STATUS.LEGACY_WRAPPED,
    ["src/core/data/race.js"], ["normalizeRaces", "raceSummary", "detectRacialTension"], [], ["entity.organization"], "旧 M10。当前 8 个默认 mode 映射未直接声明它。"),
  define("scene.session", "M11", "场景会话管理", "scene", MODULE_STATUS.LEGACY_WRAPPED,
    ["src/core/data/scenes.js", "src/core/engine/context-router.js", "src/core/modules/wrappers/scene-session.wrapper.js"], ["addScene", "getContextWindow", "buildSceneFrame", ...STANDARD_WRAPPER_HOOKS], ["quick-setting", "character", "tabletop", "mystery-puzzle", "world-rpg"], ["core.world_container"], "旧 M11。P1 wrapper 提供只读场景会话摘要。"),
  define("narrative.story_template", "M12", "故事模板", "narrative", MODULE_STATUS.LEGACY_WRAPPED,
    ["src/core/data/templates.js"], ["presetSummary", "styleInstruction"], ["quick-setting", "world-rpg"], ["scene.session"], "旧 M12。"),
  define("narrative.five_layer_engine", "M13", "叙事引擎五层", "narrative", MODULE_STATUS.LEGACY_INLINE,
    ["src/core/world-engine.js", "src/core/engine/lifecycle.js", "src/core/engine/director.js"], ["prepareNarrative", "completeNarrative", "directNarrative"], ["quick-setting", "world-rpg"], ["character.preset", "scene.session"], "旧 M13。能力由多个运行时层共同完成，尚未封装成单模块。"),
  define("rule.world_rule", "M15", "世界规则", "rule", MODULE_STATUS.LEGACY_WRAPPED,
    ["src/core/data/rules.js", "src/core/engine/guardian.js"], ["checkFeasibility", "checkWorldviewConflict", "checkPowerSystem"], ["tabletop", "mystery-puzzle", "world-rpg"], ["core.world_container"], "旧 M15。"),
  define("audit.narrative_quality", "M15c", "叙事质量审查", "audit", MODULE_STATUS.LEGACY_WRAPPED,
    ["src/core/data/rules.js", "src/core/engine/guardian.js", "src/core/engine/guardian-llm.js", "src/core/modules/wrappers/audit-narrative-quality.wrapper.js"], ["auditNarrative", "runFullGuardian", "validateWithAutoCorrect", ...STANDARD_WRAPPER_HOOKS, "validateOutput"], ["quick-setting", "character", "tabletop", "mystery-puzzle", "world-rpg", "strategy-sim", "creation-forge"], ["narrative.five_layer_engine"], "旧 M15c。P1 wrapper 可旁路调用 auditNarrative，不接管 Guardian。"),
  define("time.timeline", "M16", "时间模块", "time", MODULE_STATUS.LEGACY_WRAPPED,
    ["src/core/data/timeline.js", "src/core/data/timeline-causality.js"], ["createTimelineEvent", "traceCauses", "traceImpact"], ["tabletop", "world-rpg", "strategy-sim"], ["scene.session"], "旧 M16。"),
  define("event.random_event", "M17", "随机性模块", "event", MODULE_STATUS.LEGACY_WRAPPED,
    ["src/core/data/random-events.js"], ["eventChance", "proposeRandomEvent", "getEventHistory"], ["tabletop", "world-rpg", "strategy-sim"], ["scene.session"], "旧 M17。"),
  define("prediction.scene_direction", "M18", "场景走向预测", "prediction", MODULE_STATUS.LEGACY_WRAPPED,
    ["src/core/data/prediction.js", "src/core/engine/direction-packet.js"], ["predictScene", "buildDirectionPacket"], ["tabletop", "world-rpg"], ["scene.session", "narrative.five_layer_engine"], "旧 M18。"),
  define("character.card_runtime", "M19", "角色卡驱动模式", "character", MODULE_STATUS.LEGACY_WRAPPED,
    ["src/core/data/character-card.js", "src/core/world-engine.js", "src/core/modules/wrappers/character-card-runtime.wrapper.js"], ["parseCharacterCard", "characterCardMode", "cardModeNarrativeHint", ...STANDARD_WRAPPER_HOOKS], ["character"], ["core.world_container", "character.preset", "character.cognition", "scene.session", "narrative.five_layer_engine"], "旧 M19。P1 wrapper 复用人物卡检测、解析与叙事提示摘要。"),
  define("creation.alchemy", "M-创作", "世界书创作炼金台", "creation", MODULE_STATUS.LEGACY_WRAPPED,
    ["src/core/data/alchemy/alchemy-engine.js", "src/server/alchemy-preview-service.js", "src/core/modules/wrappers/creation-alchemy.wrapper.js"], ["detectFormat", "importFile", "previewImport", ...STANDARD_WRAPPER_HOOKS], ["creation-forge"], ["core.world_container"], "旧 M-创作。P1 wrapper 只读检测素材格式并声明审核边界，不执行导入。"),

  define("core.memory", null, "分层记忆", "core", MODULE_STATUS.DECLARED_ONLY, ["src/core/engine/memory-layers.js"], ["memoryLayerAdapter"], [], [], "现有实现尚未接入新 registry，先保守登记。"),
  define("core.review", null, "运行审查", "core", MODULE_STATUS.DECLARED_ONLY, [], ["reviewRun"], [], [], "未来能力声明。"),
  define("core.canon", null, "Canon / Inference / Proposal 分层", "core", MODULE_STATUS.DECLARED_ONLY, [], ["classifyFactAuthority"], [], [], "未来能力声明。"),
  define("core.debug", null, "模块调试信息", "core", MODULE_STATUS.DECLARED_ONLY, [], ["getDebugInfo"], [], [], "未来能力声明。"),
  define("trpg.dice", null, "跑团骰子", "trpg", MODULE_STATUS.PROTOTYPE_HIDDEN, ["src/core/engine/tabletop.js"], ["rollDice"], ["tabletop"], [], "隐藏跑团原型能力。"),
  define("trpg.check", null, "跑团检定", "trpg", MODULE_STATUS.PROTOTYPE_HIDDEN, ["src/core/engine/tabletop.js"], ["performCheck"], ["tabletop"], ["trpg.dice"], "隐藏跑团原型能力。"),
  define("trpg.character_sheet", null, "跑团角色卡", "trpg", MODULE_STATUS.PROTOTYPE_HIDDEN, ["src/core/engine/tabletop.js"], ["createCharacterSheet"], ["tabletop"], [], "隐藏跑团原型能力。"),
  define("trpg.clock", null, "跑团进度钟", "trpg", MODULE_STATUS.DECLARED_ONLY, [], ["advanceClock"], ["tabletop"], [], "未来能力声明。"),
  define("rpg.quest", null, "任务系统", "rpg", MODULE_STATUS.PROTOTYPE_HIDDEN, ["src/core/engine/rpg.js"], ["createQuest", "questJournal"], ["world-rpg"], [], "隐藏 RPG 原型能力。"),
  define("rpg.bond", null, "羁绊系统", "rpg", MODULE_STATUS.PROTOTYPE_HIDDEN, ["src/core/engine/rpg.js"], ["createBond", "bondStatus"], ["world-rpg"], ["character.preset"], "隐藏 RPG 原型能力。"),
  define("rpg.chapter", null, "章节系统", "rpg", MODULE_STATUS.PROTOTYPE_HIDDEN, ["src/core/engine/rpg.js"], ["createChapter", "chapterProgress"], ["world-rpg"], ["rpg.quest"], "隐藏 RPG 原型能力。"),
  define("rpg.growth", null, "成长系统", "rpg", MODULE_STATUS.DECLARED_ONLY, [], ["applyGrowth"], ["world-rpg"], ["rpg.chapter"], "未来能力声明。"),
  define("mystery.case", null, "案件系统", "mystery", MODULE_STATUS.PROTOTYPE_HIDDEN, ["src/core/engine/murder-mystery.js"], ["loadCase", "createGameState"], ["murder-mystery"], [], "隐藏剧本杀原型能力。"),
  define("mystery.phase", null, "案件阶段", "mystery", MODULE_STATUS.PROTOTYPE_HIDDEN, ["src/core/engine/murder-mystery.js"], ["advancePhase", "getPhaseInfo"], ["murder-mystery"], ["mystery.case"], "隐藏剧本杀原型能力。"),
  define("mystery.clue", null, "线索系统", "mystery", MODULE_STATUS.PROTOTYPE_HIDDEN, ["src/core/engine/murder-mystery.js"], ["investigate", "getRevealedClues"], ["murder-mystery", "mystery-puzzle"], ["mystery.case"], "隐藏剧本杀原型能力。"),
  define("mystery.testimony", null, "证词系统", "mystery", MODULE_STATUS.PROTOTYPE_HIDDEN, ["src/core/engine/murder-mystery.js"], ["interrogate"], ["murder-mystery"], ["mystery.case"], "隐藏剧本杀原型能力。"),
  define("mystery.truth_lock", null, "真相锁", "mystery", MODULE_STATUS.DECLARED_ONLY, [], ["validateTruthLock"], ["murder-mystery"], ["mystery.case"], "未来能力声明。"),
  define("mystery.scoring", null, "推理评分", "mystery", MODULE_STATUS.PROTOTYPE_HIDDEN, ["src/core/engine/murder-mystery.js"], ["accuse", "scoreReasoning"], ["murder-mystery"], ["mystery.case"], "隐藏剧本杀原型能力。"),
  define("puzzle.scene", null, "场景谜题", "puzzle", MODULE_STATUS.DECLARED_ONLY, [], ["loadPuzzleScene"], ["mystery-puzzle"], ["scene.session"], "未来能力声明。"),
  define("strategy.resource", null, "策略资源", "strategy", MODULE_STATUS.PROTOTYPE_HIDDEN, ["src/core/engine/sim.js"], ["createResources", "advanceResources"], ["strategy-sim"], [], "隐藏模拟经营原型能力。"),
  define("strategy.calendar", null, "策略日历", "strategy", MODULE_STATUS.PROTOTYPE_HIDDEN, ["src/core/engine/sim.js"], ["advanceCalendar"], ["strategy-sim"], ["time.timeline"], "隐藏模拟经营原型能力。"),
  define("strategy.decision", null, "策略决策", "strategy", MODULE_STATUS.PROTOTYPE_HIDDEN, ["src/core/engine/sim.js"], ["resolveDecision"], ["strategy-sim"], ["strategy.resource"], "隐藏模拟经营原型能力。"),
  define("strategy.faction", null, "策略势力", "strategy", MODULE_STATUS.DECLARED_ONLY, [], ["manageFaction"], ["strategy-sim"], ["entity.organization"], "未来能力声明。"),
  define("strategy.diplomacy", null, "策略外交", "strategy", MODULE_STATUS.DECLARED_ONLY, [], ["resolveDiplomacy"], ["strategy-sim"], ["strategy.faction"], "未来能力声明。"),
  define("strategy.turn", null, "策略回合", "strategy", MODULE_STATUS.DECLARED_ONLY, [], ["advanceTurn"], ["strategy-sim"], ["strategy.calendar", "strategy.decision"], "未来能力声明。"),
  define("strategy.loyalty", null, "忠诚度", "strategy", MODULE_STATUS.PROTOTYPE_HIDDEN, ["src/core/engine/sim.js"], ["updateLoyalty"], ["strategy-sim"], ["strategy.faction"], "隐藏模拟经营原型能力。"),
  define("creation.questioning", null, "创作追问", "creation", MODULE_STATUS.DECLARED_ONLY, ["src/core/data/creation-wizard.js"], ["generateCreationQuestions"], ["creation-forge"], ["creation.alchemy"], "现有向导尚未通过新 registry 包装。"),
  define("creation.outline", null, "创作大纲", "creation", MODULE_STATUS.DECLARED_ONLY, ["src/core/data/creation-wizard.js"], ["generateCreationSummary"], ["creation-forge"], ["creation.questioning"], "现有向导尚未通过新 registry 包装。")
];

export const MODULE_MANIFEST = Object.freeze(Object.fromEntries(entries.map((entry) => [entry.id, entry])));

export const LEGACY_MODULE_MAP = Object.freeze({
  M1: "core.world_container", M2: "lore.worldbook_trigger", M3: "core.dynamic_state",
  M4: "entity.organization", M5: "entity.organization_hierarchy", M6: "entity.relationship_network",
  M7: "entity.key_character", M8: "character.preset", M9: "character.cognition",
  M10: "lore.race_dimension", M11: "scene.session", M12: "narrative.story_template",
  M13: "narrative.five_layer_engine", M15: "rule.world_rule", M15c: "audit.narrative_quality",
  M16: "time.timeline", M17: "event.random_event", M18: "prediction.scene_direction",
  M19: "character.card_runtime", "M-创作": "creation.alchemy"
});
