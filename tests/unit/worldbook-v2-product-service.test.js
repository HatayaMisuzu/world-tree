import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ensureDir, readJsonSync, writeJson } from "../../src/server/fs-utils.js";
import { createWorldbookV2ProductService } from "../../src/server/worldbook-v2-product-service.js";

function makeService() {
  const root = mkdtempSync(join(tmpdir(), "wt-wbv2-product-"));
  const worldDir = join(root, "engine", "worlds", "TestWorld");
  ensureDir(join(worldDir, "shared"));
  ensureDir(join(worldDir, "runtime"));
  const service = createWorldbookV2ProductService({
    dataRoot: () => root,
    moduleWorldDir: () => worldDir,
    pathWithinRoot: (base, target) => target.startsWith(base)
  });
  return { root, worldDir, service, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

test("loads legacy worldbook through V2 product service", async () => {
  const ctx = makeService();
  try {
    await writeJson(join(ctx.worldDir, "shared", "worldbook.json"), { entries: [{ title: "Public Gate", keys: ["gate"], content: "Public Gate is open.", visibility: "public" }] });
    const loaded = await ctx.service.load({ moduleKey: "world:TestWorld" });
    assert.equal(loaded.status, "ok");
    assert.equal(loaded.entries[0].title, "Public Gate");
  } finally {
    ctx.cleanup();
  }
});

test("save rejects invalid entries instead of silently dropping them", async () => {
  const ctx = makeService();
  try {
    const result = await ctx.service.save({ moduleKey: "world:TestWorld", entries: [{ title: "Broken", content: "" }] });
    assert.equal(result.status, "error");
    assert.equal(result.code, "WORLDBOOK_ENTRY_INVALID");
  } finally {
    ctx.cleanup();
  }
});

test("saves edited entries and reads back", async () => {
  const ctx = makeService();
  try {
    const saved = await ctx.service.save({ moduleKey: "world:TestWorld", entries: [{ title: "River", keys: ["river"], content: "River appears in the public map.", visibility: "public" }] });
    assert.equal(saved.status, "ok");
    const stored = readJsonSync(join(ctx.worldDir, "shared", "worldbook.json"), {});
    assert.equal(stored.entries[0].title, "River");
    const reloaded = await ctx.service.load({ moduleKey: "world:TestWorld" });
    assert.equal(reloaded.entries.length, 1);
  } finally {
    ctx.cleanup();
  }
});

test("candidate create does not mutate canon and adopt requires explicit decision", async () => {
  const ctx = makeService();
  try {
    await ctx.service.save({ moduleKey: "world:TestWorld", entries: [{ title: "Canon", keys: ["canon"], content: "Canon remains stable.", visibility: "public" }] });
    const candidate = await ctx.service.createCandidate({ moduleKey: "world:TestWorld", entry: { title: "Candidate", keys: ["candidate"], content: "Candidate waits for approval.", visibility: "public" } });
    assert.equal(candidate.status, "ok");
    assert.equal(readJsonSync(join(ctx.worldDir, "shared", "worldbook.json"), {}).entries.length, 1);

    const adopted = await ctx.service.decideCandidate({ moduleKey: "world:TestWorld", candidateId: candidate.candidate.candidateId, decision: "adopt" });
    assert.equal(adopted.status, "ok");
    const stored = readJsonSync(join(ctx.worldDir, "shared", "worldbook.json"), {});
    assert.equal(stored.entries.some((entry) => entry.title === "Candidate"), true);
  } finally {
    ctx.cleanup();
  }
});

test("inject preview and export exclude hidden/internal entries", async () => {
  const ctx = makeService();
  try {
    await ctx.service.save({
      moduleKey: "world:TestWorld",
      entries: [
        { title: "Public Gate", keys: ["gate"], content: "Public Gate is visible.", visibility: "public" },
        { title: "Hidden Killer", keys: ["killer"], content: "Hidden Killer is the answer.", visibility: "hiddenTruth" }
      ]
    });
    const preview = await ctx.service.injectPreview({ moduleKey: "world:TestWorld", userInput: "I inspect the gate and killer clue." });
    assert.equal(preview.status, "ok");
    const previewText = JSON.stringify(preview);
    assert.equal(previewText.includes("Hidden Killer"), false);
    assert.equal(existsSync(join(ctx.worldDir, "runtime", "worldbook-v2", "usage-log.jsonl")), true);

    const exported = await ctx.service.exportState({ moduleKey: "world:TestWorld" });
    assert.equal(exported.status, "ok");
    assert.equal(JSON.stringify(exported.export).includes("Hidden Killer"), false);
  } finally {
    ctx.cleanup();
  }
});

test("candidate decisions reload as adopted or rejected terminal states", async () => {
  const adoptedCtx = makeService();
  const rejectedCtx = makeService();
  try {
    const adoptedCandidate = await adoptedCtx.service.createCandidate({ moduleKey: "world:TestWorld", entry: { title: "Adopt me", content: "Adopted content", visibility: "public" } });
    await adoptedCtx.service.decideCandidate({ moduleKey: "world:TestWorld", candidateId: adoptedCandidate.candidate.candidateId, decision: "adopt" });
    assert.equal((await adoptedCtx.service.load({ moduleKey: "world:TestWorld" })).candidates[0].status, "adopted");

    const rejectedCandidate = await rejectedCtx.service.createCandidate({ moduleKey: "world:TestWorld", entry: { title: "Reject me", content: "Rejected content", visibility: "public" } });
    await rejectedCtx.service.decideCandidate({ moduleKey: "world:TestWorld", candidateId: rejectedCandidate.candidate.candidateId, decision: "reject" });
    assert.equal((await rejectedCtx.service.listCandidates({ moduleKey: "world:TestWorld" })).candidates[0].status, "rejected");
  } finally {
    adoptedCtx.cleanup();
    rejectedCtx.cleanup();
  }
});

test("duplicate adopt is idempotent and opposite decision is rejected", async () => {
  const ctx = makeService();
  try {
    const candidate = await ctx.service.createCandidate({ moduleKey: "world:TestWorld", entry: { title: "Only once", content: "Canonical once", visibility: "public" } });
    const candidateId = candidate.candidate.candidateId;
    const first = await ctx.service.decideCandidate({ moduleKey: "world:TestWorld", candidateId, decision: "adopt" });
    const second = await ctx.service.decideCandidate({ moduleKey: "world:TestWorld", candidateId, decision: "adopt" });
    const opposite = await ctx.service.decideCandidate({ moduleKey: "world:TestWorld", candidateId, decision: "reject" });
    assert.equal(first.canonMutated, true);
    assert.equal(second.alreadyDecided, true);
    assert.equal(second.canonMutated, false);
    assert.equal(opposite.code, "CANDIDATE_ALREADY_DECIDED");
    const canon = readJsonSync(join(ctx.worldDir, "shared", "worldbook.json"), { entries: [] });
    assert.equal(canon.entries.filter((entry) => entry.title === "Only once").length, 1);
    const decisions = readFileSync(join(ctx.worldDir, "runtime", "worldbook-v2", "candidate-decisions.jsonl"), "utf8").trim().split("\n");
    assert.equal(decisions.length, 1);
  } finally {
    ctx.cleanup();
  }
});

test("frontend adopt selection has no terminal-candidate fallback", () => {
  const source = readFileSync(join(process.cwd(), "browser", "controllers", "entry-controller.js"), "utf8");
  const selection = source.match(/const latest = .*find\(item => item\.status === "pending"\);/)?.[0] || "";
  assert.equal(selection.includes("slice(-1)[0]"), false);
  assert.equal(selection.includes("status === \"pending\""), true);
});
