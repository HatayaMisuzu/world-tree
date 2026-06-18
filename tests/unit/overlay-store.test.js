import test from "node:test";
import assert from "node:assert/strict";

import {
  OVERLAY_FILES,
  WRITE_POLICY,
  classifyWriteLevel,
  splitWriteSet
} from "../../src/core/engine/overlay-store.js";

test("unknown overlay file is manual even with policy:auto", () => {
  const level = classifyWriteLevel({
    file: "unknown.json",
    op: "write-json",
    policy: "auto",
    payload: { unsafe: true }
  });

  assert.equal(level.level, WRITE_POLICY.MANUAL_ONLY.level);
});

test("sensitive known overlay files require confirm even with policy:auto", () => {
  for (const file of [
    OVERLAY_FILES.CHARACTERS,
    OVERLAY_FILES.WORLDBOOK,
    OVERLAY_FILES.SCENE_CHAIN
  ]) {
    const level = classifyWriteLevel({
      file,
      op: "merge-json",
      policy: "auto",
      payload: {}
    });

    assert.equal(level.level, WRITE_POLICY.CONFIRM.level);
  }
});

test("safe overlay files remain auto by default", () => {
  for (const file of [
    OVERLAY_FILES.RUNTIME,
    OVERLAY_FILES.CANON,
    OVERLAY_FILES.MEMORY,
    OVERLAY_FILES.PATCH_LOG,
    OVERLAY_FILES.AUDIT_LOG,
    OVERLAY_FILES.COMMAND_LOG
  ]) {
    const level = classifyWriteLevel({
      file,
      op: file.endsWith(".jsonl") ? "append-jsonl" : "merge-json",
      payload: {}
    });

    assert.equal(level.level, WRITE_POLICY.AUTO.level);
  }
});

test("splitWriteSet sends unknown policy:auto operation to manual queue", () => {
  const result = splitWriteSet([
    { file: OVERLAY_FILES.RUNTIME, op: "merge-json", payload: {} },
    { file: OVERLAY_FILES.WORLDBOOK, op: "merge-json", policy: "auto", payload: {} },
    { file: "evil.json", op: "write-json", policy: "auto", payload: {} }
  ]);

  assert.equal(result.auto.length, 1);
  assert.equal(result.pending.length, 1);
  assert.equal(result.manual.length, 1);
  assert.equal(result.manual[0].file, "evil.json");
});
