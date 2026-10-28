// ===== World scope (S2 ③) =====
// Engine state that used to live in process-level singletons (memory-layers, relations,
// proposal-system, director prediction cache / decision log, random-events cache, id counters)
// now lives in a per-world scope object. The active scope is carried by AsyncLocalStorage,
// so two worlds can run turns concurrently/interleaved without sharing state.
// Outside any scope (unit tests, legacy callers) a single default scope is used — this keeps
// the old module APIs working unchanged.
import { AsyncLocalStorage } from "node:async_hooks";

const STORAGE = new AsyncLocalStorage();
export const DEFAULT_SCOPE_KEY = "__default__";

export function createWorldScope(key = DEFAULT_SCOPE_KEY) {
  return { key: String(key || DEFAULT_SCOPE_KEY), slots: Object.create(null) };
}

const DEFAULT_SCOPE = createWorldScope(DEFAULT_SCOPE_KEY);

export function currentWorldScope() {
  return STORAGE.getStore() || DEFAULT_SCOPE;
}

/** Run fn (sync or async) with `scope` as the active world scope for everything it awaits. */
export function runInWorldScope(scope, fn) {
  return STORAGE.run(scope || DEFAULT_SCOPE, fn);
}

/** Per-scope slot, lazily created by `init()` the first time a scope touches it. */
export function scopeSlot(name, init) {
  const scope = currentWorldScope();
  if (!(name in scope.slots)) scope.slots[name] = init();
  return scope.slots[name];
}

/**
 * A stable object handle whose properties live in the active scope's slot.
 * Lets existing module code keep writing `STORE.x` / `STORE.x = …` while the
 * backing object is per-world. Methods (e.g. Map#get) are bound to the backing object.
 */
export function scopedObject(name, init) {
  const target = () => scopeSlot(name, init);
  return new Proxy(Object.create(null), {
    get(_t, prop) { const o = target(); const v = o[prop]; return typeof v === "function" ? v.bind(o) : v; },
    set(_t, prop, value) { target()[prop] = value; return true; },
    has(_t, prop) { return prop in target(); },
    deleteProperty(_t, prop) { return delete target()[prop]; },
    ownKeys() { return Reflect.ownKeys(target()); },
    getOwnPropertyDescriptor(_t, prop) {
      const d = Reflect.getOwnPropertyDescriptor(target(), prop);
      if (d) d.configurable = true;
      return d;
    }
  });
}
