import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export const BROWSER_SCRIPT_FILES = Object.freeze([
  "browser/app/product-registry.js",
  "browser/app/navigation.js",
  "browser/state/app-store.js",
  "browser/components/feedback.js",
  "browser/components/forms.js",
  "browser/components/product-components.js",
  "browser/views/core-views.js",
  "browser/views/creation-settings-views.js",
  "browser/controllers/navigation-controller.js",
  "browser/controllers/entry-controller.js",
  "browser/controllers/play-controller.js",
  "browser/controllers/content-controller.js",
  "browser/controllers/settings-controller.js",
  "browser/controllers/character-v2-controller.js",
  "world-tree-console.js",
  "world-tree-client-core.js"
]);

export function readBrowserSource(root = process.cwd()) {
  return BROWSER_SCRIPT_FILES.map(file => {
    const path = resolve(root, file);
    return existsSync(path) ? `\n/* ${file} */\n${readFileSync(path, "utf8")}` : "";
  }).join("\n");
}
