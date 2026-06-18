import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";

import {
  isApprovedOverlayTarget,
  runGuardian
} from "../../src/core/engine/guardian.js";

test("isApprovedOverlayTarget accepts runtime overlay whitelist files", () => {
  assert.equal(isApprovedOverlayTarget("runtime/overlay/runtime-overlay.json"), true);
  assert.equal(isApprovedOverlayTarget("runtime/overlay/worldbook-overlay.json"), true);
  assert.equal(isApprovedOverlayTarget("C:/demo/world/runtime/overlay/pending.jsonl"), true);
});

test("isApprovedOverlayTarget rejects shared and core json files", () => {
  assert.equal(isApprovedOverlayTarget("world.json"), false);
  assert.equal(isApprovedOverlayTarget("shared/worldbook.json"), false);
  assert.equal(isApprovedOverlayTarget("runtime/state.json"), false);
  assert.equal(isApprovedOverlayTarget("runtime/overlay/evil.json"), false);
});

test("runGuardian allows approved overlay target inside root", () => {
  const root = join("tmp", "world");
  const targetPath = join(root, "runtime", "overlay", "runtime-overlay.json");

  const result = runGuardian({
    model: {
      loaded: true,
      rootPath: root,
      selected: { id: "demo" }
    },
    intent: { kind: "engine-write" },
    targetPath
  });

  assert.equal(result.ok, true);
  assert.equal(result.checks.find((item) => item.id === "overlay-only")?.ok, true);
});

test("runGuardian rejects direct core json write target", () => {
  const root = join("tmp", "world");
  const targetPath = join(root, "shared", "worldbook.json");

  const result = runGuardian({
    model: {
      loaded: true,
      rootPath: root,
      selected: { id: "demo" }
    },
    intent: { kind: "engine-write" },
    targetPath
  });

  assert.equal(result.ok, false);
  assert.equal(result.checks.find((item) => item.id === "overlay-only")?.ok, false);
});
