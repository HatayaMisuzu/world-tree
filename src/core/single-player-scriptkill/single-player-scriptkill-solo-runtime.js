// Single Player ScriptKill V2 Solo Runtime
// Entry-owned runtime orchestration. Reuses scriptplay module-layer helpers.

import { getCurrentScriptPhase, canPerformPhaseAction, advanceScriptPhase, getPhaseUnlockedClueIds } from "../modules/scriptplay/scriptplay-phase-engine.js";
import { buildKnowledgeBoundaryContext, validateSimulatedPlayerSpeech } from "../modules/scriptplay/scriptplay-knowledge-boundary.js";
import { sanitizeImmersiveSpeech } from "../modules/scriptplay/scriptplay-spoiler-guard.js";
import { buildRoleFirstMessageEnvelope } from "./single-player-scriptkill-simulated-player.js";
import { recordPublicMessage, recordPrivateChat, revealClue, recordVote, stripSinglePlayerScriptKillRunForPlayer } from "./single-player-scriptkill-runtime-state.js";

function asArray(v) { return Array.isArray(v) ? v.filter(Boolean) : []; }
function now() { return new Date().toISOString(); }

export function readCurrentRoleAct(packageData = {}, runState = {}, roleId = "") {
  const phase = getCurrentScriptPhase(packageData, runState);
  const role = asArray(packageData.roleBooks).find(r => r.roleId === (roleId || runState.realPlayerRoleId));
  if (!role) return { status: "error", code: "ROLE_NOT_FOUND" };
  const acts = asArray(role.roleBookActs).filter(act => !act.unlockPhaseId || act.unlockPhaseId === phase?.phaseId || runState.phaseHistory?.some(h => h.to === act.unlockPhaseId));
  return { status: "ok", phase, role: { roleId: role.roleId, roleName: role.roleName }, acts };
}

export function performPublicTalk({ packageData = {}, runState = {}, realPlayerText = "", simulatedRoleIds = [] } = {}) {
  const phase = getCurrentScriptPhase(packageData, runState);
  if (!canPerformPhaseAction(phase, "publicTalk")) return { status: "error", code: "PHASE_PUBLIC_TALK_NOT_ALLOWED", phase };
  let next = runState;
  if (realPlayerText) {
    next = recordPublicMessage(next, { channel: "public", speaker: { speakerType: "real_player", assignedRoleId: next.realPlayerRoleId, visibleName: getRoleName(packageData, next.realPlayerRoleId) }, text: realPlayerText });
  }
  const aiMessages = buildDeterministicAiPublicResponses(packageData, next, simulatedRoleIds);
  for (const message of aiMessages) next = recordPublicMessage(next, message);
  return { status: "ok", phase, messages: aiMessages, runState: next, playerRun: stripSinglePlayerScriptKillRunForPlayer(packageData, next) };
}

export function performPrivateChat({ packageData = {}, runState = {}, targetRoleId = "", text = "" } = {}) {
  const phase = getCurrentScriptPhase(packageData, runState);
  if (!canPerformPhaseAction(phase, "privateTalk")) return { status: "error", code: "PHASE_PRIVATE_CHAT_NOT_ALLOWED", phase };
  const targetPlayer = asArray(runState.simulatedPlayers).find(p => p.assignedRoleId === targetRoleId);
  if (!targetPlayer) return { status: "error", code: "TARGET_ROLE_NOT_SIMULATED" };
  const role = asArray(packageData.roleBooks).find(r => r.roleId === targetRoleId) || {};
  const responseText = buildConstrainedRoleResponse({ packageData, runState, simulatedPlayer: targetPlayer, role, userText: text, channel: "private" });
  const chat = { fromRoleId: runState.realPlayerRoleId, toRoleId: targetRoleId, userText: text, responseText, exchangedClueIds: [], disclosedSecrets: [] };
  const next = recordPrivateChat(runState, chat);
  return { status: "ok", phase, chat, runState: next, playerRun: stripSinglePlayerScriptKillRunForPlayer(packageData, next) };
}

export function performSearch({ packageData = {}, runState = {}, locationId = "", clueId = "", keepPrivate = true } = {}) {
  const phase = getCurrentScriptPhase(packageData, runState);
  if (!canPerformPhaseAction(phase, "search")) return { status: "error", code: "PHASE_SEARCH_NOT_ALLOWED", phase };
  const unlocked = getPhaseUnlockedClueIds(packageData, phase);
  const candidates = asArray(packageData.clueCards).filter(c =>
    (!locationId || c.sourceLocation === locationId) &&
    (!c.phaseAvailable || c.phaseAvailable === phase.phaseId || unlocked.includes(c.clueId))
  );
  const clue = candidates.find(c => c.clueId === clueId) || candidates[0];
  if (!clue) return { status: "error", code: "NO_CLUE_AVAILABLE", phase, locationId };
  const next = revealClue(runState, clue.clueId, { public: keepPrivate === false, found: true });
  return { status: "ok", phase, clue: playerClueView(clue), keepPrivate, runState: next, playerRun: stripSinglePlayerScriptKillRunForPlayer(packageData, next) };
}

