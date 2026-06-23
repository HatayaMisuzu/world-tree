const RINGS = ["core", "near", "far", "dormant"];

function clampDistance(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : fallback;
}

function relationDistance(candidate = {}, relations = [], protagonistId = "") {
  if (Number.isFinite(Number(candidate.relationDistance))) return clampDistance(candidate.relationDistance, 0.75);
  const relation = relations.find((item) => {
    const pair = [item.fromId, item.toId, item.sourceId, item.targetId];
    return pair.includes(protagonistId) && pair.includes(candidate.id);
  });
  if (!relation) return 0.75;
  if (Number.isFinite(Number(relation.distance))) return clampDistance(relation.distance, 0.75);
  const closeness = Number(relation.closeness ?? relation.strength);
  return Number.isFinite(closeness) ? clampDistance(1 - closeness, 0.75) : 0.5;
}

function locationDistance(candidate = {}, currentLocationId = "") {
  if (Number.isFinite(Number(candidate.locationDistance))) return clampDistance(candidate.locationDistance, 0.75);
  const locationId = candidate.locationId || candidate.location?.id || "";
  if (!locationId || !currentLocationId) return 0.75;
  if (locationId === currentLocationId) return 0;
  if (candidate.regionId && candidate.regionId === candidate.currentRegionId) return 0.4;
  return 0.75;
}

function timeDistance(candidate = {}) {
  return clampDistance(candidate.timeDistance ?? candidate.temporalDistance, 0.5);
}

function ringFor(score) {
  if (score < 0.25) return "core";
  if (score < 0.5) return "near";
  if (score < 0.75) return "far";
  return "dormant";
}

export function createProximityFingerprint(input = {}) {
  const candidates = Array.isArray(input.candidates) ? input.candidates : [];
  const relations = Array.isArray(input.relations) ? input.relations : [];
  return JSON.stringify({
    sceneId: input.currentScene?.sceneId || input.currentScene?.id || "",
    protagonistId: input.protagonistId || "",
    currentLocationId: input.currentLocationId || input.currentScene?.locationId || "",
    candidates: candidates.map((item) => [item.id, item.locationId, item.updatedAt]),
    relations: relations.map((item) => [item.id, item.fromId, item.toId, item.updatedAt])
  });
}

export function calculateProximityScope(input = {}, previous = null) {
  const fingerprint = createProximityFingerprint(input);
  if (previous?.fingerprint === fingerprint && input.options?.force !== true) {
    return { ...previous, reused: true };
  }
  const protagonistId = input.protagonistId || "";
  const currentLocationId = input.currentLocationId || input.currentScene?.locationId || "";
  const relations = Array.isArray(input.relations) ? input.relations : [];
  const rings = Object.fromEntries(RINGS.map((ring) => [ring, []]));
  const scores = {};
  const reasons = {};
  for (const candidate of Array.isArray(input.candidates) ? input.candidates : []) {
    if (!candidate?.id) continue;
    const distances = {
      location: locationDistance(candidate, currentLocationId),
      time: timeDistance(candidate),
      relation: relationDistance(candidate, relations, protagonistId)
    };
    const score = Number((distances.location * 0.4 + distances.time * 0.25 + distances.relation * 0.35).toFixed(4));
    const hasLocationSignal = candidate.locationId || candidate.location?.id || Number.isFinite(Number(candidate.locationDistance));
    const hasRelationSignal = Number.isFinite(Number(candidate.relationDistance)) || relations.some((item) => [item.fromId, item.toId, item.sourceId, item.targetId].includes(candidate.id));
    const ring = !hasLocationSignal && !hasRelationSignal ? "dormant" : ringFor(score);
    rings[ring].push(candidate.id);
    scores[candidate.id] = score;
    reasons[candidate.id] = { ring, distances };
  }
  return {
    version: 1,
    modeId: input.modeId || "",
    sceneId: input.currentScene?.sceneId || input.currentScene?.id || "",
    protagonistId,
    updatedAt: new Date().toISOString(),
    fingerprint,
    reused: false,
    rings,
    scores,
    reasons,
    warnings: []
  };
}

export const PROXIMITY_RINGS = Object.freeze(RINGS);
