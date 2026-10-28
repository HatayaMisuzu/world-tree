import { importEngineState, resetEngineState } from "./state-persistence.js";
import { createWorldScope, runInWorldScope } from "./world-scope.js";

export const DEFAULT_WORLD_SESSION_KEY = "__default__";

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
    // S2 ③: this world's engine state (memory/relations/proposals/director/events) lives here,
    // not in process-level singletons. Turns of different worlds may interleave freely.
    this.scope = createWorldScope(this.moduleKey);
    this.restoredThisTurn = false;
  }

  /** Run fn inside this world's scope (no queueing). */
  inScope(fn) {
    return runInWorldScope(this.scope, fn);
  }

  runTurn(fn) {
    const run = this.turnQueue.catch(() => {}).then(() => this.inScope(async () => {
      this.restoredThisTurn = false;
      try { return await fn(this); } finally { this.restoredThisTurn = false; }
    }));
    this.turnQueue = run.catch(() => {});
    return run;
  }

  restore(snapshot = null) {
    return this.inScope(() => this.#restoreInScope(snapshot));
  }

  /**
   * S2 ④: restore the world's snapshot at the START of the turn, before the director runs,
   * so the director reads this world's state and its decisions survive into the exported snapshot.
   */
  beginTurn(snapshot = null) {
    const restore = this.restore(snapshot);
    this.restoredThisTurn = true;
    return restore;
  }

  #restoreInScope(snapshot) {
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
    return this.inScope(async () => {
      // If beginTurn() already restored this turn, do not restore again: that would discard the
      // director's decisions made earlier in the same turn.
      const restore = this.restoredThisTurn ? this.lastRestore : this.#restoreInScope(snapshot);
      const result = await fn(restore);
      const exported = result?.overlayPatch?._engineState || null;
      if (exported?.version) this.snapshot = exported;
      return { result, restore };
    });
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
