import test from "node:test";
import assert from "node:assert/strict";

import {
  api,
  createTempDataDir,
  removeTempDir,
  startWorldTreeServer
} from "./helpers/server-process.js";

function assertSecurityHeaders(response) {
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.match(response.headers.get("permissions-policy") || "", /camera=\(\)/);
  const csp = response.headers.get("content-security-policy") || "";
  assert.match(csp, /frame-ancestors 'none'/);
  assert.doesNotMatch(csp, /unsafe-eval/);
}

test("HTML, static assets, JSON APIs, and errors share security headers without changing MIME types", async () => {
  const dataDir = await createTempDataDir();
  const server = await startWorldTreeServer({ dataDir });
  try {
    const html = await fetch(`${server.baseUrl}/`);
    assert.equal(html.status, 200);
    assert.match(html.headers.get("content-type") || "", /^text\/html/);
    assertSecurityHeaders(html);

    const script = await fetch(`${server.baseUrl}/world-tree-client-core.js`);
    assert.equal(script.status, 200);
    assert.match(script.headers.get("content-type") || "", /javascript/);
    assertSecurityHeaders(script);

    const status = await api(server, "/api/status");
    assert.equal(status.status, 200);
    assert.match(status.response.headers.get("content-type") || "", /^application\/json/);
    assertSecurityHeaders(status.response);

    const missing = await fetch(`${server.baseUrl}/missing.js`);
    assert.equal(missing.status, 404);
    assert.match(missing.headers.get("content-type") || "", /^application\/json/);
    assertSecurityHeaders(missing);
  } finally {
    await server.stop();
    await removeTempDir(dataDir);
  }
});
