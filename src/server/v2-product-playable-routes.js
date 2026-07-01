export const V2_PRODUCT_ROUTE_PREFIXES = Object.freeze([
  "/api/worldbook-v2/",
  "/api/strategy-sim-v2/",
  "/api/tabletop-v2/",
  "/api/detective-v2/",
  "/api/single-player-scriptkill-v2/",
  "/api/characters/v2/"
]);

const ROUTE_LOADERS = [
  {
    prefix: "/api/worldbook-v2/",
    load: async () => import("./worldbook-v2-product-service.js"),
    handleName: "handleWorldbookV2ProductRoute"
  },
  {
    prefix: "/api/strategy-sim-v2/",
    load: async () => import("./strategy-sim-v2-product-service.js"),
    handleName: "handleStrategySimV2ProductRoute"
  },
  {
    prefix: "/api/tabletop-v2/",
    load: async () => import("./tabletop-v2-routes.js"),
    handleName: "handleTabletopV2ProductRoute"
  },
  {
    prefix: "/api/detective-v2/",
    load: async () => import("./detective-v2-routes.js"),
    handleName: "handleDetectiveV2ProductRoute"
  },
  {
    prefix: "/api/single-player-scriptkill-v2/",
    load: async () => import("./single-player-scriptkill-v2-routes.js"),
    handleName: "handleSinglePlayerScriptKillV2ProductRoute"
  },
  {
    prefix: "/api/characters/v2/",
    load: async () => import("./character-v2-routes.js"),
    handleName: "handleCharacterV2ProductRoute"
  }
];

export async function handleV2ProductPlayableRoute(routeArgs) {
  const { path } = routeArgs;
  const matched = ROUTE_LOADERS.find((item) => path.startsWith(item.prefix));
  if (!matched) return false;
  const module = await matched.load();
  const handler = module[matched.handleName];
  if (typeof handler !== "function") {
    throw new Error(`V2 product route handler missing: ${matched.handleName}`);
  }
  return handler(routeArgs);
}
