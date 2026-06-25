// Tabletop V2 NPC State Management
// Tracks NPC disposition, location, knowledge, and secrets during a run.

// ── Create NPC state entry ──

export function createNpcState(npcDef = {}, options = {}) {
  return {
    npcId: npcDef.npcId || npcDef.name || `npc_${Date.now()}`,
    name: npcDef.name || "未命名 NPC",
    role: npcDef.role || "",
    disposition: npcDef.disposition || "neutral",   // friendly / neutral / hostile
    location: npcDef.location || options.defaultLocation || "unknown",
    alive: npcDef.alive !== undefined ? npcDef.alive : true,
    knowledge: npcDef.knowledge || [],               // things the NPC knows
    secrets: npcDef.secrets || {},                    // hidden from player
    visibleToPlayer: options.isVisible !== undefined ? options.isVisible : true,
    lastInteraction: null,
    statusEffects: [],
    stats: npcDef.stats || {},
    notes: npcDef.notes || "",
  };
}

// ── Update NPC state ──

export function mutateNpcState(npcState = {}, patch = {}) {
  return {
    ...npcState,
    ...patch,
    lastInteraction: new Date().toISOString(),
    secrets: patch.secrets ? { ...npcState.secrets, ...patch.secrets } : npcState.secrets,
    knowledge: patch.knowledge
      ? [...(npcState.knowledge || []), ...(Array.isArray(patch.knowledge) ? patch.knowledge : [patch.knowledge])]
      : npcState.knowledge,
    statusEffects: patch.statusEffects
      ? [...(npcState.statusEffects || []), ...patch.statusEffects]
      : npcState.statusEffects,
  };
}

// ── NPC disposition shift ──

export function shiftNpcDisposition(npcState = {}, delta = 0) {
  const scale = ["hostile", "unfriendly", "neutral", "friendly", "ally"];
  const currentIdx = scale.indexOf(npcState.disposition || "neutral");
  const newIdx = Math.max(0, Math.min(scale.length - 1, currentIdx + delta));
  return { ...npcState, disposition: scale[newIdx] };
}

// ── Bulk NPC initializer from module characters ──

export function initializeNpcStatesFromModule(module = {}) {
  const npcStates = [];
  const characters = module.characters || [];

  for (const char of characters) {
    if (!char.isNpc) continue;
    npcStates.push(createNpcState({
      npcId: char.name || `npc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: char.name,
      role: char.role || "",
      stats: char.stats || {},
      notes: char.notes || "",
    }));
  }

  // Also add GM book NPCs
  const gmNpcs = module.gmBook?.npcs || [];
  for (const npc of gmNpcs) {
    const exists = npcStates.find((n) => n.name === npc.name);
    if (!exists) {
      npcStates.push(createNpcState({
        ...npc,
        npcId: npc.name || `npc_gm_${Date.now()}`,
      }));
    }
  }

  return npcStates;
}

// ── Get NPC from run state ──

export function getNpcFromRunState(runState = {}, npcId = "") {
  const visible = (runState.publicState?.visibleNpcs || []).find(
    (n) => n.npcId === npcId || n.name === npcId
  );
  if (visible) return visible;

  const hidden = runState.hiddenGmState?.npcSecrets?.[npcId];
  if (hidden) return { npcId, ...hidden };

  return null;
}
