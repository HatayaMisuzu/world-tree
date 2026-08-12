import { existsSync } from "node:fs";
import { join } from "node:path";
import { appendJsonl, ensureDir, readJsonSync, readJsonlTail, withFileLock, writeJson } from "./fs-utils.js";
import { normalizeWorldbookCandidate, normalizeWorldbookEntry, validateWorldbookEntry } from "../core/worldbook-v2/worldbook-entry-schema.js";
import { prepareWorldbookV2Injection } from "../core/worldbook-v2/worldbook-runtime.js";

const PUBLIC_VISIBILITIES = new Set(["public", "player_known", "character_known", "faction_known"]);

export function createWorldbookV2ProductService({ dataRoot, moduleWorldDir, pathWithinRoot } = {}) {
  function resolveWorld(moduleKey = "") {
    const root = typeof dataRoot === "function" ? dataRoot() : dataRoot;
    const worldDir = moduleWorldDir?.(moduleKey);
    if (!root || !worldDir || !pathWithinRoot?.(root, worldDir) || !existsSync(worldDir)) return null;
    return { moduleKey, worldDir, sharedDir: join(worldDir, "shared"), runtimeDir: join(worldDir, "runtime"), v2Dir: join(worldDir, "runtime", "worldbook-v2") };
  }

  function readEntries(ctx) {
    const legacy = readJsonSync(join(ctx.sharedDir, "worldbook.json"), { entries: [] });
    return (Array.isArray(legacy.entries) ? legacy.entries : []).map((entry) => normalizeWorldbookEntry(entry, { worldId: ctx.moduleKey }));
  }

  async function readEffectiveCandidates(ctx, limit = 200) {
    const [candidates, decisions] = await Promise.all([
      readJsonlTail(join(ctx.v2Dir, "candidates.jsonl"), limit),
      readJsonlTail(join(ctx.v2Dir, "candidate-decisions.jsonl"), Math.max(limit, 500))
    ]);
    const latest = new Map();
    for (const record of decisions) latest.set(record.candidateId, record);
    return candidates.map((candidate) => {
      const record = latest.get(candidate.candidateId || candidate.id);
      return { ...candidate, status: record ? (record.decision === "adopt" ? "adopted" : "rejected") : "pending" };
    });
  }

  async function load({ moduleKey } = {}) {
    const ctx = resolveWorld(moduleKey);
    if (!ctx) return { status: "error", code: "MODULE_NOT_FOUND", errorMsg: "Select a valid world." };
    ensureDir(ctx.v2Dir);
    return {
      status: "ok", moduleKey, entries: readEntries(ctx), candidates: await readEffectiveCandidates(ctx, 200),
      storage: { canon: "shared/worldbook.json", candidates: "runtime/worldbook-v2/candidates.jsonl", usageLog: "runtime/worldbook-v2/usage-log.jsonl" }
    };
  }

  async function save({ moduleKey, entries = [] } = {}) {
    const ctx = resolveWorld(moduleKey);
    if (!ctx) return { status: "error", code: "MODULE_NOT_FOUND", errorMsg: "Select a valid world." };
    ensureDir(ctx.sharedDir);
    if (!Array.isArray(entries)) return { status: "error", code: "WORLDBOOK_ENTRIES_REQUIRED", errorMsg: "Worldbook entries must be an array." };
    if (entries.length > 2000) return { status: "error", code: "WORLDBOOK_TOO_MANY_ENTRIES", errorMsg: "Worldbook has too many entries." };
    const checks = entries.map((entry) => validateWorldbookEntry({ ...entry, authority: entry.authority || "canon" }));
    const invalid = checks.map((check, index) => ({ index, errors: check.errors })).filter((item) => item.errors.length);
    if (invalid.length) return { status: "error", code: "WORLDBOOK_ENTRY_INVALID", errorMsg: `${invalid.length} entries are invalid.`, invalid };
    const safeEntries = checks.map((check) => normalizeWorldbookEntry(check.normalized, { worldId: moduleKey }));
    await writeJson(join(ctx.sharedDir, "worldbook.json"), { entries: safeEntries });
    return { status: "ok", moduleKey, entries: safeEntries };
  }

  async function createCandidate({ moduleKey, candidate = {}, entry = {} } = {}) {
    const ctx = resolveWorld(moduleKey);
    if (!ctx) return { status: "error", code: "MODULE_NOT_FOUND", errorMsg: "Select a valid world." };
    ensureDir(ctx.v2Dir);
    const item = { ...normalizeWorldbookCandidate({ ...candidate, entry: candidate.entry || entry, worldId: moduleKey }), status: "pending", createdAt: new Date().toISOString() };
    await appendJsonl(join(ctx.v2Dir, "candidates.jsonl"), item);
    return { status: "ok", moduleKey, candidate: item };
  }

  async function listCandidates({ moduleKey } = {}) {
    const ctx = resolveWorld(moduleKey);
    if (!ctx) return { status: "error", code: "MODULE_NOT_FOUND", errorMsg: "Select a valid world." };
    ensureDir(ctx.v2Dir);
    return { status: "ok", moduleKey, candidates: await readEffectiveCandidates(ctx, 200) };
  }

  async function decideCandidate({ moduleKey, candidateId, decision = "reject" } = {}) {
    const ctx = resolveWorld(moduleKey);
    if (!ctx) return { status: "error", code: "MODULE_NOT_FOUND", errorMsg: "Select a valid world." };
    const adopted = ["adopt", "confirm", "confirmed"].includes(decision);
    const normalizedDecision = adopted ? "adopt" : "reject";
    return withFileLock(join(ctx.v2Dir, ".candidate-decision.lock"), async () => {
      const candidates = await readJsonlTail(join(ctx.v2Dir, "candidates.jsonl"), 500);
      const candidate = candidates.find((item) => item.candidateId === candidateId || item.id === candidateId);
      if (!candidate) return { status: "error", code: "CANDIDATE_NOT_FOUND", errorMsg: "Candidate does not exist." };
      const decisions = await readJsonlTail(join(ctx.v2Dir, "candidate-decisions.jsonl"), 500);
      const existing = decisions.filter((item) => item.candidateId === candidateId).at(-1);
      if (existing) {
        if (existing.decision !== normalizedDecision) return { status: "error", code: "CANDIDATE_ALREADY_DECIDED", errorMsg: "Candidate already has the opposite terminal decision." };
        return { status: "ok", moduleKey, decision: existing, canonMutated: false, alreadyDecided: true };
      }
      if (adopted) {
        const entries = readEntries(ctx);
        const draft = normalizeWorldbookEntry({ ...candidate.draftEntry, authority: "canon" }, { worldId: moduleKey });
        const next = entries.filter((entry) => entry.entryId !== draft.entryId && entry.id !== draft.id);
        next.push(draft);
        await writeJson(join(ctx.sharedDir, "worldbook.json"), { entries: next });
      }
      const record = { candidateId, decision: normalizedDecision, decidedAt: new Date().toISOString() };
      await appendJsonl(join(ctx.v2Dir, "candidate-decisions.jsonl"), record);
      return { status: "ok", moduleKey, decision: record, canonMutated: adopted, alreadyDecided: false };
    });
  }

  async function injectPreview({ moduleKey, userInput = "", input = "" } = {}) {
    const ctx = resolveWorld(moduleKey);
    if (!ctx) return { status: "error", code: "MODULE_NOT_FOUND", errorMsg: "Select a valid world." };
    const result = prepareWorldbookV2Injection({ entries: readEntries(ctx), input: userInput || input, worldId: moduleKey, audience: "player" });
    ensureDir(ctx.v2Dir);
    await appendJsonl(join(ctx.v2Dir, "usage-log.jsonl"), result.usageRecord);
    return { status: "ok", moduleKey, injectedWorldbook: result.injectedWorldbook.filter((entry) => PUBLIC_VISIBILITIES.has(entry.visibility)), diagnostics: result.diagnostics };
  }

  async function exportState({ moduleKey } = {}) {
    const loaded = await load({ moduleKey });
    if (loaded.status !== "ok") return loaded;
    return {
      status: "ok", moduleKey,
      export: {
        schema: "worldbook-v2-product-export",
        entries: loaded.entries.filter((entry) => PUBLIC_VISIBILITIES.has(entry.visibility)),
        candidates: loaded.candidates.map((item) => ({ candidateId: item.candidateId, status: item.status, visibility: item.visibility })),
        storage: loaded.storage
      }
    };
  }

  return { load, save, createCandidate, listCandidates, decideCandidate, injectPreview, exportState };
}

export async function handleWorldbookV2ProductRoute({ path, method, url, readBody, jsonResponse, deps }) {
  const service = createWorldbookV2ProductService(deps);
  if (path === "/api/worldbook-v2/load" && method === "GET") return jsonResponse(await service.load({ moduleKey: url.searchParams.get("moduleKey") || "" }));
  if (path === "/api/worldbook-v2/save" && method === "POST") return jsonResponse(await service.save(await readBody()));
  if (path === "/api/worldbook-v2/candidates/create" && method === "POST") return jsonResponse(await service.createCandidate(await readBody()));
  if (path === "/api/worldbook-v2/candidates" && method === "GET") return jsonResponse(await service.listCandidates({ moduleKey: url.searchParams.get("moduleKey") || "" }));
  if (path === "/api/worldbook-v2/candidates/decision" && method === "POST") return jsonResponse(await service.decideCandidate(await readBody()));
  if (path === "/api/worldbook-v2/inject-preview" && method === "POST") return jsonResponse(await service.injectPreview(await readBody()));
  if (path === "/api/worldbook-v2/export" && method === "POST") return jsonResponse(await service.exportState(await readBody()));
  return false;
}
