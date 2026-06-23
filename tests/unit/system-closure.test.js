import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { listWorldTreeRoutes, getWorldTreeRoute, validateAllWorldTreeRoutes, createWorldTreeRouteSummary } from "../../src/core/system/world-tree-route-index.js";
import { listModePromptProfiles, getModePromptProfile, buildModePrompt } from "../../src/core/prompts/mode-prompt-registry.js";
import { createModeInputPacket, validateModeInputPacket } from "../../src/core/system/mode-input-packets.js";
import { createModeOutputPacket, validateModeOutputPacket, normalizeModeOutputPacket } from "../../src/core/system/mode-output-packets.js";
import { getModeIsolationPolicy, assertModeCanWrite, filterContextByModeVisibility } from "../../src/core/system/mode-isolation-policy.js";
import { createProposal, approveProposal, rejectProposal, listPendingProposals } from "../../src/core/system/proposal-bus.js";
import { createWorldTreeSaveSnapshot, validateWorldTreeSaveSnapshot, exportWorldTreeSave } from "../../src/core/system/world-tree-save-system.js";
import { runWorldTreeModeTurn, createModeRunnerSummary } from "../../src/core/system/mode-runner.js";

// Route index
test("route index lists 8 routes", () => { assert.equal(listWorldTreeRoutes().length, 8); });
test("get route for each mode", () => {
  for (const modeId of ["quick-setting","character","world-rpg","tabletop","mystery-puzzle","strategy-sim","murder-mystery","creation-forge"]) {
    assert.ok(getWorldTreeRoute(modeId), `missing route: ${modeId}`);
  }
});
test("route summary counts consumers and producers", () => {
  const s = createWorldTreeRouteSummary();
  assert.equal(s.consumers, 7);
  assert.equal(s.producers, 1);
});
test("validateAllWorldTreeRoutes passes", () => { assert.equal(validateAllWorldTreeRoutes().ok, true); });

// Prompt registry
test("prompt registry has 8 profiles", () => { assert.equal(listModePromptProfiles().length, 8); });
test("grand world profile forbids RPG terms", () => {
  const p = getModePromptProfile("grand_world_v1");
  assert.ok(p.rules.some(r => r.includes("不得硬套")), "missing RPG prohibition");
  assert.ok(p.globalRules.some(r => r.includes("pending proposal")));
});
test("murder mystery profile protects truth lock", () => {
  const p = getModePromptProfile("murder_mystery_v1");
  assert.ok(p.rules.some(r => r.includes("真相锁") || r.includes("system_only")));
});
test("creation forge profile requires confirmation", () => {
  const p = getModePromptProfile("creation_forge_v1");
  assert.ok(p.rules.some(r => r.includes("确认") || r.includes("确认")));
});
test("buildModePrompt returns text", () => {
  const text = buildModePrompt({ userInput: { text: "探索" } }, { profileId: "grand_world_v1" });
  assert.ok(text.includes("探索"));
  assert.ok(text.includes("pending proposal"));
});

// Input/output packets
test("create and validate mode input packet", () => {
  const pkt = createModeInputPacket("world-rpg", { worldbook: { title: "T" } }, { text: "探索" });
  assert.equal(pkt.modeId, "world-rpg");
  assert.equal(validateModeInputPacket(pkt).ok, true);
});
test("validate rejects missing modeId", () => {
  assert.equal(validateModeInputPacket({ userInput: { text: "x" } }).ok, false);
});
test("output packet normalizes arrays", () => {
  const p = normalizeModeOutputPacket(createModeOutputPacket({ modeId: "test", turnId: "t1" }));
  assert.ok(Array.isArray(p.proposals));
  assert.ok(Array.isArray(p.cacheWrites));
});
test("validate output packet", () => {
  assert.equal(validateModeOutputPacket(createModeOutputPacket({ modeId: "test", turnId: "t1" })).ok, true);
});

// Isolation
test("isolation blocks cross-mode cache write", () => {
  const r = assertModeCanWrite("character", "runtime/cache/tabletop/test.json");
  assert.equal(r.allowed, false);
});
test("isolation allows own cache write", () => {
  assert.equal(assertModeCanWrite("character", "runtime/cache/character/test.json").allowed, true);
});
test("filterContext removes hidden fields", () => {
  const ctx = { title: "T", truthLock: "secret", answerLock: "locked" };
  const f = filterContextByModeVisibility("murder-mystery", ctx);
  assert.equal(f.title, "T");
  assert.equal(f.truthLock, undefined);
  assert.equal(f.answerLock, undefined);
});

// Proposal bus
test("create pending proposal", () => {
  const p = createProposal({ type: "world_state_update", summary: "测试" });
  assert.equal(p.status, "pending");
});
test("approve proposal", () => { assert.equal(approveProposal({}, "p1").status, "approved"); });
test("reject proposal", () => { assert.equal(rejectProposal({}, "p1").status, "rejected"); });
test("list pending proposals", () => {
  const pj = { proposals: [{ id: "a", status: "pending" }, { id: "b", status: "approved" }] };
  assert.equal(listPendingProposals(pj).proposals.length, 1);
});

// Save system
test("create save snapshot", () => {
  const snap = createWorldTreeSaveSnapshot({ id: "test", mode: "world-rpg" });
  assert.equal(snap.mode, "world-rpg");
  assert.equal(validateWorldTreeSaveSnapshot(snap).ok, true);
});
test("export save", () => {
  assert.equal(exportWorldTreeSave({ id: "test", mode: "character" }).ok, true);
});

// Mode runner
test("mode runner works for character", async () => {
  const r = await runWorldTreeModeTurn({ mode: "character", id: "test" }, { text: "你好" });
  assert.equal(r.ok, true);
  assert.ok(r.outputPacket.assistantMessage.text);
});
test("mode runner works for grand world", async () => {
  const r = await runWorldTreeModeTurn({ mode: "world-rpg", id: "test" }, { text: "探索" });
  assert.equal(r.ok, true);
});
test("mode runner works for tabletop", async () => {
  const r = await runWorldTreeModeTurn({ mode: "tabletop", id: "test" }, { text: "掷骰" });
  assert.equal(r.ok, true);
});
test("mode runner works for creation-forge", async () => {
  const r = await runWorldTreeModeTurn({ mode: "creation-forge", id: "test" }, { text: "灵感" });
  assert.equal(r.ok, true);
});
test("mode runner rejects unknown mode", async () => {
  const r = await runWorldTreeModeTurn({ mode: "unknown" }, { text: "x" });
  assert.equal(r.ok, false);
});
test("mode runner summary", () => { assert.equal(createModeRunnerSummary({}).modesSupported, 8); });
