// Tabletop V2 Inventory & Resource Tracking
// Manages party inventory, resources (gold, supplies, etc.), and quest log.

// ── Resource defaults ──

const DEFAULT_RESOURCES = {
  gold: 0,
  supplies: 0,
  hitPoints: { current: 10, max: 10 },
  mana: { current: 0, max: 0 },
  xp: 0,
};

// ── Initialize resources ──

export function initializeResources(custom = {}) {
  return { ...DEFAULT_RESOURCES, ...custom };
}

// ── Modify resource ──

export function modifyResource(resources = {}, key = "", delta = 0) {
  const updated = { ...resources };
  const current = updated[key];

  if (typeof current === "object" && current !== null && "current" in current) {
    updated[key] = {
      ...current,
      current: Math.max(0, Math.min(current.max || Infinity, current.current + delta)),
    };
  } else if (typeof current === "number") {
    updated[key] = Math.max(0, current + delta);
  } else {
    updated[key] = delta;
  }

  return updated;
}

// ── Add inventory item ──

export function addInventoryItem(inventory = [], item = {}) {
  if (!item.name) return inventory;

  const existing = inventory.findIndex(
    (i) => i.name === item.name && (!i.notes || i.notes === (item.notes || ""))
  );

  if (existing >= 0 && item.stackable !== false) {
    const updated = [...inventory];
    updated[existing] = {
      ...updated[existing],
      quantity: (updated[existing].quantity || 1) + (item.quantity || 1),
    };
    return updated;
  }

  return [...inventory, {
    name: item.name,
    quantity: item.quantity || 1,
    notes: item.notes || "",
    category: item.category || "misc",
  }];
}

// ── Remove inventory item ──

export function removeInventoryItem(inventory = [], itemName = "", quantity = 1) {
  const idx = inventory.findIndex((i) => i.name === itemName);
  if (idx === -1) return inventory;

  const updated = [...inventory];
  const current = updated[idx];
  const newQty = (current.quantity || 1) - quantity;

  if (newQty <= 0) {
    updated.splice(idx, 1);
  } else {
    updated[idx] = { ...current, quantity: newQty };
  }

  return updated;
}

// ── Quest log management ──

export function addQuest(questLog = [], quest = {}) {
  return [...questLog, {
    questId: quest.questId || `quest_${Date.now()}`,
    title: quest.title || "未命名任务",
    description: quest.description || "",
    status: quest.status || "active",      // active / completed / failed
    objectives: quest.objectives || [],
    reward: quest.reward || "",
    createdAt: new Date().toISOString(),
  }];
}

export function updateQuestObjective(questLog = [], questId = "", objectiveIndex = 0, completed = true) {
  return questLog.map((q) => {
    if (q.questId !== questId) return q;
    const objectives = [...(q.objectives || [])];
    if (objectives[objectiveIndex]) {
      objectives[objectiveIndex] = { ...objectives[objectiveIndex], completed };
    }
    // Check if all objectives completed
    const allDone = objectives.length > 0 && objectives.every((o) => o.completed);
    return { ...q, objectives, status: allDone ? "completed" : q.status };
  });
}

export function completeQuest(questLog = [], questId = "") {
  return questLog.map((q) =>
    q.questId === questId ? { ...q, status: "completed", completedAt: new Date().toISOString() } : q
  );
}

// ── Party stats snapshot ──

export function buildPartySnapshot(inventory = [], resources = {}, visibleNpcs = []) {
  return {
    inventory: [...inventory],
    resources: { ...resources },
    partySize: 1 + visibleNpcs.filter((n) => n.disposition === "ally" || n.disposition === "friendly").length,
    totalGold: resources.gold || 0,
    itemCount: inventory.reduce((sum, item) => sum + (item.quantity || 1), 0),
  };
}
