import { access } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const files = [
  "src/main.cjs",
  "src/preload.cjs",
  "src/v0-out/index.html",
  "src/core/data-store.js",
  "src/core/normalizers.js",
  "src/core/commands.js",
  "src/core/diagnostics.js",
  "src/core/path-catalog.js",
  "src/core/cards.js",
  "src/core/slash-commands.js",
  "src/core/world-engine.js",
  "src/core/engine/modules.js",
  "src/core/engine/commands.js",
  "src/core/engine/context-budget.js",
  "src/core/engine/guardian.js",
  "src/core/engine/lifecycle.js",
  "src/core/engine/output-parser.js",
  "src/core/engine/overlay-store.js",
  "src/core/engine/runtime.js",
  "src/core/data/worldbook.js",
  "src/core/data/world-state.js",
  "src/core/data/organizations.js",
  "src/core/data/characters.js",
  "src/core/data/cognition.js",
  "src/core/data/scenes.js",
  "src/core/data/templates.js",
  "src/core/data/rules.js",
  "src/core/data/timeline.js",
  "src/core/data/random-events.js",
  "src/core/data/prediction.js",
  "src/core/data/character-card.js",
  "src/core/data/processing-engine.js",
  "src/adapters/hermes.js",
  "src/adapters/llm.js",
  "src/adapters/local.js"
];

for (const file of files) {
  await access(resolve(root, file));
}

await Promise.all([
  import("../src/core/data-store.js"),
  import("../src/core/normalizers.js"),
  import("../src/core/commands.js"),
  import("../src/core/diagnostics.js"),
  import("../src/core/path-catalog.js"),
  import("../src/core/cards.js"),
  import("../src/core/slash-commands.js"),
  import("../src/core/world-engine.js"),
  import("../src/core/engine/modules.js"),
  import("../src/core/engine/commands.js"),
  import("../src/core/engine/context-budget.js"),
  import("../src/core/engine/guardian.js"),
  import("../src/core/engine/lifecycle.js"),
  import("../src/core/engine/output-parser.js"),
  import("../src/core/engine/overlay-store.js"),
  import("../src/core/engine/runtime.js"),
  import("../src/core/data/worldbook.js"),
  import("../src/core/data/world-state.js"),
  import("../src/core/data/organizations.js"),
  import("../src/core/data/characters.js"),
  import("../src/core/data/cognition.js"),
  import("../src/core/data/scenes.js"),
  import("../src/core/data/templates.js"),
  import("../src/core/data/rules.js"),
  import("../src/core/data/timeline.js"),
  import("../src/core/data/random-events.js"),
  import("../src/core/data/prediction.js"),
  import("../src/core/data/character-card.js"),
  import("../src/core/data/processing-engine.js"),
  import("../src/adapters/hermes.js"),
  import("../src/adapters/llm.js"),
  import("../src/adapters/local.js")
]);

console.log("WORLD_TREE_DESKTOP_CHECK PASS");
