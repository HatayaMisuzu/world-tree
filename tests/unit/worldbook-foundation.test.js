import test from "node:test";
import assert from "node:assert/strict";

import { createWorldbook, createWorldbookEntry, createDefaultScene, createDefaultWorldState, createDefaultTimeline, createTimelineEvent, createDefaultRelations, createWorldbookSummary } from "../../src/core/worldbook/worldbook-schema.js";
import { normalizeWorldbook, normalizeWorldbookEntry, normalizeScenes, normalizeWorldState } from "../../src/core/worldbook/worldbook-normalizer.js";
import { validateWorldbook, validateWorldbookEntry, validateStateProposal } from "../../src/core/worldbook/worldbook-validator.js";
import { matchWorldbookEntries, filterWorldbookEntriesByVisibility, rankWorldbookEntries, activateWorldbookContext } from "../../src/core/worldbook/worldbook-context-activator.js";
import { createWorldContextPacket, estimateWorldContextBudget, createWorldContextSummary } from "../../src/core/worldbook/worldbook-context-packet.js";
import { createWorldStateProposal, validateWorldStateProposal, applyApprovedWorldStateProposal } from "../../src/core/worldbook/worldbook-state-proposal.js";
import { createWorldbookModuleRuntimePacket, createWorldbookModuleSourceMap } from "../../src/core/worldbook/worldbook-module-integration.js";
import { exportWorldbookJson } from "../../src/core/worldbook/worldbook-exporter.js";

// Schema
test("createWorldbook with defaults", () => {
  const wb = createWorldbook({ title: "风暴大陆" });
  assert.equal(wb.title, "风暴大陆");
  assert.equal(wb.schemaVersion, 1);
  assert.ok(wb.canonPolicy.requiresProposalForMajorChanges);
});

test("createWorldbookEntry has correct defaults", () => {
  const e = createWorldbookEntry({ title: "测试", content: "内容", keys: ["k1"] });
  assert.equal(e.type, "lore");
  assert.equal(e.enabled, true);
  assert.equal(e.priority, 100);
});

test("createDefaultScene has opening scene", () => {
  const s = createDefaultScene();
  assert.equal(s.currentSceneId, "opening");
  assert.equal(s.items[0].id, "opening");
});

test("createDefaultWorldState has empty flags", () => {
  const s = createDefaultWorldState();
  assert.deepEqual(s.flags, {});
  assert.equal(s.currentTime.turn, 0);
});

test("createTimelineEvent adds to timeline", () => {
  const tl = createDefaultTimeline();
  tl.events.push(createTimelineEvent({ summary: "风暴来临" }));
  assert.equal(tl.events.length, 1);
});

// Normalizer
test("normalizeWorldbook fills entries array", () => {
  const raw = { title: "T" };
  const n = normalizeWorldbook(raw);
  assert.ok(Array.isArray(n.entries));
});

test("normalizeWorldbookEntry converts key string to array", () => {
  const e = normalizeWorldbookEntry({ id: "e1", key: "风暴" });
  assert.deepEqual(e.keys, ["风暴"]);
});

// Validator
test("validateWorldbook passes", () => {
  const r = validateWorldbook(createWorldbook());
  assert.equal(r.ok, true);
});

test("validateStateProposal rejects invalid status", () => {
  const r = validateStateProposal({ type: "x", summary: "y", status: "invalid" });
  assert.equal(r.ok, false);
});

// Context Activator
test("matchWorldbookEntries by keyword", () => {
  const entries = [{ id: "e1", keys: ["风暴"], content: "...", enabled: true }, { id: "e2", keys: ["其他"], content: "...", enabled: true }];
  const matched = matchWorldbookEntries(entries, { input: "风暴袭来" });
  assert.equal(matched.length, 1);
  assert.equal(matched[0].id, "e1");
});

test("filterWorldbookEntriesByVisibility", () => {
  const entries = [{ id: "e1", visibility: "player_known" }, { id: "e2", visibility: "gm_only" }];
  assert.equal(filterWorldbookEntriesByVisibility(entries).length, 1);
});

test("activateWorldbookContext returns structured result", () => {
  const wb = createWorldbook({ title: "T", entries: [createWorldbookEntry({ id: "e1", keys: ["storm"], content: "x", enabled: true })] });
  const result = activateWorldbookContext(wb, { input: "storm" });
  assert.ok(result.totalEntries >= 1);
  assert.ok(result.selected >= 0);
});

// Context Packet
test("createWorldContextPacket", () => {
  const p = createWorldContextPacket({ worldbook: createWorldbook({ title: "T" }), scenes: createDefaultScene(), activeLoreEntries: [] });
  assert.equal(p.worldIdentity.title, "T");
  assert.ok(p.runtime.tokenEstimate >= 0);
});

test("createWorldContextSummary", () => {
  const s = createWorldContextSummary(createWorldContextPacket({ worldbook: createWorldbook({ title: "T" }) }));
  assert.equal(s.title, "T");
});

// State Proposal
test("createWorldStateProposal defaults to pending", () => {
  const p = createWorldStateProposal({ type: "update", summary: "风暴增强" });
  assert.equal(p.status, "pending");
});

test("applyApprovedWorldStateProposal only if approved", () => {
  const base = { variables: {} };
  const p = createWorldStateProposal({ patch: { variables: { storm: 3 } } });
  const unchanged = applyApprovedWorldStateProposal(base, p);
  assert.deepEqual(unchanged, base);
  const approved = { ...p, status: "approved" };
  const changed = applyApprovedWorldStateProposal(base, approved);
  assert.equal(changed.variables.storm, 3);
});

// Module Integration
test("createWorldbookModuleRuntimePacket for world-rpg", () => {
  const p = createWorldbookModuleRuntimePacket({}, { text: "test" }, { modeId: "world-rpg" });
  assert.ok(p.worldbookModulesAvailable);
  assert.ok(p.worldbookModulesAvailable.length > 0);
});

test("createWorldbookModuleSourceMap", () => {
  const p = createWorldbookModuleRuntimePacket({}, { text: "test" }, { modeId: "world-rpg" });
  const sm = createWorldbookModuleSourceMap(p);
  assert.ok(sm.worldbookModulesAvailable.length > 0);
});

// Exporter
test("exportWorldbookJson preserves data", () => {
  const wb = createWorldbook({ title: "T", entries: [createWorldbookEntry({ title: "e" })] });
  const e = exportWorldbookJson(wb);
  assert.equal(e.title, "T");
  assert.ok(e.exportedAt);
});
