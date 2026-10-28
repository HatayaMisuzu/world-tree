import test from "node:test";
import assert from "node:assert/strict";

import { createRng, deriveRng, hashSeed, stableId, worldSeedOf, withoutWallClock } from "../../src/shared/determinism.js";
import { calculateEventScore, shouldTriggerEvent, directNarrative } from "../../src/core/engine/director.js";
import { eventChance, proposeRandomEvent, resetEventCache } from "../../src/core/data/random-events.js";
import { STORYTELLERS, applyStorytellerModifiers, applyStorytellerPacing } from "../../src/core/engine/storytellers.js";
import { softReject } from "../../src/core/data/character-card.js";
import { createProcessingPackage } from "../../src/core/data/processing-engine.js";
import { proposeEntry, buildVectorIndex } from "../../src/core/data/worldbook.js";
import { addToPending } from "../../src/core/engine/overlay-store.js";
import { sessionRecord, confirmWorldFact, resetAllMemoryLayers } from "../../src/core/engine/memory-layers.js";
import { addClue, addUnresolvedEvent, createWorldPanel } from "../../src/core/data/world-state.js";
import { getProposalStats } from "../../src/core/engine/proposal-system.js";
import { roll, dicePool, generateEncounter } from "../../src/core/engine/tabletop.js";
import { execSlashCommand, uniqueAutoName } from "../../src/core/engine/commands.js";
import { grepRulesLayer } from "../../scripts/determinism-check.mjs";

function withNondeterminismTrapped(fn) {
  const { random } = Math;
  const now = Date.now;
  Math.random = () => { throw new Error("Math.random called in rules layer"); };
  Date.now = () => { throw new Error("Date.now called in rules layer"); };
  try { return fn(); } finally { Math.random = random; Date.now = now; }
}

test("RNG: same seed → same stream; state() restores; different seed differs", () => {
  const a = createRng("world-a"); const b = createRng("world-a");
  const seqA = Array.from({ length: 20 }, () => a.next());
  assert.deepEqual(seqA, Array.from({ length: 20 }, () => b.next()));
  const mid = createRng("world-a"); for (let i = 0; i < 7; i += 1) mid.next();
  const { seed, counter } = mid.state();
  assert.deepEqual(Array.from({ length: 5 }, () => createRng(seed, counter).next()).slice(0, 1), [seqA[7]]);
  const resumed = createRng(seed, counter);
  assert.deepEqual(Array.from({ length: 13 }, () => resumed.next()), seqA.slice(7));
  const c = createRng("world-b");
  assert.notDeepEqual(seqA, Array.from({ length: 20 }, () => c.next()));
  assert.ok(seqA.every(v => v >= 0 && v < 1));
  assert.equal(hashSeed("x", 1), hashSeed("x", 1));
  assert.notEqual(deriveRng("w", 1, "director").next(), deriveRng("w", 2, "director").next());
});

test("stableId is reproducible, order-insensitive for object keys, sensitive to content", () => {
  assert.equal(stableId("p", { a: 1, b: 2 }), stableId("p", { b: 2, a: 1 }));
  assert.notEqual(stableId("p", "x"), stableId("p", "y"));
  assert.match(stableId("pending", 1), /^pending-[0-9a-f]{16}$/);
  assert.deepEqual(withoutWallClock({ id: 1, createdAt: "t", _writtenAt: "t", nested: { queuedAt: "t", v: 2 } }), { id: 1, nested: { v: 2 } });
  assert.equal(worldSeedOf({ selected: { id: "w1" } }), "w1");
  assert.equal(worldSeedOf({ moduleData: { runtime: { seed: 42 } }, selected: { id: "w1" } }), 42);
});

