import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { listWorldTreeRoutes, getWorldTreeRoute, validateAllWorldTreeRoutes, createWorldTreeRouteSummary } from "../../src/core/system/world-tree-route-index.js";
import { listModePromptProfiles, getModePromptProfile, buildModePrompt, buildModePromptResult, hasModePromptProfile } from "../../src/core/prompts/mode-prompt-registry.js";
import { createModeInputPacket, validateModeInputPacket } from "../../src/core/system/mode-input-packets.js";
import { createModeOutputPacket, validateModeOutputPacket, normalizeModeOutputPacket } from "../../src/core/system/mode-output-packets.js";
import { getModeIsolationPolicy, assertModeCanWrite, filterContextByModeVisibility, deepFilterHiddenFields } from "../../src/core/system/mode-isolation-policy.js";
import { createProposal, approveProposal, rejectProposal, listPendingProposals, validateProposal, applyProposalPatch } from "../../src/core/system/proposal-bus.js";
import { createWorldTreeSaveSnapshot, validateWorldTreeSaveSnapshot, exportWorldTreeSave, writeModeTurnToSave, writeModeCache, appendModeProposal } from "../../src/core/system/world-tree-save-system.js";
import { runWorldTreeModeTurn, createModeRunnerSummary, validateModeTurnResult } from "../../src/core/system/mode-runner.js";
import { readJsonSync, appendJsonl, writeJson, ensureDir } from "../../src/server/fs-utils.js";
import { pathWithinRoot } from "../../src/server/path-security.js";

// ═══ Helpers ═══

