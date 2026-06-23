export const INERTIA_LADDERS = Object.freeze({
  address: ["formal", "familiar", "intimate"], distance: ["hostile", "cold", "neutral", "near", "close", "intimate"],
  initiative: ["avoidant", "passive", "medium", "active", "pursuing"], trust: ["distrustful", "cautious", "neutral", "warming", "trusting", "devoted"],
  tension: ["calm", "low", "uneasy", "high", "explosive"], secret: ["sealed", "guarded", "hinted", "partial", "open"], gesture: ["avoidant", "reserved", "normal", "warm", "intimate"]
});

export function validateInertiaShift(current = {}, patch = {}) {
  const warnings = []; const accepted = {}; let changed = 0;
  for (const [track, next] of Object.entries(patch)) {
    if (!(track in INERTIA_LADDERS)) continue;
    const ladder = INERTIA_LADDERS[track]; const before = current[track] || ladder[Math.floor(ladder.length / 2)];
    const delta = Math.abs(ladder.indexOf(next) - ladder.indexOf(before));
    if (!ladder.includes(next) || delta > 1) { warnings.push(`${track}_jump_blocked`); continue; }
    if (next !== before && changed >= 2) { warnings.push("max_tracks_per_turn"); continue; }
    accepted[track] = next; if (next !== before) changed += 1;
  }
  return { ok: warnings.length === 0, accepted, warnings, changedTracks: changed };
}