test("rules layer never touches Math.random / Date.now (runtime trap)", () => {
  withNondeterminismTrapped(() => {
    resetEventCache();
    const score = calculateEventScore({ round: 3, worldSeed: "w" });
    assert.ok(Number.isFinite(score.score));
    shouldTriggerEvent({ method: "probability", score: 50, type: "ambient" }, { round: 3, worldSeed: "w" });
    proposeRandomEvent({ round: 10, worldSeed: "w" });
    eventChance(0.5);
    directNarrative({ round: 5, input: "看看四周", worldSeed: "w" });
    applyStorytellerModifiers(50, STORYTELLERS.chaos || Object.values(STORYTELLERS).find(s => s.randomness > 0.3), { tension: 5 });
    applyStorytellerPacing(Object.values(STORYTELLERS).find(s => s.pressureCurve === "unstable"), { fatigue: 3 });
    softReject("温柔", "钥匙");
    createProcessingPackage("包", "素材");
    proposeEntry({ keys: ["k"], content: "c" });
    buildVectorIndex([{ title: "t", content: "c" }]);
    addToPending("w-trap", { path: "runtime/overlay/a.json", op: "merge-json", value: { a: 1 } }, { round: 1 });
    resetAllMemoryLayers();
    sessionRecord({ type: "event", summary: "s" });
    confirmWorldFact("f");
    const panel = createWorldPanel();
    addClue(panel, { description: "d" });
    addUnresolvedEvent(panel, { description: "e" });
    getProposalStats();
  });
});

test("director: same world seed + inputs → identical decisions over 40 rounds; other seed diverges", () => {
  const runFor = seed => {
    resetEventCache();
    const out = [];
    for (let round = 1; round <= 40; round += 1) {
      const s = calculateEventScore({ round, worldSeed: seed, emotion: { engagement: 5, tension: 3, fatigue: 5, curiosity: 3 } });
      const t = shouldTriggerEvent(s, { round, worldSeed: seed, worldType: "daily" });
      out.push([s.ambientScore, t.trigger, t.event?.level || null, t.event?.proposal || null]);
    }
    return out;
  };
  assert.deepEqual(runFor("seed-1"), runFor("seed-1"));
  assert.notDeepEqual(runFor("seed-1"), runFor("seed-2"));
});

function idsUnderClock(clockStart) {
  const realNow = Date.now; const RealDate = Date; let t = clockStart;
  // 每次取时钟都跨 7ms，且 new Date() 同步漂移：任何依赖墙钟的 id 都会变化
  globalThis.Date = class extends RealDate {
    constructor(...a) { super(...(a.length ? a : [t += 7])); }
    static now() { return (t += 7); }
  };
  try {
    resetAllMemoryLayers();
    const p = createWorldPanel();
    addClue(p, { description: "d" }); addUnresolvedEvent(p, { description: "e" });
    return {
      pkg: createProcessingPackage("包", "素材").id,
      entry: proposeEntry({ keys: ["k"], content: "c" }).id,
      clue: p.knownClues[0].id,
      uevent: p.unresolvedEvents[0].id,
      session: [sessionRecord({ type: "event", summary: "s" }), sessionRecord({ type: "event", summary: "s" })].map(e => e?.id),
      fact: confirmWorldFact("f")?.id ?? null,
    };
  } finally { globalThis.Date = RealDate; Date.now = realNow; }
}

test("ids no longer depend on wall clock: different clocks (cross-ms) → identical ids", () => {
  const a = idsUnderClock(1_000_000_000_000);
  const b = idsUnderClock(1_900_000_123_457);
  assert.deepEqual(a, b);
  assert.ok(a.pkg && a.entry && a.clue && a.uevent);
});

test("tabletop dice: seeded, reproducible, Math.random-free", () => {
  withNondeterminismTrapped(() => {
    const r1 = roll("4d6", { seed: "w", round: 3 }); const r2 = roll("4d6", { seed: "w", round: 3 });
    assert.deepEqual(r1.rolls, r2.rolls);
    assert.ok(r1.rolls.every(v => v >= 1 && v <= 6));
    const seqs = new Set(Array.from({ length: 12 }, (_, i) => roll("4d6", { seed: "w", round: i }).rolls.join()));
    assert.ok(seqs.size > 1, "different rounds give different rolls");
    const rng = createRng("shared"); const x = roll("3d20", { rng }); const y = roll("3d20", { rng });
    assert.notDeepEqual(x.rolls, y.rolls, "shared rng advances");
    assert.deepEqual(dicePool(5, 6, 4, { seed: "w" }), dicePool(5, 6, 4, { seed: "w" }));
    assert.deepEqual(generateEncounter("wilderness", 3, { seed: "w", round: 2 }), generateEncounter("wilderness", 3, { seed: "w", round: 2 }));
  });
});

