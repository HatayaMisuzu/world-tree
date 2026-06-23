import { activateWorldbookContext } from "../worldbook/worldbook-context-activator.js";
import { createWorldContextPacket, createWorldContextSummary } from "../worldbook/worldbook-context-packet.js";
import { createWorldbookModuleRuntimePacket, createWorldbookModuleSourceMap } from "../worldbook/worldbook-module-integration.js";
import { getModeCapsule } from "../modes/mode-capsule-registry.js";

const MODE_MEANING = "grand_world";

export function createGrandWorldModeContext(project = {}, input = {}, options = {}) {
  const wb = project.worldbook || options.worldbook || {};
  const scenes = project.scenes || options.scenes || {};
  const state = project.worldState || options.worldState || {};
  const timeline = project.timeline || options.timeline || {};
  const relations = project.relations || options.relations || {};
  const activated = activateWorldbookContext(wb, { input: input.text || "" });
  const modPacket = createWorldbookModuleRuntimePacket(project, { text: input.text || "" }, { modeId: "world-rpg" });
  const modSourceMap = createWorldbookModuleSourceMap(modPacket);
  const worldPacket = createWorldContextPacket({
    worldbook: wb, scenes, worldState: state, timeline, relations,
    activeLoreEntries: activated.activeEntries, mode: "world-rpg",
    moduleSourceMap: modSourceMap
  });
  const capsule = getModeCapsule("world-rpg");
  return { worldbook: wb, scenes, state, timeline, relations, activated, modPacket, modSourceMap, worldPacket, modeId: "world-rpg", modeMeaning: MODE_MEANING, capsule, inputText: input.text || "" };
}

export function createGrandWorldTurnPacket(project = {}, input = {}, options = {}) {
  const ctx = createGrandWorldModeContext(project, input, options);
  return { schemaVersion: 1, mode: "world-rpg", modeMeaning: MODE_MEANING, worldContextPacket: ctx.worldPacket, currentScene: (ctx.scenes.items || []).find(s => s.id === ctx.scenes.currentSceneId) || null, activeThreads: options.threads || [], proposals: [], runtime: { cacheKey: `gw.turn.${Date.now()}`, warnings: [] } };
}

export function createGrandWorldPrompt(project = {}, input = {}, options = {}) {
  const ctx = createGrandWorldModeContext(project, input, options);
  const packet = ctx.worldPacket;
  const lines = [];
  lines.push("你正在运行一个大世界互动模式。不要强制套用等级、职业、装备、经验值、打怪升级。");
  if (packet.worldIdentity?.title) lines.push("世界：" + packet.worldIdentity.title + (packet.worldIdentity.premise ? " - " + packet.worldIdentity.premise : ""));
  for (const entry of (packet.activeLoreEntries || []).slice(0, 5)) {
    lines.push("【" + (entry.title || entry.id) + "】" + (entry.content || "").slice(0, 300));
  }
  if (packet.currentScene) lines.push("当前场景：" + (packet.currentScene.title || ""));
  lines.push("使用世界书、当前场景、世界状态、时间线和关系网络来回应用户行动。可以提出状态变更提案，但不能直接改核心正史。");
  return { promptText: lines.join("\\n"), packet };
}

export function runGrandWorldTurn(project = {}, input = {}, options = {}) {
  const ctx = createGrandWorldModeContext(project, input, options);
  const turnPacket = createGrandWorldTurnPacket(project, input, options);
  const prompt = createGrandWorldPrompt(project, input, options);
  return { ctx, turnPacket, prompt, status: "ready", cacheKey: turnPacket.runtime?.cacheKey };
}

export function createGrandWorldModeSummary(project = {}, options = {}) {
  const ctx = createGrandWorldModeContext(project, { text: "" }, options);
  return { mode: "world-rpg", modeMeaning: MODE_MEANING, worldTitle: ctx.worldbook.title || "", entryCount: (ctx.worldbook.entries || []).length, sceneCount: (ctx.scenes.items || []).length, activeLore: ctx.activated?.selected || 0, modulesLoaded: ctx.modSourceMap?.worldbookModulesAvailable?.length || 0 };
}