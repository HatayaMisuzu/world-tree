// faction-graph.js — M6 Organization / Faction Graph
// Part of P3 Legacy Mechanism Expansion Kernel
// Data tier: shared (public relations), hidden (secret relations)
// Secret relations must NOT leak to player-visible text

const RELATION_TYPES = ["ally", "enemy", "neutral", "vassal", "trade", "secret"];

export function createFactionGraph() {
  return {
    version: 1,
    factions: {},
    relations: [],
    updatedAt: new Date().toISOString()
  };
}

export function addFaction(graph, { id, name, type = "generic", goals = [], resources = {}, leaders = [], knownToPlayer = true } = {}) {
  if (!id || !name) throw new Error("faction requires id and name");
  graph.factions[id] = { id, name, type, goals, resources, leaders, knownToPlayer };
  graph.updatedAt = new Date().toISOString();
  return graph;
}

export function addRelation(graph, { from, to, type = "neutral", publicKnown = true, strength = 0 } = {}) {
  if (!from || !to) throw new Error("relation requires from and to");
  if (!RELATION_TYPES.includes(type)) throw new Error(`invalid relation type: ${type}`);
  graph.relations.push({ from, to, type, publicKnown, strength, sourceRefs: [] });
  graph.updatedAt = new Date().toISOString();
  return graph;
}

export function getPublicRelations(graph) {
  return graph.relations.filter(r => r.publicKnown === true);
}

export function getSecretRelations(graph) {
  return graph.relations.filter(r => !r.publicKnown || r.type === "secret");
}

export function getFactionDigest(graph, factionId) {
  const faction = graph.factions[factionId];
  if (!faction) return null;
  const rels = graph.relations.filter(r => r.from === factionId || r.to === factionId)
    .filter(r => r.publicKnown);
  return { faction, relations: rels };
}

export function proposeFactionChange(graph, proposal) {
  // Returns a proposal candidate — never directly modifies shared
  return {
    type: "faction_change",
    targetGraph: graph,
    change: proposal,
    status: "candidate",
    requiresApproval: true,
    note: "Faction topology changes must go through proposal approval."
  };
}

export function isRelationPublic(graph, from, to) {
  const rel = graph.relations.find(r =>
    (r.from === from && r.to === to) || (r.from === to && r.to === from)
  );
  return rel ? rel.publicKnown : false;
}