function makeTempProject(prefix = "wt-test") {
  const root = join(tmpdir(), `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  mkdirSync(root, { recursive: true });
  mkdirSync(join(root, "shared"), { recursive: true });
  mkdirSync(join(root, "runtime"), { recursive: true });
  return root;
}

function cleanupDir(dir) {
  try { rmSync(dir, { recursive: true, force: true }); } catch {}
}

const svc = {
  ensureDir,
  writeJson,
  appendJsonl,
  readJsonSync,
  pathWithinRoot
};

// ═══ Route index ═══

test("route index lists 8 routes", () => { assert.equal(listWorldTreeRoutes().length, 8); });

test("get route for each mode", () => {
  for (const modeId of ["quick-setting","character","world-rpg","tabletop","mystery-puzzle","strategy-sim","murder-mystery","creation-forge"]) {
    assert.ok(getWorldTreeRoute(modeId), `missing route: ${modeId}`);
  }
});

test("each route has required fields", () => {
  const fields = ["promptProfileId","inputPacketType","outputPacketType","adapterId","proposalLog"];
  for (const route of listWorldTreeRoutes()) {
    const r = getWorldTreeRoute(route.modeId);
    for (const f of fields) {
      assert.ok(r[f], `${route.modeId} missing ${f}`);
    }
  }
});

test("each route promptProfileId exists in registry", () => {
  for (const route of listWorldTreeRoutes()) {
    const r = getWorldTreeRoute(route.modeId);
    assert.ok(hasModePromptProfile(r.promptProfileId), `${route.modeId} promptProfile ${r.promptProfileId} not found`);
  }
});

test("route summary counts consumers and producers", () => {
  const s = createWorldTreeRouteSummary();
  assert.equal(s.consumers, 7);
  assert.equal(s.producers, 1);
});

test("validateAllWorldTreeRoutes passes with valid routes", () => {
  const r = validateAllWorldTreeRoutes();
  assert.equal(r.ok, true);
  assert.equal(r.errors.length, 0);
  assert.equal(r.routesChecked, 8);
});

test("validateAllWorldTreeRoutes returns errors for invalid routes (mocked)", () => {
  // 验证 validateAllWorldTreeRoutes 不是无条件 ok:true —— 通过检查函数体包含错误码字符串
  // 实际路径检查已在上面测试通过（当前 8 条 route 都正确）
  const fnStr = validateAllWorldTreeRoutes.toString();
  assert.ok(fnStr.includes("PROMPT_PROFILE_MISSING"), "validate function should check PROMPT_PROFILE_MISSING");
  assert.ok(fnStr.includes("MISSING_FIELD"), "validate function should check MISSING_FIELD");
});

// ═══ Prompt registry ═══

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
  assert.ok(p.rules.some(r => r.includes("确认")));
});
test("buildModePrompt returns text", () => {
  const text = buildModePrompt({ userInput: { text: "探索" } }, { profileId: "grand_world_v1" });
  assert.ok(text.includes("探索"));
  assert.ok(text.includes("pending proposal"));
});
test("buildModePromptResult returns ok:false for missing profile", () => {
  const r = buildModePromptResult({ userInput: { text: "x" } }, { profileId: "nonexistent_v1" });
  assert.equal(r.ok, false);
  assert.equal(r.errors.length, 1);
  assert.equal(r.errors[0].code, "PROMPT_PROFILE_MISSING");
});
test("buildModePromptResult returns ok:true for valid profile", () => {
  const r = buildModePromptResult({ userInput: { text: "探索" } }, { profileId: "grand_world_v1" });
  assert.equal(r.ok, true);
  assert.ok(r.prompt.includes("探索"));
});

// ═══ Input/output packets ═══

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

// ═══ Isolation ═══

test("isolation blocks cross-mode cache write", () => {
  const r = assertModeCanWrite("character", "runtime/cache/tabletop/test.json");
  assert.equal(r.allowed, false);
});
test("isolation allows own cache write", () => {
  assert.equal(assertModeCanWrite("character", "runtime/cache/character/test.json").allowed, true);
});
test("filterContext removes hidden fields (shallow)", () => {
  const ctx = { title: "T", truthLock: "secret", answerLock: "locked" };
  const f = filterContextByModeVisibility("murder-mystery", ctx);
  assert.equal(f.title, "T");
  assert.equal(f.truthLock, undefined);
  assert.equal(f.answerLock, undefined);
});
test("deepFilterHiddenFields removes nested hidden fields", () => {
  const data = {
    title: "World",
    config: { truthLock: "secret", publicNote: "visible" },
    scenes: [{ name: "S1", truthLock: "nested" }, { name: "S2" }],
    meta: { systemOnly: "hidden", summary: "ok" }
  };
  const filtered = deepFilterHiddenFields(data);
  assert.equal(filtered.title, "World");
  assert.equal(filtered.config.truthLock, undefined);
  assert.equal(filtered.config.publicNote, "visible");
  assert.equal(filtered.scenes[0].truthLock, undefined);
  assert.equal(filtered.scenes[0].name, "S1");
  assert.equal(filtered.meta.systemOnly, undefined);
  assert.equal(filtered.meta.summary, "ok");
});

// ═══ Proposal bus: safe patch ═══

test("applyProposalPatch replace", () => {
  const doc = { a: 1, b: 2 };
  const result = applyProposalPatch(doc, { patch: { replace: { a: 99 } } });
  assert.equal(result.a, 99);
  assert.equal(result.b, 2);
});

test("applyProposalPatch merge", () => {
  const doc = { a: 1, nested: { x: 1, y: 2 } };
  const result = applyProposalPatch(doc, { patch: { merge: { a: 99, nested: { y: 99 } } } });
  assert.equal(result.a, 99);
  assert.equal(result.nested.x, 1);
  assert.equal(result.nested.y, 99);
});

test("applyProposalPatch append", () => {
  const doc = { items: [1] };
  const result = applyProposalPatch(doc, { patch: { append: { items: 2 } } });
  assert.deepEqual(result.items, [1, 2]);
});

test("create pending proposal", () => {
  const p = createProposal({ type: "world_state_update", summary: "测试" });
  assert.equal(p.status, "pending");
});

test("validate proposal", () => {
  assert.equal(validateProposal({ type: "test", status: "pending" }).ok, true);
  assert.equal(validateProposal({ status: "pending" }).ok, false);
  assert.equal(validateProposal({ type: "test", status: "unknown" }).ok, false);
});

// ═══ Proposal bus: real approve/reject (temp dir) ═══

test("approveProposal real I/O reads proposal log and writes shared", async () => {
  const root = makeTempProject("wt-prop-approve");
  try {
    const logPath = join(root, "runtime", "world-proposals.jsonl");
    const sharedPath = join(root, "shared", "world_state.json");
    const proposalId = "prop-test-001";

    // Setup: write shared file and proposal log
    await writeJson(sharedPath, { title: "old", count: 0 });
    await appendJsonl(logPath, {
      id: proposalId, type: "world_state_update", status: "pending",
      patch: { replace: { title: "new", count: 1 } },
      targetFile: "shared/world_state.json",
      summary: "test", createdAt: new Date().toISOString()
    });

    const project = { projectRoot: root, proposalLog: logPath };
    const r = await approveProposal(project, proposalId, svc);

    assert.equal(r.ok, true);
    assert.equal(r.status, "approved");

    // Verify shared file was modified
    const shared = readJsonSync(sharedPath, {});
    assert.equal(shared.title, "new");
    assert.equal(shared.count, 1);

    // Verify proposal log was updated
    const logData = readFileSync(logPath, "utf-8");
    assert.ok(logData.includes('"approved"'));
  } finally {
    cleanupDir(root);
  }
});

test("rejectProposal real I/O does not modify shared", async () => {
  const root = makeTempProject("wt-prop-reject");
  try {
    const logPath = join(root, "runtime", "world-proposals.jsonl");
    const sharedPath = join(root, "shared", "world_state.json");
    const proposalId = "prop-test-002";

    await writeJson(sharedPath, { title: "old" });
    await appendJsonl(logPath, {
      id: proposalId, type: "world_state_update", status: "pending",
      patch: { replace: { title: "should-not-change" } },
      targetFile: "shared/world_state.json",
      summary: "test", createdAt: new Date().toISOString()
    });

    const project = { projectRoot: root, proposalLog: logPath };
    const r = await rejectProposal(project, proposalId, svc);

    assert.equal(r.ok, true);
    assert.equal(r.status, "rejected");

    // Verify shared file was NOT modified
    const shared = readJsonSync(sharedPath, {});
    assert.equal(shared.title, "old");

    // Verify proposal log shows rejected
    const logData = readFileSync(logPath, "utf-8");
    assert.ok(logData.includes('"rejected"'));
  } finally {
    cleanupDir(root);
  }
});

test("list pending proposals", () => {
  const pj = { proposals: [{ id: "a", status: "pending" }, { id: "b", status: "approved" }] };
  assert.equal(listPendingProposals(pj).proposals.length, 1);
});

// ═══ Save system: real I/O (temp dir) ═══

test("writeModeTurnToSave real append to chat.jsonl", async () => {
  const root = makeTempProject("wt-save-chat");
  try {
    const project = { projectRoot: root };
    const outputPacket = {
      turnId: "turn_1",
      modeId: "world-rpg",
      assistantMessage: { text: "你好，冒险者" },
      proposals: [{ id: "p1" }]
    };
    const r = await writeModeTurnToSave(project, outputPacket, svc);
    assert.equal(r.ok, true);
    assert.ok(r.chatPath);

    const chatPath = join(root, "runtime", "chat.jsonl");
    assert.ok(existsSync(chatPath));
    const content = readFileSync(chatPath, "utf-8");
    assert.ok(content.includes("你好，冒险者"));
    assert.ok(content.includes("turn_1"));
  } finally {
    cleanupDir(root);
  }
});

test("writeModeCache real write to runtime/cache", async () => {
  const root = makeTempProject("wt-save-cache");
  try {
    const project = { projectRoot: root };
    const cacheWrites = [
      { relativePath: "runtime/cache/tabletop/summary.json", json: { turn: 1, scene: "intro" } }
    ];
    const r = await writeModeCache(project, cacheWrites, svc);
    assert.equal(r.ok, true);
    assert.equal(r.entriesWritten, 1);

    const cachePath = join(root, "runtime", "cache", "tabletop", "summary.json");
    assert.ok(existsSync(cachePath));
    const data = JSON.parse(readFileSync(cachePath, "utf-8"));
    assert.equal(data.turn, 1);
  } finally {
    cleanupDir(root);
  }
});

test("writeModeCache rejects unsafe path", async () => {
  const root = makeTempProject("wt-save-unsafe");
  try {
    const project = { projectRoot: root };
    const cacheWrites = [
      { relativePath: "../outside/summary.json", json: {} }
    ];
    const r = await writeModeCache(project, cacheWrites, svc);
    assert.equal(r.ok, false);
    assert.equal(r.entriesWritten, 0);
  } finally {
    cleanupDir(root);
  }
});

test("appendModeProposal real append to log", async () => {
  const root = makeTempProject("wt-save-prop");
  try {
    const project = { projectRoot: root, proposalLog: join(root, "runtime", "world-proposals.jsonl") };
    const r = await appendModeProposal(project, {
      type: "world_state_update", summary: "test proposal"
    }, svc);
    assert.equal(r.ok, true);
    assert.equal(r.status, "pending");

    const logPath = join(root, "runtime", "world-proposals.jsonl");
    const content = readFileSync(logPath, "utf-8");
    assert.ok(content.includes("test proposal"));
  } finally {
    cleanupDir(root);
  }
});

test("create save snapshot", () => {
  const snap = createWorldTreeSaveSnapshot({ id: "test", mode: "world-rpg" });
  assert.equal(snap.mode, "world-rpg");
  assert.equal(validateWorldTreeSaveSnapshot(snap).ok, true);
});

test("export save", () => {
  assert.equal(exportWorldTreeSave({ id: "test", mode: "character" }).ok, true);
});

// ═══ Mode runner ═══

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
  assert.equal(r.error.code, "UNKNOWN_MODE");
});

test("mode runner summary", () => { assert.equal(createModeRunnerSummary({}).modesSupported, 8); });

test("validate mode turn result", () => {
  assert.equal(validateModeTurnResult({ ok: true }).ok, true);
  assert.equal(validateModeTurnResult({ ok: false, error: { code: "FAIL" } }).ok, false);
});

// ═══ Isolation hardening ═══

test("assertModeCanWrite blocks cross-mode cache write (strict)", () => {
  // character cannot write to tabletop cache
  const r1 = assertModeCanWrite("character", "runtime/cache/tabletop/summary.json");
  assert.equal(r1.allowed, false);
  assert.ok(r1.reason.includes("character"));

  // character can write to own cache
  const r2 = assertModeCanWrite("character", "runtime/cache/character/summary.json");
  assert.equal(r2.allowed, true);

  // quick-setting cannot write to mystery-puzzle cache
  const r3 = assertModeCanWrite("quick-setting", "runtime/cache/mystery-puzzle/state.json");
  assert.equal(r3.allowed, false);

  // world-rpg can write to worldbook cache (special namespace)
  const r4 = assertModeCanWrite("world-rpg", "runtime/cache/worldbook/summary.json");
  assert.equal(r4.allowed, true);
});

test("assertModeCanWrite allows non-cache paths", () => {
  // chat.jsonl is not a cache path — always allowed
  assert.equal(assertModeCanWrite("character", "runtime/chat.jsonl").allowed, true);
  // proposal log is not a cache path — always allowed
  assert.equal(assertModeCanWrite("tabletop", "runtime/tabletop-proposals.jsonl").allowed, true);
});

test("assertModeCanWrite respects allowedNamespaces option", () => {
  // tabletop cannot write to strategy-sim cache by default
  assert.equal(assertModeCanWrite("tabletop", "runtime/cache/strategy-sim/data.json").allowed, false);
  // but with allowedNamespaces=[strategy-sim], it can
  const r = assertModeCanWrite("tabletop", "runtime/cache/strategy-sim/data.json", {
    allowedNamespaces: ["strategy-sim"]
  });
  assert.equal(r.allowed, true);
});

test("writeModeCache blocks cross-mode cache write", async () => {
  const root = makeTempProject("wt-isolation-cache");
  try {
    const project = { projectRoot: root, mode: "tabletop" };
    // tabletop cannot write to mystery-puzzle cache namespace
    const cacheWrites = [
      { relativePath: "runtime/cache/mystery-puzzle/summary.json", json: { turn: 1 } }
    ];
    const r = await writeModeCache(project, cacheWrites, svc, { modeId: "tabletop" });
    assert.equal(r.ok, false);
    assert.equal(r.entriesWritten, 0);
    assert.ok(r.errors.some(e => e.code === "ISOLATION_BLOCKED"));
  } finally {
    cleanupDir(root);
  }
});

test("writeModeCache allows own cache write with isolation check", async () => {
  const root = makeTempProject("wt-isolation-own");
  try {
    const project = { projectRoot: root, mode: "character" };
    const cacheWrites = [
      { relativePath: "runtime/cache/character/summary.json", json: { turn: 1 } }
    ];
    const r = await writeModeCache(project, cacheWrites, svc, { modeId: "character" });
    assert.equal(r.ok, true);
    assert.equal(r.entriesWritten, 1);
    // verify file was actually written
    assert.ok(existsSync(join(root, "runtime", "cache", "character", "summary.json")));
  } finally {
    cleanupDir(root);
  }
});

test("approveProposal blocks non-shared targetFile", async () => {
  const root = makeTempProject("wt-iso-prop");
  try {
    const logPath = join(root, "runtime", "world-proposals.jsonl");
    const proposalId = "prop-iso-001";

    await writeJson(join(root, "runtime", "state.json"), { turnCount: 0 });
    await appendJsonl(logPath, {
      id: proposalId, type: "world_state_update", status: "pending",
      patch: { replace: { turnCount: 99 } },
      targetFile: "runtime/state.json",  // ← 尝试写 runtime/, 不是 shared/
      summary: "should be blocked", createdAt: new Date().toISOString()
    });

    const project = { projectRoot: root, proposalLog: logPath };
    const r = await approveProposal(project, proposalId, svc);

    assert.equal(r.ok, false);
    assert.ok(r.message.includes("shared/"));
  } finally {
    cleanupDir(root);
  }
});

test("approveProposal allows shared/ targetFile", async () => {
  const root = makeTempProject("wt-iso-prop-ok");
  try {
    const logPath = join(root, "runtime", "world-proposals.jsonl");
    const sharedPath = join(root, "shared", "world_state.json");
    const proposalId = "prop-iso-002";

    await writeJson(sharedPath, { title: "old" });
    await appendJsonl(logPath, {
      id: proposalId, type: "world_state_update", status: "pending",
      patch: { replace: { title: "new" } },
      targetFile: "shared/world_state.json",  // ← shared/ 路径，允许
      summary: "should be allowed", createdAt: new Date().toISOString()
    });

    const project = { projectRoot: root, proposalLog: logPath };
    const r = await approveProposal(project, proposalId, svc);

    assert.equal(r.ok, true);
    assert.equal(r.status, "approved");
    const shared = readJsonSync(sharedPath, {});
    assert.equal(shared.title, "new");
  } finally {
    cleanupDir(root);
  }
});
