export async function handleV2ProductPlayableRoute({ path, method, url, readBody, jsonResponse, jsonError, deps }) {
  const routeArgs = { path, method, url, readBody, jsonResponse, jsonError, deps };
  if (path.startsWith("/api/worldbook-v2/")) {
    const service = await import("./worldbook-v2-product-service.js");
    return service.handleWorldbookV2ProductRoute(routeArgs);
  }
  if (path.startsWith("/api/strategy-sim-v2/")) {
    const service = await import("./strategy-sim-v2-product-service.js");
    return service.handleStrategySimV2ProductRoute(routeArgs);
  }
  return false;
}
