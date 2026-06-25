// Single Player ScriptKill V2 Runtime State
// Entry-owned run state. Player view must never include dmBook/full truth.

import { extractSinglePlayerScriptKillPlayerPackageView } from "./single-player-scriptkill-package.js";
import { createSimulatedPlayersForRoles } from "./single-player-scriptkill-simulated-player.js";

function now() { return new Date().toISOString(); }
function asArray(v) { return Array.isArray(v) ? v.filter(Boolean) : []; }
function id(prefix) { return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`; }

export function createSinglePlayerScriptKillRun(packageData = {}, options = {}) {
  const realPlayerRoleId = options.realPlayerRoleId || packageData.roleBooks?.[0]?.roleId || "";
  const firstPhase = packageData.phases?.[0] || null;
  const simulatedPlayers = createSimulatedPlayersForRoles(packageData.roleBooks || [], realPlayerRoleId);
  return {
    schemaVersion: "world-tree.single-player-scriptkill.v2.run.1",
    runId: options.runId || id("sk_run"),
    scriptId: packageData.scriptId,
    title: packageData.title,
    entryDisplayName: "单人剧本杀",
    createdAt: now(),
    updatedAt: now(),
    realPlayerRoleId,
    currentPhaseId: firstPhase?.phaseId || "",
    phaseHistory: firstPhase ? [{ to: firstPhase.phaseId, at: now(), reason: "start" }] : [],
    simulatedPlayers,
    publicBoard: {
      publicFacts: [],
      revealedClueIds: [],
      transcript: []
    },
    privateState: {
      rolePrivateNotes: { [realPlayerRoleId]: [] },
      privateChats: [],
      privateClueIds: []
    },
    searchState: {
      searchedLocationIds: [],
      foundClueIds: [],
      privateKeptClueIds: []
    },
    voteState: {
      open: false,
      votes: [],
      finalVoteSubmitted: false
    },
    debriefState: {
      unlocked: false,
      viewedAt: null
    },
    audit: []
  };
}

export function stripSinglePlayerScriptKillRunForPlayer(packageData = {}, runState = {}) {
  const selectedRoleId = runState.realPlayerRoleId;
  const packageView = extractSinglePlayerScriptKillPlayerPackageView(packageData, selectedRoleId);
  const simulatedPlayerPublic = asArray(runState.simulatedPlayers).map(p => {
    const role = (packageData.roleBooks || []).find(r => r.roleId === p.assignedRoleId) || {};
    return {
      assignedRoleId: p.assignedRoleId,
      roleName: role.roleName || p.assignedRoleName,
      publicIdentity: role.publicIdentity,
      displayName: role.roleName || p.assignedRoleName,
      playerDisplayName: undefined,
      relationshipToRealUser: "stranger"
    };
  });
  return {
    runId: runState.runId,
    scriptId: runState.scriptId,
    title: runState.title,
    entryDisplayName: "单人剧本杀",
    currentPhaseId: runState.currentPhaseId,
    phaseHistory: runState.phaseHistory,
    packageView,
    simulatedPlayers: simulatedPlayerPublic,
    publicBoard: runState.publicBoard,
    privateState: {
      rolePrivateNotes: runState.privateState?.rolePrivateNotes?.[selectedRoleId] || [],
      privateChats: asArray(runState.privateState?.privateChats).filter(c => [c.fromRoleId, c.toRoleId].includes(selectedRoleId)),
      privateClueIds: runState.privateState?.privateClueIds || []
    },
    searchState: runState.searchState,
    voteState: runState.voteState,
    debriefState: runState.debriefState,
    dmBook: undefined,
    fullTruth: undefined,
    simulatedPlayerDebug: undefined
  };
}

export function recordPublicMessage(runState = {}, message = {}) {
  const next = structuredClone(runState);
  next.publicBoard.transcript.push({ ...message, timestamp: now() });
  next.updatedAt = now();
  return next;
}

export function recordPrivateChat(runState = {}, chat = {}) {
  const next = structuredClone(runState);
  next.privateState.privateChats.push({ conversationId: chat.conversationId || id("priv"), ...chat, timestamp: now() });
  next.updatedAt = now();
  return next;
}

export function revealClue(runState = {}, clueId = "", options = {}) {
  const next = structuredClone(runState);
  if (options.public === true) next.publicBoard.revealedClueIds = [...new Set([...asArray(next.publicBoard.revealedClueIds), clueId])];
  else next.searchState.privateKeptClueIds = [...new Set([...asArray(next.searchState.privateKeptClueIds), clueId])];
  if (options.found !== false) next.searchState.foundClueIds = [...new Set([...asArray(next.searchState.foundClueIds), clueId])];
  next.updatedAt = now();
  return next;
}

export function recordVote(runState = {}, vote = {}) {
  const next = structuredClone(runState);
  next.voteState.votes.push({ voteId: id("vote"), ...vote, timestamp: now() });
  next.voteState.finalVoteSubmitted = vote.final === true || next.voteState.finalVoteSubmitted;
  next.updatedAt = now();
  return next;
}

export function validateSinglePlayerScriptKillRunState(runState = {}) {
  const errors = [];
  if (runState.schemaVersion !== "world-tree.single-player-scriptkill.v2.run.1") errors.push("run schemaVersion mismatch");
  if (!runState.runId) errors.push("missing runId");
  if (!runState.scriptId) errors.push("missing scriptId");
  if (!runState.realPlayerRoleId) errors.push("missing realPlayerRoleId");
  if (!runState.currentPhaseId) errors.push("missing currentPhaseId");
  return { ok: errors.length === 0, errors };
}
