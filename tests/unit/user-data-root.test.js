import test from "node:test";
import assert from "node:assert/strict";
import { isAbsolute, join, resolve } from "node:path";

import { getUserDataRoot } from "../../src/server/user-data-root.js";

test("getUserDataRoot uses an absolute WORLD_TREE_USER_DATA_DIR override", () => {
  const result = getUserDataRoot({ WORLD_TREE_USER_DATA_DIR: join(".", "tmp-user-data") });
  assert.equal(result, resolve("tmp-user-data"));
  assert.equal(isAbsolute(result), true);
});

test("getUserDataRoot falls back to repository userData", () => {
  const result = getUserDataRoot({});
  assert.equal(result.endsWith(join("world-tree-desktop", "userData")), true);
});
