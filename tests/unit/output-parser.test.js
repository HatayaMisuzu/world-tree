// tests/unit/output-parser.test.js

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseLooseYaml,
  parseMarkedOutput,
  sectionsToOverlayPatch,
  extractVisibleNarrative,
  parseStateSuggestions,
  parseEmotionFeedback,
} from "../../src/core/engine/output-parser.js";

describe("output-parser", () => {
  describe("parseLooseYaml", () => {
    it("parses simple key-value pairs", () => {
      const result = parseLooseYaml("key: value\ncount: 42");
      assert.equal(result.key, "value");
      assert.equal(result.count, 42);
    });

    it("parses booleans", () => {
      const result = parseLooseYaml("active: true\nhidden: false");
      assert.equal(result.active, true);
      assert.equal(result.hidden, false);
    });

    it("parses list items", () => {
      const result = parseLooseYaml("- item1\n- item2");
      assert.deepEqual(result.items, ["item1", "item2"]);
    });

    it("handles empty input", () => {
      const result = parseLooseYaml("");
      assert.deepEqual(result, {});
    });
  });

  describe("parseMarkedOutput", () => {
    it("extracts narrative before first marker", () => {
      const { narrative, sections } = parseMarkedOutput(
        "这是叙事正文。\n【状态】\nkey: value"
      );
      assert.ok(narrative.includes("叙事正文"));
      assert.ok(sections["状态"]);
      assert.equal(sections["状态"].key, "value");
    });

    it("handles text with no markers", () => {
      const { narrative, sections } = parseMarkedOutput("纯叙事，无标记段。");
      assert.equal(narrative, "纯叙事，无标记段。");
      assert.deepEqual(sections, {});
    });

    it("extracts multiple sections", () => {
      const { sections } = parseMarkedOutput(
        "叙事。\n【状态】\na: 1\n【情绪】\nb: 2"
      );
      assert.ok(sections["状态"]);
      assert.ok(sections["情绪"]);
    });
  });

  describe("extractVisibleNarrative", () => {
    it("extracts 叙事 section content", () => {
      const result = extractVisibleNarrative(
        "【叙事】\n正文内容在此。\n【状态建议】\nx: 1"
      );
      assert.equal(result, "正文内容在此。");
    });

    it("falls back to full text when no marker", () => {
      const result = extractVisibleNarrative("只有正文，无标记。");
      assert.equal(result, "只有正文，无标记。");
    });
  });

  describe("sectionsToOverlayPatch", () => {
    it("maps sections to overlay fields", () => {
      const parsed = parseMarkedOutput(
        "叙事。\n【状态】\nweather: sunny\n【角色】\nname: Alice"
      );
      const patch = sectionsToOverlayPatch(parsed, "test input");
      assert.ok(patch.runtime);
      assert.ok(patch.characters);
      assert.equal(patch.runtime.weather, "sunny");
      assert.equal(patch.input, "test input");
    });
  });

  describe("parseStateSuggestions", () => {
    it("extracts clues from raw data", () => {
      const sections = {
        "状态建议": { cluesAdded: ["线索A", "线索B"] },
      };
      const result = parseStateSuggestions(sections);
      assert.deepEqual(result.cluesAdded, ["线索A", "线索B"]);
    });

    it("returns empty arrays for missing data", () => {
      const result = parseStateSuggestions({});
      assert.deepEqual(result.cluesAdded, []);
      assert.deepEqual(result.relationshipDelta, []);
    });
  });

  describe("parseEmotionFeedback", () => {
    it("extracts emotion deltas", () => {
      const sections = {
        "情绪反馈": { engagement: 1, tension: -1 },
      };
      const result = parseEmotionFeedback(sections);
      assert.equal(result.engagement, 1);
      assert.equal(result.tension, -1);
    });

    it("returns null for missing section", () => {
      const result = parseEmotionFeedback({});
      assert.equal(result, null);
    });
  });
});
