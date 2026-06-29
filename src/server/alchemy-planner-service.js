import { buildAlchemyPlanPrompt } from "./alchemy-prompt-templates.js";

const INTAKE_TYPES = new Set([
  "quick_create",
  "localize_existing",
  "mixed",
  "character_import",
  "strategy_game",
  "adventure_module",
  "mystery_case",
  "unknown"
]);

const RECOMMENDATIONS = new Set(["strong", "optional", "not_recommended"]);
const STATES = new Set(["user_specified", "llm_suggested", "disabled"]);

function clampConfidence(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0.55;
}

function compactText(value, max = 240) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function safeJsonParse(value) {
  if (!value) return null;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(String(value));
  } catch {
    const match = String(value).match(/\{[\s\S]*\}/);
    if (!match) return null;
    try { return JSON.parse(match[0]); } catch { return null; }
  }
}

function detectIntakeType(text = "") {
  const clean = String(text || "");
  const longEnough = clean.length >= 800;
  if (/(线索|嫌疑人|凶手|案件|推理|案发|证据|密室|侦探|剧本杀)/u.test(clean)) return "mystery_case";
  if (/(跑团|GM|KP|模组|NPC|检定|场景|秘密时钟)/iu.test(clean)) return "adventure_module";
  if (/(资源|回合|经营|策略|胜利|失败|行动|事件牌|变量|概率|生产|市场)/u.test(clean)) return "strategy_game";
  if (/(角色卡|人物设定|人格|口癖|好感|关系)/u.test(clean) && clean.length < 1200) return "character_import";
  if (longEnough || /(世界观|势力|组织|规则|地点|时间线|章节|设定集|大纲|阵营|历史)/u.test(clean)) return "localize_existing";
  if (clean.trim()) return "quick_create";
  return "unknown";
}

function recommendationFor(entry, intakeType, text = "") {
  const haystack = String(text || "");
  if (entry.recommendedFor?.includes(intakeType)) return "strong";
  if (entry.id === "playable_world" && ["quick_create", "mixed"].includes(intakeType)) return "strong";
  if (entry.id === "worldbook" && /(世界|设定|地点|势力|规则|历史|组织)/u.test(haystack)) return "strong";
  if (entry.id === "character" && /(角色|人物|主角|NPC|同伴|敌人|关系)/iu.test(haystack)) return "strong";
  if (entry.id === "mechanism" && /(好感|声望|资源|任务|探索度|污染|稳定度|库存|通缉|数值|状态)/u.test(haystack)) return "strong";
  if (entry.id === "strategy_sim" && /(资源|回合|经营|策略|胜利|失败|行动|事件牌|变量|概率)/u.test(haystack)) return "strong";
  if (entry.id === "tabletop" && /(跑团|GM|NPC|模组|检定|秘密时钟)/iu.test(haystack)) return "strong";
  if (entry.id === "detective" && /(案件|线索|嫌疑人|凶手|推理|剧本杀)/u.test(haystack)) return "strong";
  return entry.id === "detective" || entry.id === "tabletop" || entry.id === "strategy_sim" ? "not_recommended" : "optional";
}

function defaultMechanisms(entrypointId, text = "") {
  const result = [];
  const add = (id, label, defaultDesign, reason = "与当前输入匹配。") => {
    result.push({ id, label, entrypointId: "mechanism", state: "llm_suggested", reason, defaultDesign });
  };
  if (/(通缉|追杀|公司|警戒|追捕)/u.test(text)) add("wanted_level", "通缉度", "0-100 的通缉值；高于 70 时触发追捕事件。");
  if (/(丹药|库存|背包|物品|道具|资源)/u.test(text)) add("inventory", "库存 / 背包", "记录关键物品、丹药、材料的数量和消耗。");
  if (/(好感|关系|同伴|恋爱|信任)/u.test(text)) add("affinity", "角色好感度", "记录主要角色对玩家的信任和亲密变化。");
  if (/(声望|势力|阵营|公司|宗门|城邦)/u.test(text)) add("reputation", "势力声望", "记录玩家与势力的评价关系。");
  if (/(任务|主线|目标|委托)/u.test(text)) add("quest_progress", "任务进度", "记录主线和支线目标推进。");
  if (/(污染|侵蚀|理智|稳定度|能量)/u.test(text)) add("stability_meter", "稳定度 / 污染值", "0-100 状态条；越界触发风险事件。");
  if (!result.length && ["playable_world", "mechanism"].includes(entrypointId)) {
    add("quest_progress", "主线目标进度", "记录玩家当前核心目标推进。", "最低可玩世界通常需要一个目标进度。");
  }
  return result.slice(0, 6);
}

