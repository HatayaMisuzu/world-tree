export const ALCHEMY_DELIVERY_TARGETS = Object.freeze([
  "world_module",
  "worldbook",
  "character",
  "mechanism",
  "strategy_sim_spec",
  "tabletop_module",
  "detective_case",
  "scriptkill_case",
  "candidate_only"
]);

export const ALCHEMY_CREATION_STATES = Object.freeze([
  "user_specified",
  "llm_suggested",
  "disabled"
]);

export const ALCHEMY_ENTRYPOINTS = Object.freeze([
  {
    id: "playable_world",
    label: "可玩世界",
    purpose: "直接创建可进入的剧情互动世界。",
    deliverTargets: ["world_module"],
    mechanisms: ["opening_scene", "protagonist", "world_goal", "initial_state", "chat_start"],
    recommendedFor: ["quick_create", "localize_existing"],
    requiredUserDecision: true
  },
  {
    id: "worldbook",
    label: "Worldbook 世界书",
    purpose: "保存长期设定、规则、地点、势力和隐藏真相。",
    deliverTargets: ["worldbook"],
    mechanisms: ["trigger_keys", "context_slots", "visibility", "canon_candidate_review"],
    recommendedFor: ["quick_create", "localize_existing", "lore_import"],
    requiredUserDecision: true
  },
  {
    id: "character",
    label: "Character 角色",
    purpose: "创建可互动角色、角色卡、关系和人格设定。",
    deliverTargets: ["character"],
    mechanisms: ["profile", "persona", "relationship", "memory_seed", "affinity"],
    recommendedFor: ["quick_create", "localize_existing", "character_import"],
    requiredUserDecision: true
  },
  {
    id: "mechanism",
    label: "Mechanism 机制",
    purpose: "创建好感度、声望、资源、任务、探索度、污染值等状态规则。",
    deliverTargets: ["mechanism"],
    mechanisms: ["affinity", "reputation", "inventory", "quest", "exploration", "meter", "counter", "flag"],
    recommendedFor: ["quick_create", "localize_existing", "game_system"],
    requiredUserDecision: true
  },
  {
    id: "strategy_sim",
    label: "Strategy Sim 策略模拟",
    purpose: "创建资源、变量、行动、事件牌、胜败条件等回合/经营玩法。",
    deliverTargets: ["strategy_sim_spec"],
    mechanisms: ["resources", "variables", "actions", "event_decks", "probability_rules", "win_lose_conditions"],
    recommendedFor: ["strategy_game", "management_game", "localize_existing"],
    requiredUserDecision: true
  },
  {
    id: "tabletop",
    label: "Tabletop 跑团模组",
    purpose: "创建玩家简报、GM 资料、场景、NPC、秘密时钟。",
    deliverTargets: ["tabletop_module"],
    mechanisms: ["player_brief", "gm_book", "scenes", "npcs", "secret_clocks", "twists"],
    recommendedFor: ["adventure_module", "localize_existing"],
    requiredUserDecision: true
  },
  {
    id: "detective",
    label: "Detective / ScriptKill 案件",
    purpose: "创建嫌疑人、线索、时间线、真相锁和推理玩法。",
    deliverTargets: ["detective_case", "scriptkill_case"],
    mechanisms: ["suspects", "clues", "timeline", "truth_lock", "deduction_submit", "reveal_rules"],
    recommendedFor: ["mystery_case", "scriptkill", "detective"],
    requiredUserDecision: true
  }
]);

export function getAlchemyCapabilities() {
  return {
    status: "ok",
    version: "alchemy-capabilities.v1",
    entrypoints: ALCHEMY_ENTRYPOINTS.map((entry) => ({ ...entry, mechanisms: [...entry.mechanisms], deliverTargets: [...entry.deliverTargets], recommendedFor: [...entry.recommendedFor] })),
    deliveryTargets: [...ALCHEMY_DELIVERY_TARGETS],
    creationStates: [...ALCHEMY_CREATION_STATES],
    policies: {
      llmMayRecommend: true,
      userMustChooseDeliveryTarget: true,
      noDirectWriteWithoutConfirmation: true,
      allowDefaultsWhenUserHasNoIdea: true,
      preserveOriginalSettingForLocalization: true,
      noQuestionnaireMode: true
    }
  };
}

export function getEntrypointById(entrypointId) {
  return ALCHEMY_ENTRYPOINTS.find((entry) => entry.id === entrypointId) || null;
}

export function isAlchemyDeliveryTarget(value) {
  return ALCHEMY_DELIVERY_TARGETS.includes(value);
}

export function normalizeAlchemyCreationState(value, fallback = "llm_suggested") {
  return ALCHEMY_CREATION_STATES.includes(value) ? value : fallback;
}
