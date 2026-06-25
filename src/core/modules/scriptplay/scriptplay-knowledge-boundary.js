// Reusable Scriptplay Knowledge Boundary
// Ensures simulated players only speak from assigned role + public board + current phase.

import { scanScriptplaySpoilers } from "./scriptplay-spoiler-guard.js";

function asArray(v) { return Array.isArray(v) ? v.filter(Boolean) : []; }

export function buildKnowledgeBoundaryContext({ packageData = {}, runState = {}, roleId = "", phase = null } = {}) {
  const role = asArray(packageData.roleBooks).find(r => r.roleId === roleId) || null;
  const publicBoard = runState.publicBoard || { revealedClueIds: [], publicFacts: [], transcript: [] };
  const visibleClues = asArray(packageData.clueCards).filter(c =>
    c.visibility === "public" || asArray(publicBoard.revealedClueIds).includes(c.clueId) || c.assignedToRoleId === roleId
  );
  const secretSnippets = asArray(packageData.roleBooks)
    .filter(r => r.roleId !== roleId)
    .flatMap(r => asArray(r.secrets).map(s => s.text).filter(Boolean));
  if (packageData.dmBook?.fullTruth) secretSnippets.push(JSON.stringify(packageData.dmBook.fullTruth).slice(0, 300));
  return { role, phase, visibleClues, publicBoard, secretSnippets };
}

export function validateSimulatedPlayerSpeech(text = "", context = {}) {
  const errors = [];
  const warnings = [];
  if (!context.role) errors.push("missing assigned role");
  const spoilerScan = scanScriptplaySpoilers(text, { secretSnippets: context.secretSnippets, forbiddenTerms: ["AI", "prompt", "DM手册", "完整真相"] });
  if (!spoilerScan.ok) errors.push("spoiler or OOC leakage detected");
  if (/我这个玩家|我扮演的角色|作为玩家/.test(String(text))) errors.push("simulated player layer leaked into immersive speech");
  if (context.phase?.allowedActions?.publicTalk === false && context.channel === "public") warnings.push("current phase does not allow public talk");
  return { ok: errors.length === 0, errors, warnings, findings: spoilerScan.findings };
}

export function buildSimulatedPlayerPromptContext({ packageData = {}, runState = {}, simulatedPlayer = {}, channel = "public", targetRoleId = "" } = {}) {
  const phase = runState.currentPhase || asArray(packageData.phases).find(p => p.phaseId === runState.currentPhaseId) || null;
  const boundary = buildKnowledgeBoundaryContext({ packageData, runState, roleId: simulatedPlayer.assignedRoleId, phase });
  const role = boundary.role || {};
  return {
    instruction: "你是陌生剧本杀玩家代理，正在尽量扮演分配的剧本角色。输出必须角色内，不得提 AI、系统、prompt、DM手册、模拟玩家。默认以角色名发言。",
    channel,
    targetRoleId,
    phase: phase ? { phaseId: phase.phaseId, title: phase.title, phaseType: phase.phaseType, allowedActions: phase.allowedActions } : null,
    role: {
      roleId: role.roleId,
      roleName: role.roleName,
      publicIdentity: role.publicIdentity,
      privateIdentity: role.privateIdentity,
      roleSpeechStyle: role.roleSpeechStyle,
      roleSecretPolicy: role.roleSecretPolicy,
      roleKnowledgeBoundary: role.roleKnowledgeBoundary
    },
    simulatedPlayerStyle: simulatedPlayer.playerStyle || {},
    publicFacts: asArray(boundary.publicBoard.publicFacts).slice(-20),
    visibleClues: boundary.visibleClues.map(c => ({ clueId: c.clueId, title: c.title, visibleText: c.visibleText })).slice(0, 20),
    outputRules: [
      "使用角色名与角色口吻，避免 OOC。",
      "不要泄露其他角色私本、DM隐藏真相、复盘答案。",
      "可以犹豫、回避、含糊、反问，但不能直接跳出剧本杀。",
      "AI玩家风格只影响表达，不覆盖角色秘密策略。"
    ]
  };
}
