export function createRouteRegistry(routes = []) {
  const table = new Map();
  for (const route of routes) registerRoute(table, route);
  return {
    register(route) {
      registerRoute(table, route);
      return this;
    },
    resolve(method = "", path = "") {
      return table.get(routeKey(method, path)) || null;
    },
    list() {
      return [...table.values()].map(({ method, path, domain }) => ({ method, path, domain }));
    }
  };
}

function registerRoute(table, route = {}) {
  const method = String(route.method || "").toUpperCase();
  const path = String(route.path || "");
  if (!method || !path || typeof route.handler !== "function") {
    throw new Error("route requires method, path, and handler");
  }
  const key = routeKey(method, path);
  if (table.has(key)) throw new Error(`duplicate route: ${method} ${path}`);
  table.set(key, { ...route, method, path, domain: route.domain || "misc" });
}

function routeKey(method = "", path = "") {
  return `${String(method || "").toUpperCase()} ${String(path || "")}`;
}
