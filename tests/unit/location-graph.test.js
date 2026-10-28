import test from "node:test";
import assert from "node:assert/strict";

import {
  createLocationGraph,
  findLocationNode,
  travelDuration,
  resolveTravelIntent
} from "../../src/core/engine/location-graph.js";

const sample = () =>
  createLocationGraph({
    nodes: [
      { id: "plaza", name: "广场" },
      { id: "fort", name: "远方要塞" },
      { id: "outpost", name: "边境哨所" }
    ],
    edges: [
      { from: "plaza", to: "fort", durationDays: 3 },
      { from: "fort", to: "outpost", durationDays: 2 }
    ]
  });

test("createLocationGraph indexes nodes and keeps edge costs", () => {
  const g = sample();
  assert.equal(g.nodes.length, 3);
  assert.equal(g.byId.fort.name, "远方要塞");
  assert.equal(g.edges[0].durationDays, 3);
  assert.equal(g.edges[0].bidirectional, true);
});

test("travelDuration: direct edge and multi-hop shortest path", () => {
  const g = sample();
  assert.deepEqual(travelDuration(g, "plaza", "plaza"), { durationDays: 0, path: ["plaza"] });
  const direct = travelDuration(g, "plaza", "fort");
  assert.equal(direct.durationDays, 3);
  assert.deepEqual(direct.path, ["plaza", "fort"]);
  const hop = travelDuration(g, "plaza", "outpost");
  assert.equal(hop.durationDays, 5);
  assert.deepEqual(hop.path, ["plaza", "fort", "outpost"]);
  // bidirectional reverse
  assert.equal(travelDuration(g, "fort", "plaza").durationDays, 3);
});

test("findLocationNode matches id and name", () => {
  const g = sample();
  assert.equal(findLocationNode(g, "fort")?.id, "fort");
  assert.equal(findLocationNode(g, "远方要塞")?.id, "fort");
  assert.equal(findLocationNode(g, "无此地"), null);
});

test("resolveTravelIntent: 前往远方 → edge cost; non-travel → null", () => {
  const g = sample();
  const hit = resolveTravelIntent("我前往远方要塞。", g, "plaza");
  assert.ok(hit);
  assert.equal(hit.toId, "fort");
  assert.equal(hit.fromId, "plaza");
  assert.equal(hit.durationDays, 3);
  assert.equal(hit.reason, "travel");

  assert.equal(resolveTravelIntent("我检查日晷的刻度。", g, "plaza"), null);
  assert.equal(resolveTravelIntent("我前往远方要塞。", g, ""), null);
  assert.equal(resolveTravelIntent("我前往远方要塞。", null, "plaza"), null);
});
