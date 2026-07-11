// Compatibility facade. Shared persistence primitives are intentionally below
// both core and server layers so domain modules never depend on server code.
export * from "../shared/fs-utils.js";
