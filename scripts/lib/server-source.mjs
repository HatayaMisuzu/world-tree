import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export const SERVER_RUNTIME_FILES = Object.freeze([
  "server.js",
  "src/server/config-runtime.js",
  "src/server/connection-runtime.js",
  "src/server/static-shell.js",
  "src/server/http-api-router.js",
  "src/server/debug-log.js",
  "src/server/v2-product-playable-routes.js",
  "src/server/tabletop-v2-routes.js",
  "src/server/detective-v2-routes.js",
  "src/server/character-v2-routes.js",
  "src/server/single-player-scriptkill-v2-routes.js"
]);

export function readServerSource(root = process.cwd()) {
  return SERVER_RUNTIME_FILES.map(file => {
    const path = resolve(root, file);
    return existsSync(path) ? `\n/* ${file} */\n${readFileSync(path, "utf8")}` : "";
  }).join("\n");
}
