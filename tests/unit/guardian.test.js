import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  validatePathWithinRoot,
  runGuardian,
  validateNarrativeAgainstDirection
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
      assert.equal(validatePathWithinRoot("/data", "/etc/passwd"), false);
    });

    it("normalizes backslashes", () => {
      assert.equal(validatePathWithinRoot("C:\\data", "C:\\data\\engine\\file.json"), true);
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
        intent: { kind: "narrative" }
      });
      assert.equal(result.ok, false);
      assert.equal(result.checks.find((c) => c.id === "module-loaded")?.ok, false);
    });

    it("passes with loaded module", () => {
      const result = runGuardian({
        model: { loaded: true, selected: { id: "test-module", name: "Test" } },
        intent: { kind: "narrative" }
      });
      assert.equal(result.ok, true);
    });

    it("blocks continuation without loaded module", () => {
      const result = runGuardian({
        model: { loaded: false, selected: null },
        intent: { kind: "narrative" }
      });
      assert.equal(result.checks.find((c) => c.id === "continuation-safety")?.ok, false);
    });
  });

  describe("validateNarrativeAgainstDirection", () => {
    it("fails when mustInclude items are missing and reports the item", () => {
      const result = validateNarrativeAgainstDirection({
        narrative: "The adventurer watches the road in silence.",
        directionPacket: {
          contentPlan: { mustInclude: ["mission-token"], mustNotInclude: [] },
          writingConstraints: { length: "medium" }
        }
      });
      assert.equal(result.pass, false);
      assert.ok(result.issues.some((issue) => issue.includes("mission-token")));
    });

    it("does not duplicate mustInclude issues or double-penalize score", () => {
      const result = validateNarrativeAgainstDirection({
        narrative: "The adventurer watches the road in silence.",
        directionPacket: {
          contentPlan: { mustInclude: ["mission-token"], mustNotInclude: [] },
          writingConstraints: { length: "medium" }
        }
      });
      assert.equal(result.issues.filter((issue) => issue.includes("mission-token")).length, 1);
      assert.equal(result.score, 82);
    });

    it("fails when mustNotInclude items appear and reports the item", () => {
      const result = validateNarrativeAgainstDirection({
        narrative: "The forbidden artifact opens a bright gate.",
        directionPacket: {
          contentPlan: { mustInclude: [], mustNotInclude: ["forbidden artifact"] },
          writingConstraints: { length: "medium" }
        }
      });
      assert.equal(result.pass, false);
      assert.ok(result.issues.some((issue) => issue.includes("forbidden artifact")));
    });

    it("flags missing response to player question", () => {
      const result = validateNarrativeAgainstDirection({
        narrative: "Rain keeps falling over the empty street.",
        userInput: "Where is Mira?",
        directionPacket: {
          contentPlan: { mustInclude: [], mustNotInclude: [] },
          writingConstraints: { length: "medium" }
        }
      });
      assert.equal(result.pass, false);
      assert.ok(result.issues.some((issue) => issue.includes("no clear response") || issue.includes("没有明显的回应")));
    });

    it("flags empty output", () => {
      const result = validateNarrativeAgainstDirection({
        narrative: "",
        directionPacket: {
          contentPlan: { mustInclude: ["anything"], mustNotInclude: [] },
          writingConstraints: { length: "medium" }
        }
      });
      assert.equal(result.pass, false);
      assert.equal(result.severity, "critical");
    });

    it("passes good output", () => {
      const result = validateNarrativeAgainstDirection({
        narrative: "Mira answers that the bridge guard carries the mission-token, then points toward the north road.",
        userInput: "Where is the mission-token?",
        directionPacket: {
          contentPlan: { mustInclude: ["mission-token"], mustNotInclude: ["forbidden artifact"] },
          writingConstraints: { length: "medium" }
        }
      });
      assert.equal(result.pass, true);
      assert.equal(result.severity, "none");
    });
  });
});
