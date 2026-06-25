// Tabletop V2 State Mutation
// Pure functions for deterministic state transitions during a tabletop run.
// All mutations are applied to runState; nothing writes to external assets.

import { advanceClock as tickClock, cloneClock } from "./tabletop-v2-clock-engine.js";

// ── Main turn consequence applicator ──

export function applyTabletopTurnConsequences({ module, runState, ruling, playerIntent } = {}) {
  if (!runState) throw new Error("runState is required");
  if (!ruling) return { runState, applied: [] };

  const applied = [];
  const state = structuredClone(runState);

  // Apply each consequence
  for (const con of ruling.consequences || []) {
    switch (con.type) {
      case "setback": {
        applied.push({ type: "setback", description: con.description || "遭遇挫折" });
        break;
      }
      case "bonus": {
        applied.push({ type: "bonus", description: con.description || "获得优势" });
        break;
      }
      case "clock_tick": {
        if (con.clockId) {
          const result = advanceClock(state, con.clockId, con.amount || 1, con.visibility || "public");
          if (result) applied.push({ type: "clock_tick", clockId: con.clockId, value: result.value });
        }
        break;
      }
      case "item_change": {
        if (con.itemPatch) {
          state = updateInventory({ runState: state, itemPatch: con.itemPatch });
          applied.push({ type: "item_change", item: con.itemPatch });
        }
        break;
      }
      case "npc_state_change": {
        if (con.npcId) {
          state = updateNpcState({ runState: state, npcId: con.npcId, patch: con.npcPatch || {}, visibility: con.visibility });
          applied.push({ type: "npc_state_change", npcId: con.npcId });
        }
        break;
      }
      case "scene_transition": {
        if (con.transitionId) {
          state = updateSceneTransition({ module, runState: state, transitionId: con.transitionId });
          applied.push({ type: "scene_transition", transitionId: con.transitionId });
        }
        break;
      }
      default:
        break;
    }
  }

  // Append narrative to scene history
  if (ruling.gmTurnText || playerIntent) {
    state.publicState = state.publicState || {};
    state.publicState.sceneHistory = [
      ...(state.publicState.sceneHistory || []),
      {
        turn: (state.turnIndex || 0),
        intent: playerIntent?.slice(0, 200) || "",
        narrative: (ruling.gmTurnText || "").slice(0, 500),
        timestamp: new Date().toISOString(),
      },
    ];
  }

  return { runState: state, applied };
}

// ── Scene transition ──

export function updateSceneTransition({ module, runState, transitionId } = {}) {
  if (!runState || !transitionId) return runState;

  const state = structuredClone(runState);
  // Find which scene contains this exit transition
  const originScene = (module?.scenes || []).find(
    (s) => (s.exitTransitions || []).some((t) => t.id === transitionId)
  );

  if (originScene) {
    const transition = originScene.exitTransitions.find((t) => t.id === transitionId);
    const targetSceneId = transition?.targetSceneId;
    state.currentSceneId = targetSceneId || originScene.sceneId;
    state.publicState = state.publicState || {};
    // Find the destination scene for its title
    const destScene = (module?.scenes || []).find((s) => s.sceneId === targetSceneId);
    state.publicState.sceneTitle = destScene?.title || originScene.title || "";
  }

  return state;
}

// ── Clock advance ──

export function advanceClock({ runState, clockId, amount = 1, visibility = "public" } = {}) {
  if (!runState || !clockId) return null;

  const state = structuredClone(runState);
  const clockList = visibility === "hidden"
    ? (state.hiddenGmState?.clocks || state.hiddenGmState?.hiddenClocks || [])
    : (state.publicState?.clocks || state.publicState?.publicClocks || []);

  const idx = clockList.findIndex((c) => c.id === clockId || c.clockId === clockId);
  if (idx === -1) return null;

  const updated = tickClock(clockList[idx], amount);

  if (visibility === "hidden") {
    const target = state.hiddenGmState?.clocks ? "clocks" : "hiddenClocks";
    state.hiddenGmState = { ...state.hiddenGmState, [target]: clockList.map((c, i) => i === idx ? updated : c) };
  } else {
    // Also update in publicClocks list
    state.publicState = state.publicState || {};
    const pubList = state.publicState.publicClocks || state.publicState.clocks || [];
    const pubIdx = pubList.findIndex((c) => c.id === clockId || c.clockId === clockId);
    if (pubIdx >= 0) {
      state.publicState.publicClocks = pubList.map((c, i) => i === pubIdx ? updated : c);
    }
  }

  return state;
}

// ── Inventory update ──

export function updateInventory({ runState, itemPatch } = {}) {
  if (!runState || !itemPatch) return runState;

  const state = structuredClone(runState);
  state.publicState = state.publicState || {};
  state.publicState.inventory = state.publicState.inventory || [];

  if (itemPatch.action === "add") {
    state.publicState.inventory = [
      ...state.publicState.inventory,
      { name: itemPatch.name || "未知物品", quantity: itemPatch.quantity || 1, notes: itemPatch.notes || "" },
    ];
  } else if (itemPatch.action === "remove") {
    state.publicState.inventory = state.publicState.inventory.filter(
      (item) => item.name !== itemPatch.name
    );
  } else if (itemPatch.action === "modify") {
    const idx = state.publicState.inventory.findIndex((item) => item.name === itemPatch.name);
    if (idx >= 0) {
      state.publicState.inventory[idx] = {
        ...state.publicState.inventory[idx],
        ...itemPatch,
        action: undefined,
      };
    }
  }

  return state;
}

// ── NPC state update ──

export function updateNpcState({ runState, npcId, patch = {}, visibility = "public" } = {}) {
  if (!runState || !npcId) return runState;

  const state = structuredClone(runState);

  if (visibility === "hidden") {
    state.hiddenGmState = state.hiddenGmState || {};
    state.hiddenGmState.npcSecrets = state.hiddenGmState.npcSecrets || {};
    state.hiddenGmState.npcSecrets[npcId] = {
      ...(state.hiddenGmState.npcSecrets[npcId] || {}),
      ...patch,
      lastUpdated: new Date().toISOString(),
    };
  } else {
    state.publicState = state.publicState || {};
    state.publicState.visibleNpcs = state.publicState.visibleNpcs || [];
    const idx = state.publicState.visibleNpcs.findIndex((n) => n.npcId === npcId);
    if (idx >= 0) {
      state.publicState.visibleNpcs[idx] = { ...state.publicState.visibleNpcs[idx], ...patch };
    } else {
      state.publicState.visibleNpcs.push({ npcId, ...patch });
    }
  }

  return state;
}
