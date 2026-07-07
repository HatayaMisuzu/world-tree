import test from "node:test";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";

import { parseSTCard } from "../../src/core/data/alchemy/parsers/st-card.js";
import { parseLorebook, lorebookToItems } from "../../src/core/data/alchemy/parsers/nai-lorebook.js";

test("ST JSON character card reports unsupported fields instead of swallowing them", () => {
  const parsed = parseSTCard({
    spec: "chara_card_v2",
    data: {
      name: "Mira",
      description: "Archivist",
      first_mes: "Hello",
      unknown_future_field: true
    }
  });
  assert.equal(parsed.name, "Mira");
  assert.deepEqual(parsed.ignoredUnsupportedFields, ["unknown_future_field"]);
});

test("ST PNG chara chunk parses with pure JS", () => {
  const payload = {
    spec: "chara_card_v2",
    data: { name: "PNG Mira", first_mes: "Hi" }
  };
  const png = makePngWithText("chara", Buffer.from(JSON.stringify(payload), "utf8").toString("base64"));
  const parsed = parseSTCard(png);
  assert.equal(parsed.name, "PNG Mira");
  assert.equal(parsed.format, "st_v2");
});

test("ST lorebook object entries map to worldbook items", () => {
  const parsed = parseLorebook({
    entries: {
      "1": { key: ["Moon Gate"], keysecondary: ["silver"], content: "A sealed gate.", comment: "Gate", constant: false }
    }
  });
  assert.equal(parsed.format, "st_lorebook");
  const items = lorebookToItems(parsed);
  assert.equal(items[0].typeId, "worldbook-entry");
  assert.deepEqual(items[0].data.keywords, ["Moon Gate"]);
  assert.equal(items[0].data.content, "A sealed gate.");
});

function makePngWithText(keyword, value) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const textData = Buffer.concat([Buffer.from(keyword, "utf8"), Buffer.from([0]), Buffer.from(value, "utf8")]);
  const textChunk = Buffer.concat([u32(textData.length), Buffer.from("tEXt"), textData, u32(0)]);
  const iend = Buffer.concat([u32(0), Buffer.from("IEND"), u32(0)]);
  return Buffer.concat([signature, textChunk, iend]);
}

function u32(value) {
  const buf = Buffer.alloc(4);
  buf.writeUInt32BE(value);
  return buf;
}