export function createAlchemyPlannerService({
  getCapabilities,
  runLlmJson,
  now = () => new Date()
}) {
  function capabilitySnapshot() {
    const value = typeof getCapabilities === "function" ? getCapabilities() : getCapabilities;
    return value || { entrypoints: [], deliveryTargets: [] };
  }

  function heuristicPlan(body = {}) {
    const text = String(body.text || body.userText || "").trim();
    const capabilities = capabilitySnapshot();
    const intakeType = detectIntakeType(text);
    const title = intakeType === "localize_existing"
      ? "本地化导入计划"
      : intakeType === "quick_create"
        ? "快速创世计划"
        : "混合创作计划";

    const entrypointMap = (capabilities.entrypoints || []).map((entry) => {
      const recommendation = recommendationFor(entry, intakeType, text);
      const state = recommendation === "not_recommended" ? "disabled" : "llm_suggested";
      return {
        entrypointId: entry.id,
        recommendation,
        reason: recommendation === "strong"
          ? `${entry.label} 与当前输入高度匹配。`
          : recommendation === "optional"
            ? `${entry.label} 可以作为后续扩展入口。`
            : `${entry.label} 暂不适合作为第一阶段目标。`,
        state,
        userNotes: "",
        llmDefault: {
          enabled: state !== "disabled",
          brief: state !== "disabled" ? `可先按“${entry.purpose}”生成一版最低可用内容。` : ""
        },
        mechanismSuggestions: state === "disabled" ? [] : defaultMechanisms(entry.id, text)
      };
    });

    const strongTargets = entrypointMap
      .filter((item) => item.recommendation === "strong")
      .flatMap((item) => {
        const entry = (capabilities.entrypoints || []).find((candidate) => candidate.id === item.entrypointId);
        return entry?.deliverTargets || [];
      });

    return {
      status: "ok",
      planVersion: "alchemy-plan.v1",
      planId: `plan-${now().getTime?.() || Date.now()}`,
      intakeType,
      confidence: intakeType === "unknown" ? 0.2 : 0.72,
      summary: {
        title,
        userIntent: compactText(text, 300),
        recommendedMode: intakeType === "localize_existing" ? "本地化导入" : intakeType === "quick_create" ? "快速创世" : "混合",
        canDirectPlay: ["quick_create", "localize_existing", "mixed"].includes(intakeType),
        needsUserTargetChoice: true
      },
      entrypointMap,
      missingButOptional: [
        {
          field: "openingScene",
          whyItHelps: "有开场场景就可以直接进入游玩。",
          llmCanFill: true,
          defaultSuggestion: "由 LLM 根据当前设定补一个第一幕。"
        },
        {
          field: "coreMechanisms",
          whyItHelps: "机制能让世界状态可持续变化。",
          llmCanFill: true,
          defaultSuggestion: "默认生成任务进度、关键资源和主要关系。"
        }
      ],
      userDecisionNeeded: {
        message: "请选择最终输出目标，可多选；LLM 只推荐，不会替你决定。",
        allowedTargets: capabilities.deliveryTargets || [
          "world_module", "worldbook", "character", "mechanism", "strategy_sim_spec",
          "tabletop_module", "detective_case", "scriptkill_case", "candidate_only"
        ],
        recommendedTargets: [...new Set(strongTargets.length ? strongTargets : ["world_module", "worldbook"])]
      },
      risks: [
        {
          level: "medium",
          message: "LLM 补充内容可能偏离你的原意。",
          mitigation: "所有 LLM 补充都会标记为 llm_suggested，并在交付前等待用户确认。"
        }
      ]
    };
  }

  function normalizePlan(raw = {}, body = {}) {
    const fallback = heuristicPlan(body);
    const input = raw && typeof raw === "object" ? raw : {};
    const capabilities = capabilitySnapshot();
    const entrypoints = capabilities.entrypoints || [];
    const byId = new Map(entrypoints.map((entry) => [entry.id, entry]));
    const rawMap = Array.isArray(input.entrypointMap) ? input.entrypointMap : [];

    const entrypointMap = entrypoints.map((entry) => {
      const item = rawMap.find((candidate) => candidate?.entrypointId === entry.id) || fallback.entrypointMap.find((candidate) => candidate.entrypointId === entry.id) || {};
      const recommendation = RECOMMENDATIONS.has(item.recommendation) ? item.recommendation : recommendationFor(entry, input.intakeType || fallback.intakeType, body.text);
      const state = STATES.has(item.state) ? item.state : recommendation === "not_recommended" ? "disabled" : "llm_suggested";
      return {
        entrypointId: entry.id,
        recommendation,
        reason: compactText(item.reason || `${entry.label} 可承接该内容。`, 500),
        state,
        userNotes: String(item.userNotes || ""),
        llmDefault: {
          enabled: item.llmDefault?.enabled !== false && state !== "disabled",
          brief: compactText(item.llmDefault?.brief || `生成 ${entry.label} 的最低可用内容。`, 500)
        },
        mechanismSuggestions: Array.isArray(item.mechanismSuggestions)
          ? item.mechanismSuggestions.slice(0, 12).map((mechanism) => ({
              id: String(mechanism.id || mechanism.label || "mechanism"),
              label: compactText(mechanism.label || mechanism.id || "机制", 80),
              entrypointId: byId.has(mechanism.entrypointId) ? mechanism.entrypointId : "mechanism",
              state: STATES.has(mechanism.state) ? mechanism.state : "llm_suggested",
              reason: compactText(mechanism.reason || "", 240),
              defaultDesign: compactText(mechanism.defaultDesign || "", 800)
            }))
          : defaultMechanisms(entry.id, body.text)
      };
    });

    const intakeType = INTAKE_TYPES.has(input.intakeType) ? input.intakeType : fallback.intakeType;
    const allowedTargets = Array.isArray(input.userDecisionNeeded?.allowedTargets)
      ? input.userDecisionNeeded.allowedTargets
      : fallback.userDecisionNeeded.allowedTargets;

    return {
      ...fallback,
      ...input,
      status: "ok",
      planVersion: "alchemy-plan.v1",
      intakeType,
      confidence: clampConfidence(input.confidence ?? fallback.confidence),
      summary: {
        ...fallback.summary,
        ...(input.summary || {}),
        needsUserTargetChoice: true
      },
      entrypointMap,
      userDecisionNeeded: {
        ...fallback.userDecisionNeeded,
        ...(input.userDecisionNeeded || {}),
        allowedTargets,
        message: input.userDecisionNeeded?.message || fallback.userDecisionNeeded.message
      },
      risks: Array.isArray(input.risks) ? input.risks.slice(0, 12) : fallback.risks
    };
  }

  async function plan(body = {}) {
    if (typeof body.text !== "string" || !body.text.trim()) {
      return {
        status: "error",
        code: "ALCHEMY_PLAN_TEXT_REQUIRED",
        errorMsg: "请输入想法或设定。"
      };
    }

    const capabilities = capabilitySnapshot();
    if (typeof runLlmJson === "function") {
      try {
        const prompt = buildAlchemyPlanPrompt({
          userText: body.text,
          capabilities,
          userPreference: body.userPreference || {},
          previousPlan: body.previousPlan || null
        });
        const llmResult = await runLlmJson(prompt, { purpose: "alchemy-plan", responseFormat: "json" });
        const parsed = safeJsonParse(llmResult) || llmResult;
        return normalizePlan(parsed, body);
      } catch (err) {
        const fallback = heuristicPlan(body);
        return {
          ...fallback,
          warnings: [
            ...(fallback.warnings || []),
            `LLM 创作地图生成失败，已使用本地规则 fallback：${err?.message || "unknown error"}`
          ]
        };
      }
    }
    return heuristicPlan(body);
  }

  return { plan, heuristicPlan, normalizePlan };
}
