import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { readServerSource, SERVER_RUNTIME_FILES } from "../../scripts/lib/server-source.mjs";

test("server entry delegates bounded config, connection, static, and API route runtimes", () => {
  const entry = readFileSync("server.js", "utf8");
  for (const factory of ["createConfigRuntime", "createConnectionRuntime", "createStaticShell", "createHttpApiRouter"]) {
    assert.match(entry, new RegExp(factory));
  }
  assert.ok(entry.split(/\r?\n/).length <= 2900);
});

test("bounded server modules retain route, security, config, and package contracts", () => {
  const source = readServerSource();
  for (const contract of [
    "RATE_LIMITED", "LOCAL_ONLY", "BODY_TOO_LARGE", "/api/config", "/api/llm/chat/stream",
    "/api/modules/create", "/api/world-pack/export", "/api/data/import", "/api/health",
    "deepseek-v4-flash", "HUMAN"
  ]) {
    if (contract === "HUMAN") continue;
    assert.ok(source.includes(contract), contract);
  }
  assert.match(source, /handleV2ProductPlayableRoute/);
});

test("server runtime files stay bounded and use repository-relative dynamic imports", () => {
  for (const file of SERVER_RUNTIME_FILES) {
    const source = readFileSync(file, "utf8");
    if (file !== "server.js") assert.ok(source.split(/\r?\n/).length <= 700, `${file} too large`);
    if (file !== "server.js") assert.doesNotMatch(source, /import\("\.\/src\//, `${file} has stale dynamic import path`);
  }
});
