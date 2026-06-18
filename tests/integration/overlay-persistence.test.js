import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { OVERLAY_FILES, WRITE_POLICY } from "../../src/core/engine/overlay-store.js";
import { applyOverlayWriteSet, resolveOverlayPath } from "../../src/server/persistence-service.js";

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf-8"));
}

describe("overlay persistence service", () => {
  it("writes auto operations and queues confirm/manual operations", async () => {
    const runtimeDir = await mkdtemp(join(tmpdir(), "world-tree-overlay-"));
    try {
      const result = await applyOverlayWriteSet(runtimeDir, [
        {
          file: OVERLAY_FILES.RUNTIME,
          op: "merge-json",
          policy: WRITE_POLICY.AUTO.level,
          payload: { turnCount: 1 }
        },
        {
          file: OVERLAY_FILES.WORLDBOOK,
          op: "merge-json",
          policy: WRITE_POLICY.CONFIRM.level,
          payload: { entries: [{ title: "pending" }] }
        },
        {
          file: "unknown.json",
          op: "write-json",
          payload: { bad: true }
        }
      ]);

      assert.equal(result.auto, 1);
      assert.equal(result.pending, 1);
      assert.equal(result.manual, 1);
      assert.deepEqual(readJson(join(runtimeDir, "overlay", OVERLAY_FILES.RUNTIME)).turnCount, 1);
      assert.ok(existsSync(join(runtimeDir, "overlay", OVERLAY_FILES.PENDING)));
      assert.ok(existsSync(join(runtimeDir, "overlay", OVERLAY_FILES.MANUAL)));
      const pendingLine = readFileSync(join(runtimeDir, "overlay", OVERLAY_FILES.PENDING), "utf-8").trim();
      assert.ok(JSON.parse(pendingLine).id);
      assert.equal(existsSync(join(runtimeDir, "overlay", "unknown.json")), false);
    } finally {
      await rm(runtimeDir, { recursive: true, force: true });
    }
  });

  it("rejects direct writes to files outside the overlay whitelist", () => {
    assert.throws(
      () => resolveOverlayPath("/tmp/world-tree", { file: "../secret.json" }),
      /Unknown overlay file/
    );
  });
});
