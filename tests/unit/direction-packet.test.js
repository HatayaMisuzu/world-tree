// tests/unit/direction-packet.test.js

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  PACKET_VERSION,
  PACING_OPTIONS,
  PRESSURE_OPTIONS,
  EVENT_INTENSITY_OPTIONS,
  createDirectionPacket,
  validateDirectionPacket,
  normalizeDirectionPacket,
  summarizeDirectionPacket,
  formatDirectionPacket,
} from "../../src/core/engine/direction-packet.js";

describe("direction-packet", () => {
  describe("createDirectionPacket", () => {
    it("creates a valid packet with defaults", () => {
      const p = createDirectionPacket("turn-1", "worldbook");
      assert.equal(p.turnId, "turn-1");
      assert.equal(p.mode, "worldbook");
      assert.equal(p.directorDecision.pacing, "hold");
      assert.equal(p.directorDecision.pressure, "medium");
      assert.equal(p.writingConstraints.length, "medium");
      assert.equal(p.writingConstraints.perspective, "third_person");
    });

    it("creates character_card mode packet", () => {
      const p = createDirectionPacket("turn-x", "character_card");
      assert.equal(p.mode, "character_card");
    });
  });

  describe("malformed packet defense", () => {
    it("survives completely empty packet", () => {
      const p = normalizeDirectionPacket({});
      assert.equal(p.directorDecision.pacing, "hold");
      assert.equal(p.contentPlan.mustInclude.length, 0);
      assert.equal(p.contentPlan.mustNotInclude.length, 0);
    });

    it("survives missing directorDecision", () => {
      const p = normalizeDirectionPacket({ turnId: "t1", mode: "worldbook" });
      assert.equal(p.directorDecision.pacing, "hold");
      assert.equal(p.directorDecision.pressure, "medium");
    });

    it("survives missing contentPlan sub-arrays", () => {
      const p = normalizeDirectionPacket({
        turnId: "t1", mode: "worldbook",
        contentPlan: {}
      });
      assert.equal(p.contentPlan.mustInclude.length, 0);
      assert.equal(p.contentPlan.mustNotInclude.length, 0);
    });

    it("survives null/undefined packet", () => {
      const p = normalizeDirectionPacket(null);
      assert.equal(p.directorDecision.pacing, "hold");
    });
  });

  describe("validateDirectionPacket", () => {
    it("accepts valid packet", () => {
      const p = createDirectionPacket("t1", "worldbook");
      const result = validateDirectionPacket(p);
      assert.equal(result.valid, true);
    });

    it("rejects missing pacing", () => {
      const p = createDirectionPacket("t1", "worldbook");
      p.directorDecision.pacing = "invalid";
      const result = validateDirectionPacket(p);
      assert.equal(result.valid, false);
    });

    it("rejects missing pressure", () => {
      const p = createDirectionPacket("t1", "worldbook");
      p.directorDecision.pressure = "extreme";
      const result = validateDirectionPacket(p);
      assert.equal(result.valid, false);
    });
  });

  describe("normalizeDirectionPacket", () => {
    it("fills missing defaults", () => {
      const minimal = { turnId: "t1", mode: "worldbook" };
      const norm = normalizeDirectionPacket(minimal);
      assert.equal(norm.directorDecision.pacing, "hold");
      assert.equal(norm.playerAnalysis.engagement, 5);
    });
  });

  describe("summarizeDirectionPacket", () => {
    it("returns non-empty string for valid packet", () => {
      const p = createDirectionPacket("t1", "worldbook");
      const s = summarizeDirectionPacket(p);
      assert.ok(typeof s === "string");
      assert.ok(s.length > 0);
    });
  });

  describe("formatDirectionPacket", () => {
    it("formats packet for LLM injection", () => {
      const p = createDirectionPacket("t1", "worldbook");
      p.directorDecision.pacing = "escalate";
      const s = formatDirectionPacket(p);
      assert.ok(s.includes("escalate"));
      assert.ok(s.includes("═══") || s.includes("开始") || s.includes("结束"));
    });
  });

  describe("PACING_OPTIONS", () => {
    it("includes common options", () => {
      assert.ok(PACING_OPTIONS.includes("hold"));
      assert.ok(PACING_OPTIONS.includes("escalate"));
      assert.ok(PACING_OPTIONS.includes("resolve"));
    });
  });

  describe("EVENT_INTENSITY_OPTIONS", () => {
    it("includes all levels", () => {
      assert.ok(EVENT_INTENSITY_OPTIONS.includes("none"));
      assert.ok(EVENT_INTENSITY_OPTIONS.includes("light"));
      assert.ok(EVENT_INTENSITY_OPTIONS.includes("moderate"));
      assert.ok(EVENT_INTENSITY_OPTIONS.includes("major"));
    });
  });
});