test("commands: repeated auto-named archive/world-copy in the same turn get deterministic suffixes", () => {
  assert.equal(uniqueAutoName("a", []), "a");
  assert.equal(uniqueAutoName("a", ["a"]), "a-2");
  assert.equal(uniqueAutoName("a", ["a", "a-2"]), "a-3");
  const engineState = {};
  const archives = [];
  const model = { turnCount: 3, moduleData: { archives } };
  const names = [];
  for (let i = 0; i < 3; i += 1) {
    const res = execSlashCommand({ input: "/存档", engineState, model });
    const name = res.patch?.payload?.name ?? res.patch?.name ?? JSON.stringify(res.patch).match(/"name":"([^"]+)"/)?.[1];
    names.push(name); archives.push({ name });
  }
  assert.equal(new Set(names).size, 3, `names collide: ${names}`);
  assert.deepEqual(names.map(n => n.replace(/^\[W\]/, "")), ["auto-r3", "auto-r3-2", "auto-r3-3"]);
  // 重放：同样输入 → 同样序号
  const again = []; const arch2 = [];
  for (let i = 0; i < 3; i += 1) {
    const res = execSlashCommand({ input: "/存档", engineState: {}, model: { turnCount: 3, moduleData: { archives: arch2 } } });
    const name = JSON.stringify(res.patch).match(/"name":"([^"]+)"/)[1]; again.push(name); arch2.push({ name });
  }
  assert.deepEqual(again, names);
  const worlds = [];
  const copies = [];
  for (let i = 0; i < 2; i += 1) {
    const res = execSlashCommand({ input: "/世界 复制 甲", engineState: {}, model: { turnCount: 5, worlds } });
    const t = JSON.stringify(res.patch).match(/"target":"([^"]+)"/)[1]; copies.push(t); worlds.push({ name: t });
  }
  assert.deepEqual(copies, ["甲_分歧_r5", "甲_分歧_r5-2"]);
});

test("commands: /存档列表 hints when runtime shadows legacy same-name archive", () => {
  const archives = [
    { name: "[W]独有", createdAt: "2025-01-01", summary: "only runtime" },
    { name: "[W]同名", createdAt: "2025-06-01", summary: "primary copy", shadowsLegacy: true }
  ];
  const res = execSlashCommand({
    input: "/存档列表",
    engineState: { dataMode: "worldbook" },
    model: { moduleData: { archives } }
  });
  assert.equal(res.handled, true);
  assert.match(res.narrative, /\[W\]同名/);
  assert.match(res.narrative, /【系统】「\[W\]同名」以 runtime 档为准，旧路径同名已遮蔽。/);
  assert.doesNotMatch(res.narrative, /「\[W\]独有」以 runtime/);
  const load = execSlashCommand({
    input: "/读档 [W]同名",
    engineState: { dataMode: "worldbook" },
    model: { moduleData: { archives } }
  });
  assert.match(load.narrative, /已读档「\[W\]同名」/);
  assert.match(load.narrative, /【系统】「\[W\]同名」以 runtime 档为准，旧路径同名已遮蔽。/);
});

test("overlay pending ids are reproducible and unique within a queue", () => {
  const op = { path: "runtime/overlay/a.json", op: "merge-json", value: { a: 1 } };
  const x1 = addToPending("w-ids-1", op, { round: 2 }); const x2 = addToPending("w-ids-1", op, { round: 2 });
  const y1 = addToPending("w-ids-2", op, { round: 2 });
  assert.notEqual(x1.id, x2.id);
  const z1 = addToPending("w-ids-1b", op, { round: 2 }); const z2 = addToPending("w-ids-1b", op, { round: 2 });
  assert.notEqual(x1.id, y1.id, "world key is part of the id");
  assert.equal(stableId("x"), stableId("x"));
  assert.ok(z1.id && z2.id && z1.id !== z2.id);
});

test("static check: rules layer grep finds no Math.random / Date.now (allowlist reported)", () => {
  const g = grepRulesLayer();
  assert.deepEqual(g.hits, []);
  assert.deepEqual(g.allowed, [], "rules layer must have zero hits, no allowlist");
});
