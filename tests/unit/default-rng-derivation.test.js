import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { defaultRngFor, resetDefaultRngStreams } from "../../src/shared/determinism.js";
import { roll } from "../../src/core/engine/tabletop.js";
import { rollDiceExpression } from "../../src/core/tabletop/tabletop-v2-dice-engine.js";
import { rollDice } from "../../src/core/tabletop/dice.js";
import { applySlashWriteOps } from "../../src/server/persistence-service.js";
import { SLASH_WRITE_OP } from "../../src/core/engine/slash-persistence.js";

function totals(fn) {
  return Array.from({ length: 5 }, () => fn());
}

test("default rng: 5 consecutive tabletop roll() calls without rng/seed/round are not all identical", () => {
  resetDefaultRngStreams();
  const first = totals(() => roll("1d20").total);
  assert.ok(new Set(first).size > 1, `rolls were all identical: ${first.join(" | ")}`);
});

test("default rng: same call sequence reproduces; different round/world seed changes the stream", () => {
  resetDefaultRngStreams();
  const a = totals(() => defaultRngFor("w", 3, "p").next());
  resetDefaultRngStreams();
  const b = totals(() => defaultRngFor("w", 3, "p").next());
  assert.deepEqual(a, b);
  resetDefaultRngStreams();
  assert.notDeepEqual(totals(() => defaultRngFor("w", 4, "p").next()), a);
  resetDefaultRngStreams();
  assert.notDeepEqual(totals(() => defaultRngFor("other", 3, "p").next()), a);
});

test("default rng: tabletop V2 dice engine and dice.js no longer fall back to Math.random", () => {
  const original = Math.random;
  Math.random = () => { throw new Error("Math.random used"); };
  try {
    resetDefaultRngStreams();
    const v2 = totals(() => rollDiceExpression("1d20").total);
    const v1 = totals(() => rollDice("1d20").total);
    assert.ok(new Set(v2).size > 1, `v2 rolls all identical: ${v2}`);
    assert.ok(new Set(v1).size > 1, `dice.js rolls all identical: ${v1}`);
  } finally {
    Math.random = original;
  }
});

test("slash persistence: same auto name twice in one round yields two files on disk, never overwriting", () => {
  const dir = mkdtempSync(join(tmpdir(), "wt-slash-"));
  try {
    const op = (n) => ({ op: SLASH_WRITE_OP.ARCHIVE, name: "[W]auto-r0", overwrite: false, payload: { name: "[W]auto-r0", marker: n } });
    const [w1] = applySlashWriteOps(dir, [op(1)], { round: 1 });
    const [w2] = applySlashWriteOps(dir, [op(2)], { round: 1 });
    assert.match(w1.receipt, /存档「\[W\]auto-r0」已保存/);
    assert.match(w2.receipt, /存档「\[W\]auto-r0-2」已保存（文件 archives\/\[W\]auto-r0-2\.json）/);
    const files = readdirSync(join(dir, "archives")).sort();
    assert.deepEqual(files, ["[W]auto-r0-2.json", "[W]auto-r0.json"]);
    const markers = files.map((f) => JSON.parse(readFileSync(join(dir, "archives", f), "utf8")).marker).sort();
    assert.deepEqual(markers, [1, 2]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