export function performRevealClue({ packageData = {}, runState = {}, clueId = "" } = {}) {
  const phase = getCurrentScriptPhase(packageData, runState);
  if (!canPerformPhaseAction(phase, "revealClue")) return { status: "error", code: "PHASE_REVEAL_CLUE_NOT_ALLOWED", phase };
  const clue = asArray(packageData.clueCards).find(c => c.clueId === clueId);
  if (!clue) return { status: "error", code: "CLUE_NOT_FOUND" };
  const next = revealClue(runState, clueId, { public: true, found: true });
  return { status: "ok", phase, clue: playerClueView(clue), runState: next, playerRun: stripSinglePlayerScriptKillRunForPlayer(packageData, next) };
}

export function performVote({ packageData = {}, runState = {}, targetRoleId = "", reason = "" } = {}) {
  const phase = getCurrentScriptPhase(packageData, runState);
  if (!canPerformPhaseAction(phase, "vote")) return { status: "error", code: "PHASE_VOTE_NOT_ALLOWED", phase };
  const next = recordVote(runState, { voterRoleId: runState.realPlayerRoleId, targetRoleId, reason, final: true });
  return { status: "ok", phase, voteState: next.voteState, runState: next, playerRun: stripSinglePlayerScriptKillRunForPlayer(packageData, next) };
}

export function performDebrief({ packageData = {}, runState = {} } = {}) {
  const phase = getCurrentScriptPhase(packageData, runState);
  if (!canPerformPhaseAction(phase, "debrief")) return { status: "error", code: "PHASE_DEBRIEF_NOT_ALLOWED", phase };
  if (!packageData.debrief?.available && !packageData.dmBook?.debriefScript) return { status: "error", code: "DEBRIEF_MISSING" };
  return {
    status: "ok",
    phase,
    debrief: {
      summary: packageData.debrief?.summary || packageData.dmBook?.debriefScript?.summary || "",
      roleEndings: packageData.debrief?.roleEndings || [],
      truthReview: packageData.debrief?.truthReview || packageData.dmBook?.fullTruth || null
    },
    voteState: runState.voteState
  };
}

export function advanceSinglePlayerScriptKillPhase({ packageData = {}, runState = {}, nextPhaseId = "", reason = "manual" } = {}) {
  return advanceScriptPhase(packageData, runState, { nextPhaseId, reason });
}

function buildDeterministicAiPublicResponses(packageData, runState, roleIds = []) {
  const players = asArray(runState.simulatedPlayers).filter(p => !roleIds.length || roleIds.includes(p.assignedRoleId)).slice(0, 3);
  return players.map(player => {
    const role = asArray(packageData.roleBooks).find(r => r.roleId === player.assignedRoleId) || {};
    const text = buildConstrainedRoleResponse({ packageData, runState, simulatedPlayer: player, role, channel: "public" });
    return buildRoleFirstMessageEnvelope({ text, simulatedPlayer: player, role, channel: "public", meta: { knowledgeChecked: true } });
  });
}

function buildConstrainedRoleResponse({ packageData, runState, simulatedPlayer, role, userText = "", channel = "public" }) {
  const boundary = buildKnowledgeBoundaryContext({ packageData, runState, roleId: role.roleId, phase: getCurrentScriptPhase(packageData, runState) });
  const secretCount = asArray(role.secrets).length;
  let text = "";
  if (userText && /为什么|解释|证据|时间|你/.test(userText)) {
    text = secretCount ? "这件事我确实不太好解释，但我能说的只有目前公开的这些。你要是有线索，可以拿出来一起看。" : "我只能按我知道的说。现在公开的信息还不够，我不想急着下结论。";
  } else if ((simulatedPlayer.playerStyle?.talkativeness || 0) > 0.6) {
    text = "我先说一下我知道的部分：目前公开线索里有些地方对不上，我们最好按时间线重新盘一遍。";
  } else if ((simulatedPlayer.playerStyle?.defensiveness || 0) > 0.65) {
    text = "你们别急着把问题推到我身上。现在公开的线索还不能说明什么。";
  } else {
    text = "我目前没有更多能公开的信息。先看看下一张线索再说。";
  }
  text = sanitizeImmersiveSpeech(text);
  const validation = validateSimulatedPlayerSpeech(text, { ...boundary, channel });
  if (!validation.ok) return "我先保留意见。现在这些信息还不足以说明最终真相。";
  return text;
}

function getRoleName(packageData, roleId) { return asArray(packageData.roleBooks).find(r => r.roleId === roleId)?.roleName || roleId || "你"; }
function playerClueView(clue) { return { clueId: clue.clueId, title: clue.title, visibleText: clue.visibleText, spoilerLevel: clue.spoilerLevel, visibility: clue.visibility }; }
