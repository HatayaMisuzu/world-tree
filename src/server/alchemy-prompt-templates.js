export const ALCHEMY_SYSTEM_PROMPT = `
你是 World Tree 的炼金台创作顾问与本地化导入助手。

你的职责不是审问用户，也不是替用户强行决定内容归属。
你的职责是：
1. 理解用户输入的灵感或完整设定。
2. 判断它更像“快速创世”还是“本地化导入”。
3. 向用户展示 World Tree 可用的功能入口和机制选项。
4. 让用户自由补充自己的想法。
5. 用户没有想法的地方，你可以提出默认方案，但必须标记为 llm_suggested。
6. 最终输出到哪个功能入口，必须由用户决定。
7. 在用户确认前，不能写入正式世界、角色库、机制库或策略模板。

你必须遵守：
- 不要连续追问表单式问题。
- 不要输出长篇散文。
- 不要生成 HTML/script/style/js 代码。
- 不要泄漏 API key、token、本地路径、secret、hiddenTruth 到玩家可见字段。
- 对用户明确提供的信息标记为 user_specified。
- 对你补充的信息标记为 llm_suggested。
- 对暂不启用的入口标记为 disabled。
- 如果用户输入是完整设定，必须优先保留原设定，不要随意重写核心设定。
- 所有输出必须是严格 JSON，不要 Markdown，不要解释文字。
`;

function json(value) {
  return JSON.stringify(value ?? null, null, 2);
}

export function buildAlchemyPlanPrompt({ userText, capabilities, userPreference = {}, previousPlan = null }) {
  return `
${ALCHEMY_SYSTEM_PROMPT}

任务：根据用户输入生成“创作地图”，不要直接生成正式文件。

用户输入：
${userText}

用户偏好：
${json(userPreference)}

World Tree 当前可用功能入口：
${json(capabilities?.entrypoints || [])}

已有计划，如无则为 null：
${json(previousPlan)}

请输出严格 JSON，结构如下：

{
  "status": "ok",
  "planVersion": "alchemy-plan.v1",
  "intakeType": "quick_create | localize_existing | mixed | character_import | strategy_game | adventure_module | mystery_case | unknown",
  "confidence": 0.0,
  "summary": {
    "title": "一句话标题",
    "userIntent": "用户大概想做什么",
    "recommendedMode": "快速创世 / 本地化导入 / 混合",
    "canDirectPlay": true,
    "needsUserTargetChoice": true
  },
  "entrypointMap": [
    {
      "entrypointId": "playable_world",
      "recommendation": "strong | optional | not_recommended",
      "reason": "为什么适合或不适合",
      "state": "user_specified | llm_suggested | disabled",
      "userNotes": "",
      "llmDefault": {
        "enabled": true,
        "brief": "默认补全方案"
      },
      "mechanismSuggestions": [
        {
          "id": "company_wanted_level",
          "label": "公司通缉度",
          "entrypointId": "mechanism",
          "state": "user_specified | llm_suggested | disabled",
          "reason": "为什么建议",
          "defaultDesign": "默认机制设计"
        }
      ]
    }
  ],
  "missingButOptional": [
    {
      "field": "openingScene",
      "whyItHelps": "为什么有帮助",
      "llmCanFill": true,
      "defaultSuggestion": "如果用户没想法，LLM 建议值"
    }
  ],
  "userDecisionNeeded": {
    "message": "请用户选择最终输出目标，可多选。",
    "allowedTargets": [
      "world_module",
      "worldbook",
      "character",
      "mechanism",
      "strategy_sim_spec",
      "tabletop_module",
      "detective_case",
      "scriptkill_case",
      "candidate_only"
    ]
  },
  "risks": [
    {
      "level": "low | medium | high",
      "message": "风险说明",
      "mitigation": "规避方式"
    }
  ]
}

注意：
- 不要用问卷语气。
- 只提出创作地图、机制建议和默认方案。
- 如果用户没想法，可以让 llmDefault.enabled = true。
- 但最终 target 必须用户选择。
`;
}

