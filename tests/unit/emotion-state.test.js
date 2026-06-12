// tests/unit/emotion-state.test.js
// Node 18+ built-in test runner: node --test tests/unit/emotion-state.test.js

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  EMOTION_DIMENSIONS,
  INITIAL_STATE,
  getDefaultEmotionState,
  updateEmotionState,
  getEmotionProfile,
  formatEmotionState,
  resetEmotionState,
} from "../../src/core/engine/emotion-state.js";

describe("emotion-state", () => {
  describe("getDefaultEmotionState", () => {
    it("returns neutral 5s", () => {
      const s = getDefaultEmotionState();
      assert.equal(s.engagement, 5);
      assert.equal(s.tension, 5);
      assert.equal(s.fatigue, 5);
      assert.equal(s.curiosity, 5);
    });

    it("returns a new object each call", () => {
      const a = getDefaultEmotionState();
      const b = getDefaultEmotionState();
      a.engagement = 9;
      assert.equal(b.engagement, 5);
    });
  });

  describe("INITIAL_STATE", () => {
    it("has all 4 dimensions", () => {
      for (const dim of EMOTION_DIMENSIONS) {
        assert.ok(dim in INITIAL_STATE, `missing ${dim}`);
      }
    });

    it("all values are within 0-10", () => {
      for (const dim of EMOTION_DIMENSIONS) {
        const v = INITIAL_STATE[dim];
        assert.ok(v >= 0 && v <= 10, `${dim}=${v} out of range`);
      }
    });
  });

  describe("updateEmotionState", () => {
    it("engagement rises on long input", () => {
      const s = updateEmotionState(getDefaultEmotionState(), {
        input: "A".repeat(150),
      });
      assert.ok(s.engagement > 5, `engagement=${s.engagement}`);
    });

    it("tension decays toward neutral", () => {
      const high = { ...getDefaultEmotionState(), tension: 9 };
      const s = updateEmotionState(high, { input: "嗯" });
      assert.ok(s.tension < 9, `tension=${s.tension} should have decayed`);
    });

    it("fatigue rises on fatigue keywords", () => {
      const s = updateEmotionState(getDefaultEmotionState(), {
        input: "我累了...",
      });
      assert.ok(s.fatigue > 5, `fatigue=${s.fatigue}`);
    });

    it("curiosity rises on question input", () => {
      const s = updateEmotionState(getDefaultEmotionState(), {
        input: "这是为什么？",
      });
      assert.ok(s.curiosity > 5, `curiosity=${s.curiosity}`);
    });

    it("clamps values to 0-10 range", () => {
      // Push engagement very high
      let s = getDefaultEmotionState();
      for (let i = 0; i < 20; i++) {
        s = updateEmotionState(s, { input: "A".repeat(400), turnCount: i + 1 });
      }
      assert.ok(s.engagement <= 10, `engagement=${s.engagement}`);
      assert.ok(s.fatigue >= 0, `fatigue=${s.fatigue}`);
    });
  });

  describe("getEmotionProfile", () => {
    it("detects high engagement", () => {
      const p = getEmotionProfile({ ...getDefaultEmotionState(), engagement: 8 });
      assert.ok(p.dominant.includes("high-engagement"));
    });

    it("detects fatigue", () => {
      const p = getEmotionProfile({ ...getDefaultEmotionState(), fatigue: 9 });
      assert.ok(p.dominant.includes("fatigued"));
    });

    it("returns advice array", () => {
      const p = getEmotionProfile(getDefaultEmotionState());
      assert.ok(Array.isArray(p.advice));
    });
  });

  describe("formatEmotionState", () => {
    it("returns non-empty string", () => {
      const s = formatEmotionState(getDefaultEmotionState());
      assert.ok(s.length > 0);
      assert.ok(s.includes("投入度"));
    });
  });

  describe("resetEmotionState", () => {
    it("returns neutral 5s", () => {
      const s = resetEmotionState();
      assert.deepEqual(s, INITIAL_STATE);
    });
  });
});
