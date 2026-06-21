import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createAlchemyPreviewService } from "../../src/server/alchemy-preview-service.js";
import { readJsonSync, writeJson } from "../../src/server/fs-utils.js";

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "wt-alchemy-preview-unit-"));
  const enqueued = [];
  const service = createAlchemyPreviewService({
    previewRoot: () => join(root, "runtime", "alchemy-previews"),
    readJson: readJsonSync,
    writeJson,
    exists: existsSync,
    guessTypes: () => ["character"],
    runAlchemy: async () => ({
      _llmUsed: false,
      items: [{ typeId: "character", entity: "红衣少女", confidence: 0.8, data: { name: "红衣少女", description: "守护终端。" } }],
      stats: { total: 1 },
      phases: [{ phase: "extract", method: "test" }]
    }),
    enqueueReviewItems: async (items, source) => {
      enqueued.push({ items, source });
      return items.map((item, index) => ({ ...item, id: `review-${index}` }));
    }
  });
  return { root, service, enqueued };
}

test("alchemy preview persists a scrubbed excerpt without enqueueing or touching formal data", async () => {
  const { root, service, enqueued } = await fixture();
  try {
    const formalPath = join(root, "shared-worldbook.json");
    writeFileSync(formalPath, "formal-data", "utf8");
    const secret = "sk-this-is-a-secret-value-123456";
    const text = `apiKey=${secret} C:\\Users\\ExampleUser\\private.txt ` + "世界树终端。".repeat(300);
    const result = await service.create({ text, mode: "co_create", target: "mixed" });

    assert.equal(result.status, "ok");
    assert.equal(result.preview.items.length, 1);
    assert.equal(enqueued.length, 0);
    assert.equal(readFileSync(formalPath, "utf8"), "formal-data");

    const savedPath = join(root, "runtime", "alchemy-previews", `${result.previewId}.json`);
    const savedText = readFileSync(savedPath, "utf8");
    const saved = JSON.parse(savedText);
    assert.equal(saved.input.length, text.length);
    assert.ok(saved.input.excerpt.length <= 1000);
    assert.equal(savedText.includes(secret), false);
    assert.equal(savedText.includes("C:\\Users\\ExampleUser"), false);
    assert.equal(savedText.includes(text), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("alchemy preview rejects traversal ids and invalid refine requests", async () => {
  const { root, service } = await fixture();
  try {
    assert.throws(() => service.load("../secrets.json"), error => error.code === "ALCHEMY_PREVIEW_ID_INVALID");
    await assert.rejects(service.refine({ previewId: "00000000-0000-4000-8000-000000000000", instruction: "补全" }), error => error.code === "ALCHEMY_PREVIEW_NOT_FOUND");

    const created = await service.create({ text: "世界树终端和红衣少女。" });
    await assert.rejects(service.refine({ previewId: created.previewId, instruction: "   " }), error => error.code === "ALCHEMY_REFINE_REQUIRED");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("alchemy commit is explicit, selection-aware and single-use", async () => {
  const { root, service, enqueued } = await fixture();
  try {
    const created = await service.create({ text: "世界树终端和红衣少女。" });
    await assert.rejects(service.commit({ previewId: created.previewId, action: "enqueue_review", selectedItemIds: [] }), error => error.code === "ALCHEMY_COMMIT_EMPTY");
    assert.equal(enqueued.length, 0);

    const item = created.preview.items[0];
    const committed = await service.commit({
      previewId: created.previewId,
      action: "enqueue_review",
      selectedItemIds: [item.id],
      editedItems: [{ ...item, title: "终端守护者", content: "已由用户明确编辑。" }]
    });
    assert.equal(committed.stats.enqueued, 1);
    assert.equal(enqueued.length, 1);
    assert.equal(enqueued[0].items[0].entity, "终端守护者");
    await assert.rejects(service.commit({ previewId: created.previewId, action: "enqueue_review" }), error => error.code === "ALCHEMY_PREVIEW_ALREADY_COMMITTED");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
