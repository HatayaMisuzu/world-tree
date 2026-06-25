// Single Player ScriptKill V2 Package
// Entry-owned domain core for the existing “单人剧本杀” feature entry.
// This is NOT a product entry. It normalizes existing script materials for solo play.

export const SINGLE_PLAYER_SCRIPTKILL_PACKAGE_SCHEMA = "world-tree.single-player-scriptkill.v2.package.1";

function asText(value) { return String(value ?? "").trim(); }
function asArray(value) { return Array.isArray(value) ? value.filter(Boolean) : []; }
function id(prefix) { return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`; }

export function createSinglePlayerScriptKillPackage(input = {}) {
  const scriptId = asText(input.scriptId) || id("scriptkill");
  const roleBooks = asArray(input.roleBooks).map((role, index) => normalizeRoleBook(role, index));
  const phases = asArray(input.phases).map((phase, index) => normalizePhase(phase, index));
  const clueCards = asArray(input.clueCards || input.clues).map((clue, index) => normalizeClueCard(clue, index));

  return {
    schemaVersion: SINGLE_PLAYER_SCRIPTKILL_PACKAGE_SCHEMA,
    scriptId,
    entryDisplayName: "单人剧本杀",
    internalFeatureVersion: "single-player-scriptkill-v2",
    sourceType: input.sourceType || "user_imported",
    title: asText(input.title) || "未命名剧本杀",
    ownershipDeclaration: normalizeOwnership(input.ownershipDeclaration),
    playMode: {
      mode: "solo_ai_players",
      realPlayerCount: 1,
      simulatedPlayers: Math.max(0, roleBooks.length - 1),
      scriptFirst: true,
      importNotCreate: true
    },
    publicIntro: input.publicIntro || { text: asText(input.publicIntroText || input.summary) },
    roleBooks,
    dmBook: normalizeDmBook(input.dmBook),
    clueCards,
    phases,
    voteRules: input.voteRules || { mode: "single_final_vote", allowAbstain: false },
    debrief: normalizeDebrief(input.debrief),
    runtimeIsolation: {
      runtimeNamespace: "single-player-scriptkill-v2",
      saveNamespace: "engine/single-player-scriptkill-v2",
      cacheNamespace: "single-player-scriptkill-v2-cache",
      llmContextNamespace: "single-player-scriptkill-v2-llm",
      mustNotReuse: ["tabletop-v2", "detective-v2", "character-v2-live"]
    },
    moduleLayerBoundary: {
      entryOwnedCore: "src/core/single-player-scriptkill/*",
      reusableModules: "src/core/modules/scriptplay/*",
      note: "Only reusable phase/knowledge/spoiler helpers belong in module layer. Package/runtime/service stay entry-owned."
    }
  };
}

export function normalizeRoleBook(role = {}, index = 0) {
  const roleId = asText(role.roleId) || `role_${index + 1}`;
  return {
    roleId,
    roleName: asText(role.roleName || role.displayName || role.name) || `角色${index + 1}`,
    publicIdentity: asText(role.publicIdentity || role.identity) || "",
    privateIdentity: asText(role.privateIdentity) || "",
    roleBookActs: asArray(role.roleBookActs || role.acts).map((act, actIndex) => ({
      actId: asText(act.actId) || `${roleId}_act_${actIndex + 1}`,
      title: asText(act.title) || `第 ${actIndex + 1} 幕`,
      text: asText(act.text || act.content),
      unlockPhaseId: asText(act.unlockPhaseId) || null
    })),
    secrets: asArray(role.secrets).map((secret, secretIndex) => ({
      secretId: asText(secret.secretId) || `${roleId}_secret_${secretIndex + 1}`,
      text: asText(secret.text || secret.content),
      revealPolicy: secret.revealPolicy || "player_choice",
      neverRevealBeforeDebrief: secret.neverRevealBeforeDebrief === true
    })),
    personalGoals: asArray(role.personalGoals || role.missions),
    roleSpeechStyle: role.roleSpeechStyle || role.speakingStyle || {},
    roleSecretPolicy: role.roleSecretPolicy || {
      mustConceal: asArray(role.mustConceal),
      mayRevealAfter: asArray(role.mayRevealAfter),
      neverRevealBeforeDebrief: asArray(role.neverRevealBeforeDebrief)
    },
    roleKnowledgeBoundary: role.roleKnowledgeBoundary || {
      knows: asArray(role.knows),
      doesNotKnow: ["DM完整真相", "其他角色私本", "最终复盘", ...asArray(role.doesNotKnow)]
    }
  };
}

export function normalizeDmBook(dmBook = {}) {
  return {
    available: dmBook.available !== false && Boolean(dmBook.fullTruth || dmBook.phaseScript || dmBook.debriefScript || dmBook.rawText),
    rawText: asText(dmBook.rawText),
    fullTruth: dmBook.fullTruth || null,
    phaseScript: asArray(dmBook.phaseScript),
    clueReleasePlan: asArray(dmBook.clueReleasePlan),
    voteAnswerKey: dmBook.voteAnswerKey || null,
    debriefScript: dmBook.debriefScript || null,
    hiddenFromPlayer: true
  };
}

export function normalizeClueCard(clue = {}, index = 0) {
  return {
    clueId: asText(clue.clueId) || `clue_${index + 1}`,
    title: asText(clue.title) || `线索${index + 1}`,
    visibleText: asText(clue.visibleText || clue.text || clue.content),
    sourceLocation: asText(clue.sourceLocation || clue.locationId),
    phaseAvailable: asText(clue.phaseAvailable || clue.phaseId) || null,
    visibility: clue.visibility || "public",
    assignedToRoleId: asText(clue.assignedToRoleId) || null,
    relatedRoleIds: asArray(clue.relatedRoleIds),
    relatedClueIds: asArray(clue.relatedClueIds),
    dmMeaning: asText(clue.dmMeaning),
    spoilerLevel: clue.spoilerLevel || "low"
  };
}

export function normalizePhase(phase = {}, index = 0) {
  return {
    phaseId: asText(phase.phaseId) || `phase_${index + 1}`,
    title: asText(phase.title) || `阶段${index + 1}`,
    phaseType: phase.phaseType || phase.type || "custom",
    sourceAnchor: phase.sourceAnchor || null,
    dmInstructions: phase.dmInstructions || { openingLines: asArray(phase.openingLines), reminders: [], forbiddenSpoilers: [] },
    allowedActions: {
      readRoleBook: phase.allowedActions?.readRoleBook !== false,
      publicTalk: phase.allowedActions?.publicTalk !== false,
      privateTalk: phase.allowedActions?.privateTalk === true,
      search: phase.allowedActions?.search === true,
      revealClue: phase.allowedActions?.revealClue === true,
      vote: phase.allowedActions?.vote === true,
      debrief: phase.allowedActions?.debrief === true
    },
    unlocks: phase.unlocks || { roleActIds: [], clueDeckIds: [], locationIds: [] },
    completionRule: phase.completionRule || { type: "manual_or_player_confirm", fallback: "dm_manual_advance" },
    nextPhaseId: asText(phase.nextPhaseId) || null
  };
}

function normalizeOwnership(ownership = {}) {
  return {
    userConfirmedLegalAccess: ownership.userConfirmedLegalAccess === true,
    localPrivateUseOnly: ownership.localPrivateUseOnly !== false,
    noRedistribution: ownership.noRedistribution !== false,
    sourceNote: asText(ownership.sourceNote),
    importedAt: ownership.importedAt || new Date().toISOString()
  };
}

function normalizeDebrief(debrief = {}) {
  return {
    available: Boolean(debrief.summary || debrief.fullText || debrief.roleEndings || debrief.truthReview),
    summary: asText(debrief.summary),
    fullText: asText(debrief.fullText),
    roleEndings: asArray(debrief.roleEndings),
    truthReview: debrief.truthReview || null
  };
}

export function validateSinglePlayerScriptKillPackage(pkg = {}) {
  const errors = [];
  const warnings = [];
  if (pkg.schemaVersion !== SINGLE_PLAYER_SCRIPTKILL_PACKAGE_SCHEMA) errors.push("schemaVersion mismatch");
  if (!pkg.scriptId) errors.push("missing scriptId");
  if (!pkg.title) errors.push("missing title");
  if (pkg.ownershipDeclaration?.userConfirmedLegalAccess !== true) errors.push("ownershipDeclaration.userConfirmedLegalAccess required");
  if (!Array.isArray(pkg.roleBooks) || pkg.roleBooks.length < 2) errors.push("need at least 2 roleBooks");
  if (!pkg.dmBook?.available) errors.push("dmBook required for playable mode");
  if (!Array.isArray(pkg.clueCards) || pkg.clueCards.length === 0) errors.push("clueCards required");
  if (!Array.isArray(pkg.phases) || pkg.phases.length === 0) errors.push("script-defined phases required");
  if (!pkg.debrief?.available) warnings.push("debrief missing: cannot complete full scriptkill closure");
  const roleIds = new Set((pkg.roleBooks || []).map(r => r.roleId));
  for (const clue of pkg.clueCards || []) {
    if (clue.assignedToRoleId && !roleIds.has(clue.assignedToRoleId)) errors.push(`clue assignedToRoleId not found: ${clue.assignedToRoleId}`);
  }
  return { ok: errors.length === 0, playable: errors.length === 0 && warnings.length === 0, errors, warnings };
}

export function extractSinglePlayerScriptKillPlayerPackageView(pkg = {}, selectedRoleId = "") {
  const role = (pkg.roleBooks || []).find(r => r.roleId === selectedRoleId) || null;
  return {
    schemaVersion: pkg.schemaVersion,
    scriptId: pkg.scriptId,
    title: pkg.title,
    entryDisplayName: pkg.entryDisplayName || "单人剧本杀",
    publicIntro: pkg.publicIntro,
    selectedRole: role ? {
      roleId: role.roleId,
      roleName: role.roleName,
      publicIdentity: role.publicIdentity,
      privateIdentity: role.privateIdentity,
      roleBookActs: role.roleBookActs,
      secrets: role.secrets,
      personalGoals: role.personalGoals
    } : null,
    roleRoster: (pkg.roleBooks || []).map(r => ({ roleId: r.roleId, roleName: r.roleName, publicIdentity: r.publicIdentity })),
    phases: (pkg.phases || []).map(p => ({ phaseId: p.phaseId, title: p.title, phaseType: p.phaseType, allowedActions: p.allowedActions })),
    publicClues: (pkg.clueCards || []).filter(c => c.visibility === "public").map(c => ({ clueId: c.clueId, title: c.title, visibleText: c.visibleText, spoilerLevel: c.spoilerLevel })),
    dmBook: undefined,
    fullTruth: undefined,
    debrief: undefined
  };
}
