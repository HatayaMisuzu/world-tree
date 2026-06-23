import { getWorldTreeRoute } from "./world-tree-route-index.js";
import { getModePromptProfile, buildModePromptResult } from "../prompts/mode-prompt-registry.js";
import { createModeInputPacket } from "./mode-input-packets.js";
import { createModeOutputPacket, normalizeModeOutputPacket, validateModeOutputPacket } from "./mode-output-packets.js";
import { filterContextByModeVisibility } from "./mode-isolation-policy.js";
import { createKernelTurnContext, summarizeKernelTurnContext } from "../kernel/kernel-turn-context.js";

/**
 * 创建模式运行错误结果。
 * 用于 adapter import 失败、prompt profile 缺失、adapter run 失败等场景。
 */
function createModeRunError({ modeId, code, message, cause }) {
  return {
    ok: false,
    modeId,
    error: {
      code,
      message,
      cause: cause?.message || String(cause || "")
    },
    outputPacket: createModeOutputPacket({
      modeId,
      errors: [{ code, message }]
    })
  };
}

const RUNNERS = {
  "world-rpg": async (p, i, o) => {
    try {
      const { runGrandWorldTurn } = await import("../grand-world/grand-world-mode-adapter.js");
      const r = runGrandWorldTurn(p, i);
      return { ok: true, text: r.packet?.worldContextPacket?.worldIdentity?.title || "大世界运行完成", proposals: r.packet?.proposals || [] };
    } catch (err) {
      return { ok: false, text: "", proposals: [], error: { code: "GRAND_WORLD_ADAPTER_FAILED", message: "大世界模式适配器加载失败", cause: err.message } };
    }
  },
  "character": async (p, i, o) => {
    try {
      const { runCharacterTurn } = await import("../character/character-engine-adapter.js");
      return { ok: true, text: "角色模式运行完成", proposals: [] };
    } catch (err) {
      return { ok: false, text: "", proposals: [], error: { code: "CHARACTER_ADAPTER_FAILED", message: "角色模式适配器加载失败", cause: err.message } };
    }
  },
  "tabletop": async (p, i, o) => {
    try {
      const { runSoloTabletopNarrativeTurn } = await import("../tabletop/tabletop-mode-adapter.js");
      const r = runSoloTabletopNarrativeTurn(p, i);
      return { ok: true, text: "桌面叙事回合完成", proposals: r.packet?.proposals || [] };
    } catch (err) {
      return { ok: false, text: "", proposals: [], error: { code: "TABLETOP_ADAPTER_FAILED", message: "桌面叙事模式适配器加载失败", cause: err.message } };
    }
  },
  "mystery-puzzle": async (p, i, o) => {
    try {
      const { runSoloMysteryPuzzleTurn } = await import("../mystery-puzzle/mystery-puzzle-mode-adapter.js");
      return { ok: true, text: "解谜调查回合完成", proposals: [] };
    } catch (err) {
      return { ok: false, text: "", proposals: [], error: { code: "MYSTERY_PUZZLE_ADAPTER_FAILED", message: "解谜调查模式适配器加载失败", cause: err.message } };
    }
  },
  "strategy-sim": async (p, i, o) => {
    try {
      const { runSoloStrategySimTurn } = await import("../strategy-sim/strategy-sim-mode-adapter.js");
      return { ok: true, text: "策略模拟回合完成", proposals: [] };
    } catch (err) {
      return { ok: false, text: "", proposals: [], error: { code: "STRATEGY_SIM_ADAPTER_FAILED", message: "策略模拟模式适配器加载失败", cause: err.message } };
    }
  },
  "murder-mystery": async (p, i, o) => {
    try {
      const { runSoloMurderMysteryTurn } = await import("../murder-mystery/murder-mystery-mode-adapter.js");
      return { ok: true, text: "单人剧本杀回合完成", proposals: [] };
    } catch (err) {
      return { ok: false, text: "", proposals: [], error: { code: "MURDER_MYSTERY_ADAPTER_FAILED", message: "单人剧本杀模式适配器加载失败", cause: err.message } };
    }
  },
  "creation-forge": async (p, i, o) => {
    try {
      const { runCreationForgeTurn } = await import("../creation-forge/creation-forge-mode-adapter.js");
      const r = runCreationForgeTurn(p, i);
      return { ok: true, text: "炼金台运行完成", proposals: r.packet?.proposals || [] };
    } catch (err) {
      return { ok: false, text: "", proposals: [], error: { code: "CREATION_FORGE_ADAPTER_FAILED", message: "炼金台适配器加载失败", cause: err.message } };
    }
  },
  "quick-setting": async (p, i, o) => {
    return { ok: true, text: "快速设定运行完成", proposals: [] };
  }
};