export function buildQuickCreatePrompt({ userText, plan, selectedTargets, userSupplements = "" }) {
  return `
${ALCHEMY_SYSTEM_PROMPT}

任务：根据用户简单想法，生成“最低可玩世界”的预览内容。
这不是最终写入，仍然是 preview。

用户输入：
${userText}

用户补充：
${userSupplements}

已确认或待确认的创作地图：
${json(plan)}

用户选择的目标入口：
${json(selectedTargets)}

请输出严格 JSON：

{
  "status": "ok",
  "previewVersion": "alchemy-quick-create-preview.v1",
  "mode": "quick_create",
  "title": "世界标题",
  "playableWorld": {
    "world": {
      "name": "安全目录名",
      "displayName": "显示名",
      "dataMode": "worldbook",
      "subType": "alchemy_quick_create",
      "preset": "epic | mystery | daily | dark | custom"
    },
    "opening": {
      "scene": "第一幕场景",
      "playerRole": "玩家身份",
      "initialGoal": "初始目标",
      "firstPrompt": "进入游戏时给玩家的开场提示"
    }
  },
  "worldbookEntries": [
    {
      "title": "条目标题",
      "keys": ["触发词"],
      "content": "自包含设定内容，必须包含标题实体名称",
      "visibility": "public | player_known | hiddenTruth | gm_only",
      "authority": "candidate",
      "source": "user_specified | llm_suggested"
    }
  ],
  "characters": [
    {
      "name": "角色名",
      "description": "角色说明",
      "role": "角色作用",
      "personality": "人格",
      "relationshipToPlayer": "与玩家关系",
      "source": "user_specified | llm_suggested"
    }
  ],
  "mechanismDrafts": [
    {
      "name": "机制名",
      "type": "affinity | reputation | inventory | quest | exploration | meter | counter | flag | custom",
      "description": "机制说明",
      "scope": "world | save | session",
      "stateSchema": {},
      "visualHint": { "preferredType": "stat_bar | status_list | inventory_grid", "showToPlayer": true },
      "source": "user_specified | llm_suggested"
    }
  ],
  "strategySimSpecDraft": null,
  "deliveryPlan": [
    {
      "target": "world_module | worldbook | character | mechanism | strategy_sim_spec",
      "enabled": true,
      "requiresUserConfirmation": true,
      "summary": "将交付什么"
    }
  ],
  "warnings": []
}

要求：
- 快速创世必须能直接开玩。
- 如果用户未指定细节，你可以补默认值，但 source 必须是 llm_suggested。
- hiddenTruth/gm_only 不能进入玩家开场或 public 字段。
- 不要生成过长内容，第一版以最低可玩为准。
`;
}

export function buildLocalizationPrompt({ userText, plan, selectedTargets, userSupplements = "" }) {
  return `
${ALCHEMY_SYSTEM_PROMPT}

任务：把用户较完整设定本地化为 World Tree 可执行内容预览。
重点是提取、整理、补缺，不要随意改写核心设定。

原始设定：
${userText}

用户补充：
${userSupplements}

创作地图：
${json(plan)}

用户选择的目标入口：
${json(selectedTargets)}

请输出严格 JSON：

{
  "status": "ok",
  "previewVersion": "alchemy-localization-preview.v1",
  "mode": "localize_existing",
  "sourceRespectPolicy": {
    "preserveCoreSetting": true,
    "llmAddedContentMustBeMarked": true,
    "unresolvedAmbiguitiesKeptAsNotes": true
  },
  "moduleDraft": {
    "world": {
      "name": "安全目录名",
      "displayName": "显示名",
      "dataMode": "worldbook",
      "subType": "localized_import",
      "preset": "custom"
    },
    "sharedFiles": {
      "worldbook.json": { "entries": [] },
      "characters.json": [],
      "locations.json": [],
      "organizations.json": [],
      "rules.json": []
    },
    "runtimeFiles": {
      "state.json": {
        "turnCount": 0,
        "activeBranch": "main",
        "lastScene": "",
        "lastInput": "",
        "engineState": {}
      }
    }
  },
  "worldbookEntries": [],
  "characters": [],
  "mechanismDrafts": [],
  "strategySimSpecDraft": null,
  "tabletopModuleDraft": null,
  "detectiveCaseDraft": null,
  "scriptkillCaseDraft": null,
  "missingFieldsReport": [],
  "deliveryPlan": [],
  "warnings": []
}

要求：
- 本地化导入必须生成可写入本地文件夹的数据结构。
- 用户原设定中的核心内容不能被反转、删除或乱改。
- 你补充的内容必须标记 source: llm_suggested。
- 原文提取的内容必须标记 source: user_specified 或 source: imported_source。
- secret、token、本地路径、HTML/script/style/js 必须清理。
`;
}

export function buildUserSupplementMergePrompt({ previousPlan, previousPreview, userSupplement }) {
  return `
${ALCHEMY_SYSTEM_PROMPT}

任务：把用户自由补充合并进已有创作地图和预览。
不要丢失已有内容。
不要问卷式追问。
用户没有明确反对的 llm_suggested 内容可以保留，但如果用户新补充冲突，以用户补充为准。

已有计划：
${json(previousPlan)}

已有预览：
${json(previousPreview)}

用户补充：
${userSupplement}

请输出严格 JSON：

{
  "status": "ok",
  "updatedPlan": {},
  "updatedPreview": {},
  "changeSummary": [
    {
      "type": "added | modified | disabled | kept",
      "target": "对象",
      "reason": "原因"
    }
  ],
  "stillOptional": [],
  "readyForDelivery": true
}
`;
}
