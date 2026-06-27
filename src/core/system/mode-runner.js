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
  "world-rpg": createTableDrivenRunner({
    importPath: "../grand-world/grand-world-mode-adapter.js",
    exportName: "runGrandWorldTurn",
    adapterFailedCode: "GRAND_WORLD_ADAPTER_FAILED",
    adapterFailedMessage: "大世界模式适配器加载失败",
    run: ({ adapter, project, userInput }) => {
      const result = adapter(project, userInput);
      return {
        text: result.packet?.worldContextPacket?.worldIdentity?.title || "大世界运行完成",
        proposals: result.packet?.proposals || []
      };
    }
  }),
  "character": createTableDrivenRunner({
    importPath: "../character/character-engine-adapter.js",
    exportName: "runCharacterTurn",
    adapterFailedCode: "CHARACTER_ADAPTER_FAILED",
    adapterFailedMessage: "角色模式适配器加载失败",
    text: "角色模式运行完成"
  }),
  "tabletop": createTableDrivenRunner({
    importPath: "../tabletop/tabletop-mode-adapter.js",
    exportName: "runSoloTabletopNarrativeTurn",
    adapterFailedCode: "TABLETOP_ADAPTER_FAILED",
    adapterFailedMessage: "桌面叙事模式适配器加载失败",
    text: "桌面叙事回合完成",
    run: ({ adapter, project, userInput }) => {
      const result = adapter(project, userInput);
      return { proposals: result.packet?.proposals || [] };
    }
  }),
  "mystery-puzzle": createTableDrivenRunner({
    importPath: "../mystery-puzzle/mystery-puzzle-mode-adapter.js",
    exportName: "runSoloMysteryPuzzleTurn",
    adapterFailedCode: "MYSTERY_PUZZLE_ADAPTER_FAILED",
    adapterFailedMessage: "解谜调查模式适配器加载失败",
    text: "解谜调查回合完成"
  }),
  "strategy-sim": createTableDrivenRunner({
    importPath: "../strategy-sim/strategy-sim-mode-adapter.js",
    exportName: "runSoloStrategySimTurn",
    adapterFailedCode: "STRATEGY_SIM_ADAPTER_FAILED",
    adapterFailedMessage: "策略模拟模式适配器加载失败",
    text: "策略模拟回合完成"
  }),
  "murder-mystery": createTableDrivenRunner({
    importPath: "../murder-mystery/murder-mystery-mode-adapter.js",
    exportName: "runSoloMurderMysteryTurn",
    adapterFailedCode: "MURDER_MYSTERY_ADAPTER_FAILED",
    adapterFailedMessage: "单人剧本杀模式适配器加载失败",
    text: "单人剧本杀回合完成"
  }),
  "creation-forge": createTableDrivenRunner({
    importPath: "../creation-forge/creation-forge-mode-adapter.js",
    exportName: "runCreationForgeTurn",
    adapterFailedCode: "CREATION_FORGE_ADAPTER_FAILED",
    adapterFailedMessage: "炼金台适配器加载失败",
    text: "炼金台运行完成",
    run: ({ adapter, project, userInput }) => {
      const result = adapter(project, userInput);
      return { proposals: result.packet?.proposals || [] };
    }
  }),
  "quick-setting": createTableDrivenRunner({
    text: "快速设定运行完成"
  })
};

function createTableDrivenRunner(spec) {
  return async (project, userInput, options) => {
    try {
      const adapter = await loadRunnerAdapter(spec);
      const result = spec.run
        ? spec.run({ adapter, project, userInput, options })
        : {};
      return {
        ok: true,
        text: result.text || spec.text || "",
        proposals: result.proposals || []
      };
    } catch (err) {
      return {
        ok: false,
        text: "",
        proposals: [],
        error: {
          code: spec.adapterFailedCode || "MODE_ADAPTER_FAILED",
          message: spec.adapterFailedMessage || "模式适配器加载失败",
          cause: err.message
        }
      };
    }
  };
}

async function loadRunnerAdapter(spec) {
  if (!spec.importPath) return null;
  const mod = await import(spec.importPath);
  const adapter = mod[spec.exportName];
  if (typeof adapter !== "function") {
    throw new Error(`Adapter export not found: ${spec.exportName}`);
  }
  return adapter;
}

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
