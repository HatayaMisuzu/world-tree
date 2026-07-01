import test from "node:test";
import assert from "node:assert/strict";
import {
  V2_PRODUCT_ROUTE_PREFIXES,
  handleV2ProductPlayableRoute
} from "../../src/server/v2-product-playable-routes.js";

test("V2 route registry covers canonical V2 product route prefixes", () => {
  assert.ok(V2_PRODUCT_ROUTE_PREFIXES.includes("/api/worldbook-v2/"));
  assert.ok(V2_PRODUCT_ROUTE_PREFIXES.includes("/api/strategy-sim-v2/"));
  assert.ok(V2_PRODUCT_ROUTE_PREFIXES.includes("/api/tabletop-v2/"));
  assert.ok(V2_PRODUCT_ROUTE_PREFIXES.includes("/api/detective-v2/"));
  assert.ok(V2_PRODUCT_ROUTE_PREFIXES.includes("/api/single-player-scriptkill-v2/"));
  assert.ok(V2_PRODUCT_ROUTE_PREFIXES.includes("/api/characters/v2/"));
});

test("V2 route registry returns false for non-V2 routes", async () => {
  const result = await handleV2ProductPlayableRoute({
    path: "/api/health",
    method: "GET",
    url: new URL("http://localhost/api/health"),
    readBody: async () => ({}),
    jsonResponse: (payload) => payload,
    jsonError: () => ({ status: "error" }),
    deps: {}
  });
  assert.equal(result, false);
});
