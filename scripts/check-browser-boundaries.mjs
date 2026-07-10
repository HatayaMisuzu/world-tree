import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

import { BROWSER_SCRIPT_FILES } from "./lib/browser-source.mjs";

const errors = [];
for (const file of BROWSER_SCRIPT_FILES) {
  if (!existsSync(file)) {
    errors.push(`missing browser script: ${file}`);
    continue;
  }
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8", shell: process.platform === "win32" });
  if (result.status !== 0) errors.push(`${file}: ${result.stderr || result.stdout}`);
  const lines = readFileSync(file, "utf8").split(/\r?\n/).length;
  if (file !== "world-tree-client-core.js" && lines > 700) errors.push(`${file}: ${lines} lines exceeds browser module limit 700`);
}

if (errors.length) {
  console.error(`[browser:check] FAIL\n${errors.join("\n")}`);
  process.exit(1);
}
console.log(`[browser:check] PASS ${BROWSER_SCRIPT_FILES.length} scripts`);
