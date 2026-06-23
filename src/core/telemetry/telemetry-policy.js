export const TELEMETRY_LEVELS = Object.freeze(["low", "medium", "high", "critical", "unknown"]);
export const TELEMETRY_METRICS = Object.freeze(["stability", "tension", "mysteryLoad", "conflictPressure", "characterStress", "memoryLoad", "narrativeMomentum"]);
export function levelFromCount(count, thresholds = [1, 3, 6]) { if (!Number.isFinite(Number(count))) return "unknown"; if (count >= thresholds[2]) return "critical"; if (count >= thresholds[1]) return "high"; if (count >= thresholds[0]) return "medium"; return "low"; }
