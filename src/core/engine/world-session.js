import { importEngineState, resetEngineState } from "./state-persistence.js";

export const DEFAULT_WORLD_SESSION_KEY = "__default__";

let globalFinalizeQueue = Promise.resolve();

function normalizeSessionKey(moduleKey = "") {
  const raw = String(moduleKey || "").trim();
  return raw || DEFAULT_WORLD_SESSION_KEY;
}

export class WorldSession {
  constructor(moduleKey = DEFAULT_WORLD_SESSION_KEY) {
    this.moduleKey = normalizeSessionKey(moduleKey);
    this.deprecatedDefault = this.moduleKey === DEFAULT_WORLD_SESSION_KEY;
    this.turnQueue = Promise.resolve();
    this.snapshot = null;
    this.lastRestore = { ok: true, warning: null };
  }

  runTurn(fn) {
    const run = this.turnQueue.catch(() => {}).then(() => fn(this));
    this.turnQueue = run.catch(() => {});
    return run;
  }

  restore(snapshot = null) {
    resetEngineState();
    const source = snapshot || this.snapshot;
    if (!source) {
      this.snapshot = null;
      this.lastRestore = { ok: true, warning: null, fresh: true };
      return this.lastRestore;
    }
    if (!source.version) {
      this.snapshot = null;
      this.lastRestore = {
        ok: false,
        fresh: true,
        warning: {
          code: "WORLD_SESSION_SNAPSHOT_INVALID",
          message: "Engine snapshot missing version; session reset to fresh state.",
          moduleKey: this.moduleKey
        }
      };
      return this.lastRestore;
    }
    try {
      const runtime = importEngineState(source);
      this.snapshot = source;
      this.lastRestore = { ok: true, warning: null, runtime };
      return this.lastRestore;
    } catch (err) {
      resetEngineState();
      this.snapshot = null;
      this.lastRestore = {
        ok: false,
        fresh: true,
        warning: {
          code: "WORLD_SESSION_SNAPSHOT_RESTORE_FAILED",
          message: err?.message || String(err),
          moduleKey: this.moduleKey
        }
      };
      return this.lastRestore;
    }
  }

  async finalizeWithSnapshot(snapshot, fn) {
    const previous = globalFinalizeQueue.catch(() => {});
    const run = previous.then(async () => {
      const restore = this.restore(snapshot);
      const result = await fn(restore);
      const exported = result?.overlayPatch?._engineState || null;
      if (exported?.version) this.snapshot = exported;
      return { result, restore };
    });
    globalFinalizeQueue = run.catch(() => {});
    return run;
  }
}

export class SessionRegistry {
  constructor() {
    this.sessions = new Map();
  }

  get(moduleKey = DEFAULT_WORLD_SESSION_KEY) {
    const key = normalizeSessionKey(moduleKey);
    if (!this.sessions.has(key)) this.sessions.set(key, new WorldSession(key));
    return this.sessions.get(key);
  }

  clear(moduleKey = "") {
    if (moduleKey) {
      this.sessions.delete(normalizeSessionKey(moduleKey));
      return;
    }
    this.sessions.clear();
  }

  list() {
    return [...this.sessions.values()].map((session) => ({
      moduleKey: session.moduleKey,
      deprecatedDefault: session.deprecatedDefault,
      hasSnapshot: Boolean(session.snapshot),
      lastRestore: session.lastRestore
    }));
  }
}

const REGISTRY = new SessionRegistry();

export function getWorldSessionRegistry() {
  return REGISTRY;
}

export function getWorldSession(moduleKey = DEFAULT_WORLD_SESSION_KEY) {
  return REGISTRY.get(moduleKey);
}