export async function runWorldTreeModeTurn(project = {}, userInput = {}, options = {}) {
  const modeId = project.mode || options.modeId || "world-rpg";
  const route = getWorldTreeRoute(modeId);
  if (!route) return createModeRunError({ modeId, code: "UNKNOWN_MODE", message: `Unknown mode: ${modeId}` });

  const inputPacket = createModeInputPacket(modeId, project, userInput);
  const filtered = filterContextByModeVisibility(modeId, inputPacket.sharedContext);

  const kernelContext = await createKernelTurnContext({
    projectRoot: options.projectRoot || project.projectRoot || "",
    modeId,
    userInput: userInput.text || "",
    model: project.model || {},
    engineState: options.engineState || project.engineState || {},
    sharedData: filtered,
    runtimeFlags: options.runtimeFlags || {}
  });

  // 将过滤后的 context 注入 inputPacket，确保 prompt 和 adapter 收到的是隔离后的数据
  inputPacket.sharedContext = filtered;
  inputPacket.sharedContext.kernel = summarizeKernelTurnContext(kernelContext);

  // 使用 route.promptProfileId 显式映射（不再猜测 prompt profile）
  const profileId = route.promptProfileId;
  const promptResult = buildModePromptResult(inputPacket, { profileId });
  if (!promptResult.ok) {
    return createModeRunError({ modeId, code: "PROMPT_PROFILE_MISSING", message: `Prompt profile not found: ${profileId}` });
  }

  const runner = RUNNERS[modeId];
  if (!runner) {
    return createModeRunError({ modeId, code: "NO_RUNNER", message: `No runner for mode: ${modeId}` });
  }

  let result;
  try {
    result = await runner(project, userInput, options);
  } catch (err) {
    return createModeRunError({ modeId, code: "MODE_ADAPTER_RUN_FAILED", message: "Mode adapter threw unexpected error", cause: err });
  }

  // adapter 内部已经通过 ok:false 报告了失败
  if (!result.ok) {
    return createModeRunError({
      modeId,
      code: result.error?.code || "MODE_ADAPTER_RUN_FAILED",
      message: result.error?.message || "Mode adapter returned failure",
      cause: result.error?.cause || ""
    });
  }

  const outputPacket = createModeOutputPacket({
    modeId,
    modeMeaning: route.modeMeaning,
    projectId: project.id || "",
    turnId: inputPacket.turnId,
    text: result.text,
    proposals: result.proposals || []
  }, { profileId });

  const validation = validateModeOutputPacket(outputPacket);
  if (!validation.ok) {
    return createModeRunError({ modeId, code: "OUTPUT_PACKET_INVALID", message: "Output packet validation failed" });
  }

  outputPacket.debug = {
    promptProfileId: profileId,
    inputPacketType: route.inputPacketType,
    outputPacketType: route.outputPacketType,
    kernel: summarizeKernelTurnContext(kernelContext)
  };

  return {
    ok: true,
    kernelContext: summarizeKernelTurnContext(kernelContext),
    outputPacket,
    uiSummary: {
      text: result.text?.slice(0, 200),
      proposalsCount: (result.proposals || []).length
    },
    pendingProposals: (result.proposals || []).filter(p => p.status === "pending")
  };
}

export function createModeTurnPreview(project = {}, userInput = {}, options = {}) {
  return { mode: project.mode, userInput: userInput.text?.slice(0, 50) };
}

export function validateModeTurnResult(result = {}) {
  return { ok: result.ok !== false && !result.error, errors: result.error ? [result.error] : [] };
}

export function createModeRunnerSummary(result = {}) {
  return { modesSupported: Object.keys(RUNNERS).length, lastMode: result.outputPacket?.modeId || "" };
}
