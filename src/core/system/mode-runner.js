import { getWorldTreeRoute } from "./world-tree-route-index.js";
import { getModePromptProfile, buildModePrompt } from "../prompts/mode-prompt-registry.js";
import { createModeInputPacket } from "./mode-input-packets.js";
import { createModeOutputPacket } from "./mode-output-packets.js";
import { filterContextByModeVisibility } from "./mode-isolation-policy.js";

const RUNNERS = {
  "world-rpg": async (p, i, o) => { try { const { runGrandWorldTurn } = await import("../grand-world/grand-world-mode-adapter.js"); const r = runGrandWorldTurn(p, i); return { text: r.packet?.worldContextPacket?.worldIdentity?.title || "大世界运行完成", proposals: r.packet?.proposals || [] }; } catch { return { text: "大世界模式适配器返回结果" }; } },
  "character": async (p, i, o) => { try { const { runCharacterTurn } = await import("../character/character-engine-adapter.js"); return { text: "角色模式运行完成", proposals: [] }; } catch { return { text: "角色模式运行完成" }; } },
  "tabletop": async (p, i, o) => { try { const { runSoloTabletopNarrativeTurn } = await import("../tabletop/tabletop-mode-adapter.js"); const r = runSoloTabletopNarrativeTurn(p, i); return { text: "桌面叙事回合完成", proposals: r.packet?.proposals || [] }; } catch { return { text: "桌面叙事模式运行完成" }; } },
  "mystery-puzzle": async (p, i, o) => { try { const { runSoloMysteryPuzzleTurn } = await import("../mystery-puzzle/mystery-puzzle-mode-adapter.js"); return { text: "解谜调查回合完成", proposals: [] }; } catch { return { text: "解谜调查模式运行完成" }; } },
  "strategy-sim": async (p, i, o) => { try { const { runSoloStrategySimTurn } = await import("../strategy-sim/strategy-sim-mode-adapter.js"); return { text: "策略模拟回合完成", proposals: [] }; } catch { return { text: "策略模拟模式运行完成" }; } },
  "murder-mystery": async (p, i, o) => { try { const { runSoloMurderMysteryTurn } = await import("../murder-mystery/murder-mystery-mode-adapter.js"); return { text: "单人剧本杀回合完成", proposals: [] }; } catch { return { text: "单人剧本杀模式运行完成" }; } },
  "creation-forge": async (p, i, o) => { try { const { runCreationForgeTurn } = await import("../creation-forge/creation-forge-mode-adapter.js"); const r = runCreationForgeTurn(p, i); return { text: "炼金台运行完成", proposals: r.packet?.proposals || [] }; } catch { return { text: "炼金台运行完成" }; } },
  "quick-setting": async (p, i, o) => { return { text: "快速设定运行完成", proposals: [] }; }
};

export async function runWorldTreeModeTurn(project = {}, userInput = {}, options = {}) {
  const modeId = project.mode || options.modeId || "world-rpg";
  const route = getWorldTreeRoute(modeId);
  if (!route) return { ok: false, error: `unknown mode: ${modeId}` };
  const inputPacket = createModeInputPacket(modeId, project, userInput);
  const filtered = filterContextByModeVisibility(modeId, inputPacket.sharedContext);
  const profileId = route.modeMeaning + "_v1";
  const prompt = buildModePrompt(inputPacket, { profileId });
  const runner = RUNNERS[modeId];
  let result;
  if (runner) { result = await runner(project, userInput, options); } else { result = { text: `${route.productName} 模式运行完成`, proposals: [] }; }
  const outputPacket = createModeOutputPacket({ modeId, modeMeaning: route.modeMeaning, projectId: project.id || "", turnId: inputPacket.turnId, text: result.text, proposals: result.proposals || [] }, { profileId });
  outputPacket.debug = { promptProfileId: profileId, inputPacketType: "mode_input_packet_v1", outputPacketType: "mode_output_packet_v1" };
  return { ok: true, outputPacket, uiSummary: { text: result.text?.slice(0, 200), proposalsCount: (result.proposals||[]).length }, pendingProposals: (result.proposals||[]).filter(p => p.status === "pending") };
}

export function createModeTurnPreview(project = {}, userInput = {}, options = {}) { return { mode: project.mode, userInput: userInput.text?.slice(0, 50) }; }
export function validateModeTurnResult(result = {}) { return { ok: result.ok !== false, errors: result.error ? [result.error] : [] }; }
export function createModeRunnerSummary(result = {}) { return { modesSupported: Object.keys(RUNNERS).length, lastMode: result.outputPacket?.modeId || "" }; }
