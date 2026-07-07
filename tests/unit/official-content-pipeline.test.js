import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

test("official content pipeline declares manifest requirements", () => {
  assert.equal(existsSync("content/README.md"), true);
  const manifest = JSON.parse(readFileSync("content/official/manifest.json", "utf8"));
  assert.equal(manifest.pipeline, "world-tree-official-content");
  for (const field of ["specVersion", "kind", "id", "title", "author", "license", "minEngine", "contentRating", "checksums"]) {
    assert.equal(manifest.requiredPackManifestFields.includes(field), true);
  }
});
