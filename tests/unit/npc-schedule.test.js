import test from "node:test";
import assert from "node:assert/strict";

import {
  createNpcRuntime,
  resolveNpcLocationAt,
  advanceNpcSchedules,
  recomputeNpcProximity,
  diffProximityRings
} from "../../src/core/engine/npc-schedule.js";
import { calculateProximityScope } from "../../src/core/proximity/proximity-scope.js";

test("createNpcRuntime + schedule location resolution by totalDays", () => {
  const npc = createNpcRuntime({
    id: "scout-lin",
    name: "斥候林",
    locationId: "fort",
    schedule: [
      { atDay: 0, locationId: "fort" },
      { atDay: 4, locationId: "outpost" }
    ],
    relationDistance: 0.3
  });
  assert.equal(npc.locationId, "fort");
  assert.equal(resolveNpcLocationAt(npc, 0), "fort");
  assert.equal(resolveNpcLocationAt(npc, 3), "fort");
  assert.equal(resolveNpcLocationAt(npc, 4), "outpost");
  assert.equal(resolveNpcLocationAt(npc, 99), "outpost");
});

test("advanceNpcSchedules updates locationId at schedule thresholds", () => {
  const npcs = [
    createNpcRuntime({
      id: "scout-lin",
      locationId: "fort",
      schedule: [
        { atDay: 0, locationId: "fort" },
        { atDay: 4, locationId: "outpost" }
      ]
    })
  ];
  const d3 = advanceNpcSchedules(npcs, 3);
  assert.equal(d3[0].locationId, "fort");
  const d4 = advanceNpcSchedules(npcs, 4);
  assert.equal(d4[0].locationId, "outpost");
});

test("recomputeNpcProximity: same location → core/near; distant → far/dormant; diff shows exit", () => {
  const npc = createNpcRuntime({
    id: "scout-lin",
    name: "斥候林",
    locationId: "fort",
    relationDistance: 0.3,
    schedule: [
      { atDay: 0, locationId: "fort" },
      { atDay: 4, locationId: "outpost" }
    ]
  });

  const atFort = recomputeNpcProximity({
    npcs: [npc],
    totalDays: 3,
    currentLocationId: "fort",
    protagonistId: "player"
  });
  const ringIn = atFort.scope.reasons["scout-lin"].ring;
  assert.ok(ringIn === "core" || ringIn === "near", `expected core/near, got ${ringIn}`);

  const afterLeave = recomputeNpcProximity({
    npcs: atFort.npcs,
    totalDays: 4,
    currentLocationId: "fort",
    protagonistId: "player",
    previousScope: atFort.scope
  });
  const ringOut = afterLeave.scope.reasons["scout-lin"].ring;
  assert.ok(ringOut === "far" || ringOut === "dormant", `expected far/dormant, got ${ringOut}`);
  assert.ok(
    afterLeave.changes.some((c) => c.id === "scout-lin" && (c.from === "core" || c.from === "near")),
    `expected ring exit change, got ${JSON.stringify(afterLeave.changes)}`
  );
});

test("diffProximityRings reports from→to", () => {
  const a = calculateProximityScope({
    currentLocationId: "fort",
    candidates: [{ id: "n1", locationId: "fort", relationDistance: 0.1 }]
  });
  const b = calculateProximityScope({
    currentLocationId: "fort",
    candidates: [{ id: "n1", locationId: "outpost", relationDistance: 0.1 }]
  });
  const changes = diffProximityRings(a, b);
  assert.equal(changes.length, 1);
  assert.equal(changes[0].id, "n1");
  assert.notEqual(changes[0].from, changes[0].to);
});
