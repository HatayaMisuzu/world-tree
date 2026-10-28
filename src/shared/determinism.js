// ===== Deterministic primitives (PRD v0.3 §5, S2) =====
// Pure JS (no node: imports) so it can run in the browser bundle and in Node.
// - hashSeed(...parts): stable 32-bit seed from any JSON-able parts.
// - createRng(seed, counter): mulberry32 stream; state is { seed, counter } and can be serialized/restored.
// - deriveRng(...parts): stateless sub-stream, e.g. deriveRng(worldSeed, round, "director.ambient").
// - stableId(prefix, ...parts): reproducible id (prefix-<16 hex>) replacing Date.now()/Math.random() ids.
// Rule-layer code must take randomness from here, never from Math.random/Date.now.

function stableStringify(value) {
  if (value === undefined) return "u";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
}

function fnv1a(str, seed = 0x811c9dc5) {
  let h = seed >>> 0;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function hashSeed(...parts) {
  return fnv1a(stableStringify(parts));
}

export function stableHash(...parts) {
  const s = stableStringify(parts);
  return fnv1a(s).toString(16).padStart(8, "0") + fnv1a(s, 0x9e3779b9).toString(16).padStart(8, "0");
}

export function stableId(prefix, ...parts) {
  return `${prefix}-${stableHash(prefix, ...parts)}`;
}

function mulberry32(a) {
  let t = (a + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function createRng(seed = 0, counter = 0) {
  const base = (typeof seed === "number" ? seed : hashSeed(seed)) >>> 0;
  let n = Number.isFinite(Number(counter)) ? Number(counter) : 0;
  const rng = {
    next() { const v = mulberry32((base + Math.imul(n, 0x9e3779b9)) >>> 0); n += 1; return v; },
    int(maxExclusive) { return maxExclusive > 0 ? Math.floor(rng.next() * maxExclusive) : 0; },
    pick(items = []) { return items.length ? items[rng.int(items.length)] : undefined; },
    chance(p = 0.5) { return rng.next() < p; },
    state() { return { seed: base, counter: n }; }
  };
  return rng;
}

export function deriveRng(...parts) {
  return createRng(hashSeed(...parts));
}

/** Accepts an rng-like object or derives one from fallback parts. */
export function rngFrom(maybeRng, ...fallbackParts) {
  return maybeRng && typeof maybeRng.next === "function" ? maybeRng : deriveRng(...fallbackParts);
}

/** Per-world seed: explicit runtime/world seed if present, else the world id (stable across processes). */
export function worldSeedOf(model = {}) {
  return model?.moduleData?.runtime?.seed ?? model?.moduleData?.world?.seed ?? model?.selected?.seed
    ?? model?.selected?.id ?? model?.selected?.name ?? "world-tree";
}

// createdAt / updatedAt / queuedAt / _writtenAt / exportedAt …, plus at / timestamp
const isWallClockKey = k => /[a-z]At$/.test(k) || k === "at" || k === "timestamp";
/** Copy without wall-clock fields, so ids derived from a record do not depend on when it was made. */
export function withoutWallClock(value) {
  if (Array.isArray(value)) return value.map(withoutWallClock);
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) if (!isWallClockKey(k)) out[k] = withoutWallClock(v);
    return out;
  }
  return value;
}
