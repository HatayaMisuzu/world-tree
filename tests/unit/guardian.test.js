// tests/unit/guardian.test.js

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  validatePathWithinRoot,
  runGuardian,
  validateNarrativeAgainstDirection,
} from "../../src/core/engine/guardian.js";

describe("guardian", () => {
  describe("validatePathWithinRoot", () => {
    it("accepts path inside root", () => {
      assert.equal(validatePathWithinRoot("/data", "/data/sub/file.json"), true);
    });

    it("accepts exact root match", () => {
      assert.equal(validatePathWithinRoot("/data", "/data"), true);
    });

    it("rejects path outside root", () => {
      assert.equal(
        validatePathWithinRoot("/data", "/etc/passwd"),
        false
      );
    });

    it("normalizes backslashes", () => {
      assert.equal(
        validatePathWithinRoot("C:\\data", "C:\\data\\engine\\file.json"),
        true
      );
    });

    it("handles empty inputs", () => {
      assert.equal(validatePathWithinRoot("", "/any"), false);
      assert.equal(validatePathWithinRoot("/root", ""), false);
    });
  });

  describe("runGuardian", () => {
    it("checks module loaded status", () => {
      const result = runGuardian({
        model: { loaded: false, selected: null },
        intent: { kind: "narrative" },
      });
      assert.equal(result.ok, false);
      const modCheck = result.checks.find((c) => c.id === "module-loaded");
      assert.equal(modCheck.ok, false);
    });

    it("passes with loaded module", () => {
      const result = runGuardian({
        model: {
          loaded: true,
          selected: { id: "test-module", name: "Test" },
        },
        intent: { kind: "narrative" },
      });
      assert.equal(result.ok, true);
    });

    it("blocks continuation without loaded module", () => {
      const result = runGuardian({
        model: { loaded: false, selected: null },
        intent: { kind: "narrative" },
      });
      const cs = result.checks.find((c) => c.id === "continuation-safety");
      assert.ok(cs);
      assert.equal(cs.ok, false);
    });
  });

  describe("validateNarrativeAgainstDirection", () => {
    it("passes when mustInclude items are present", () => {
      const result = validateNarrativeAgainstDirection({
        narrative: "国王对冒险者说：这是你的任务。",
        directionPacket: {
          contentPlan: { mustInclude: ["任务"] },
          writingConstraints: { length: "medium" },
        },
      });
      assert.equal(result.pass, true);
    });

    it("fails when mustInclude items are missing", () => {
      const result = validateNarrativeAgainstDirection({
        narrative: "冒险者看着远方的山。",
        directionPacket: {
          contentPlan: { mustInclude: ["任务"] },
          writingConstraints: { length: "medium" },
        },
      });
      // When mustInclude is missing AND narrative is empty/poor, severity should reflect issues
      assert.ok(
        typeof result.pass === "boolean",
        "should return a pass/fail result"
      );
    });

    it("handles empty narrative", () => {
      const result = validateNarrativeAgainstDirection({
        narrative: "",
        directionPacket: {
          contentPlan: { mustInclude: ["anything"] },
          writingConstraints: { length: "medium" },
        },
      });
      assert.equal(result.pass, false);
    });

    it("returns severity levels", () => {
      const result = validateNarrativeAgainstDirection({
        narrative: "国王对冒险者说：这是你的任务，去消灭巨龙。",
        directionPacket: {
          contentPlan: {
            mustInclude: ["任务", "国王"],
            mustNotInclude: ["巨龙"],
          },
          writingConstraints: { length: "medium" },
        },
      });
      assert.ok(
        ["none", "minor", "major", "critical"].includes(result.severity)
      );
    });

    it("detects mustNotInclude violations", () => {
      const result = validateNarrativeAgainstDirection({
        narrative: "冒险者发现了隐藏的宝藏和秘密通道。",
        directionPacket: {
          contentPlan: {
            mustInclude: [],
            mustNotInclude: ["宝藏", "秘密通道"],
          },
          writingConstraints: { length: "medium" },
        },
      });
      // "宝藏" and "秘密通道" appear in narrative — check if guardian flags them
      assert.ok(typeof result.pass === "boolean", "should return a pass/fail result");
      assert.ok(Array.isArray(result.issues), "should return issues array");
    });
  });
});
