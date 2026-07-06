import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const DEFAULT_PATH = fileURLToPath(new URL("../../../defaults/pipeline-profiles.json", import.meta.url));

export function loadPipelineProfiles(filePath = DEFAULT_PATH) {
  const raw = JSON.parse(readFileSync(filePath, "utf8"));
  const profiles = Array.isArray(raw.profiles) ? raw.profiles.map(normalizeProfile) : [];
  return {
    schemaVersion: raw.schemaVersion || 1,
    default: raw.default || profiles[0]?.id || "balanced",
    profiles
  };
}

export function resolvePipelineProfile(profileId = "", catalog = loadPipelineProfiles()) {
  return catalog.profiles.find((profile) => profile.id === profileId) || catalog.profiles.find((profile) => profile.id === catalog.default) || catalog.profiles[0] || null;
}

function normalizeProfile(profile = {}) {
  return {
    id: String(profile.id || "balanced"),
    label: String(profile.label || profile.id || "均衡体验"),
    quality: enumValue(profile.quality, ["low", "medium", "high"], "medium"),
    speed: enumValue(profile.speed, ["low", "medium", "high"], "medium"),
    cost: enumValue(profile.cost, ["low", "medium", "high"], "medium"),
    directorMode: enumValue(profile.directorMode, ["js", "hybrid", "llm"], "hybrid"),
    guardian: enumValue(profile.guardian, ["off", "js", "llm"], "js")
  };
}

function enumValue(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}
