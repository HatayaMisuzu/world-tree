/**
 * s3-2: location graph — nodes + edges with travel duration (calendar days / periods).
 * Minimal-sufficient for 「旅行到远处地点」→ Δt via worldTick.
 * Deterministic: no wall-clock; path cost is pure over graph + endpoints.
 */

/**
 * @typedef {{ id: string, name?: string, regionId?: string, [k: string]: unknown }} LocationNode
 * @typedef {{ from: string, to: string, durationDays: number, bidirectional?: boolean, [k: string]: unknown }} LocationEdge
 * @typedef {{ nodes: LocationNode[], edges: LocationEdge[], byId: Record<string, LocationNode> }} LocationGraph
 */

/**
 * @param {{ nodes?: LocationNode[], edges?: LocationEdge[] }} input
 * @returns {LocationGraph}
 */
export function createLocationGraph(input = {}) {
  const nodes = Array.isArray(input.nodes) ? input.nodes.filter((n) => n && n.id) : [];
  const byId = Object.fromEntries(nodes.map((n) => [n.id, { ...n }]));
  const edges = [];
  for (const raw of Array.isArray(input.edges) ? input.edges : []) {
    if (!raw?.from || !raw?.to) continue;
    const durationDays = Math.max(0, Number(raw.durationDays) || 0);
    const edge = { from: String(raw.from), to: String(raw.to), durationDays, bidirectional: raw.bidirectional !== false };
    edges.push(edge);
  }
  return { nodes: nodes.map((n) => ({ ...n })), edges, byId };
}

/** Find a node by id or exact/contained name match (case-insensitive). */
export function findLocationNode(graph, query = "") {
  const q = String(query || "").trim();
  if (!q || !graph) return null;
  if (graph.byId?.[q]) return graph.byId[q];
  const lower = q.toLowerCase();
  const nodes = graph.nodes || [];
  for (const n of nodes) {
    if (String(n.name || "").toLowerCase() === lower) return n;
  }
  for (const n of nodes) {
    const name = String(n.name || "");
    if (name && (q.includes(name) || name.includes(q))) return n;
  }
  return null;
}

/**
 * Adjacency list: fromId → [{ to, durationDays }]
 * Bidirectional edges (default) expand both ways with the same cost.
 */
function adjacency(graph) {
  const map = new Map();
  const ensure = (id) => {
    if (!map.has(id)) map.set(id, []);
    return map.get(id);
  };
  for (const e of graph?.edges || []) {
    ensure(e.from).push({ to: e.to, durationDays: e.durationDays });
    if (e.bidirectional !== false) {
      ensure(e.to).push({ to: e.from, durationDays: e.durationDays });
    }
  }
  return map;
}

/**
 * Shortest travel duration (sum of edge durationDays) via Dijkstra.
 * @returns {{ durationDays: number, path: string[] } | null}
 */
export function travelDuration(graph, fromId, toId) {
  const from = String(fromId || "");
  const to = String(toId || "");
  if (!from || !to) return null;
  if (from === to) return { durationDays: 0, path: [from] };

  const adj = adjacency(graph);
  const dist = new Map([[from, 0]]);
  const prev = new Map();
  const visited = new Set();
  // simple O(V^2) pick — graphs are tiny
  while (true) {
    let u = null;
    let best = Infinity;
    for (const [id, d] of dist) {
      if (!visited.has(id) && d < best) {
        best = d;
        u = id;
      }
    }
    if (u == null) break;
    if (u === to) break;
    visited.add(u);
    for (const { to: v, durationDays } of adj.get(u) || []) {
      const next = best + durationDays;
      if (!dist.has(v) || next < dist.get(v)) {
        dist.set(v, next);
        prev.set(v, u);
      }
    }
  }
  if (!dist.has(to)) return null;
  const path = [];
  let cur = to;
  while (cur) {
    path.push(cur);
    if (cur === from) break;
    cur = prev.get(cur);
  }
  path.reverse();
  if (path[0] !== from) return null;
  return { durationDays: dist.get(to), path };
}

/**
 * Detect travel intent from player input against a location graph.
 * Phrases: 前往/去/到达/旅行到/启程前往 + destination name/id present in graph.
 * @returns {{ fromId: string, toId: string, durationDays: number, path: string[], reason: string, matchedName: string } | null}
 */
export function resolveTravelIntent(input = "", graph = null, currentLocationId = "") {
  if (!graph || !Array.isArray(graph.nodes) || graph.nodes.length === 0) return null;
  const text = String(input || "").trim();
  if (!text) return null;

  const travelCue = /前往|启程|上路|旅行到|旅行去|赶往|到达|来到|走到|去\s*|出发去|出发前往|travel\s+to|go\s+to|head\s+(?:to|for)/i;
  if (!travelCue.test(text)) return null;

  // Prefer the longest name match that appears in the input (avoid matching current location).
  const fromId = String(currentLocationId || "");
  let best = null;
  for (const node of graph.nodes) {
    if (!node?.id) continue;
    if (node.id === fromId) continue;
    const labels = [node.id, node.name].filter(Boolean).map(String);
    for (const label of labels) {
      if (!label || !text.includes(label)) continue;
      if (!best || label.length > best.matchedName.length) {
        best = { node, matchedName: label };
      }
    }
  }
  if (!best) return null;

  const toId = best.node.id;
  const route = travelDuration(graph, fromId || toId, toId);
  // If no fromId, treat as already-there / unknown start → still require a path from some node?
  // Minimal: if from missing, use direct edge cost lookup as 0 only when same; else need from.
  if (!fromId) {
    // Without a known start, cannot cost a path — still allow destination update with 0 Δt? Prefer null.
    return null;
  }
  if (!route) return null;
  // Distant travel must consume time when there is a positive edge cost; 0-cost same-node already excluded.
  return {
    fromId,
    toId,
    durationDays: route.durationDays,
    path: route.path,
    reason: "travel",
    matchedName: best.matchedName
  };
}

export default {
  createLocationGraph,
  findLocationNode,
  travelDuration,
  resolveTravelIntent
};
