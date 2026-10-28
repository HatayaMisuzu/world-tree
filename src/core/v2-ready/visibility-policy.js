// src/core/v2-ready/visibility-policy.js — sole grading source for hidden-info (S4-3 / PRD §6)
// Grades records by `visibility` + optional `knownBy`. Field-name sanitizers remain a second line of defense.
import { isHiddenTruth, VALID_VISIBILITY } from "./universal-metadata.js";

export const POLICY_VISIBILITY = VALID_VISIBILITY;

/** Map legacy / worldbook / strategy labels onto policy visibility grades. */
const GRADE_ALIASES = Object.freeze({
  player_visible: "player_visible",
  public: "player_visible",
  visible: "player_visible",
  exact: "player_visible",
  player_known: "player_visible",
  character_known: "player_visible",
  faction_known: "player_visible",
  gm_only: "gm_only",
  gmOnly: "gm_only",
  hidden: "gm_only",
  private: "gm_only",
  internal: "gm_only",
  partial: "gm_only", // strategy partial ≠ player exact; treat as non-player for grading
  range: "gm_only",
  hint: "gm_only",
  hidden_truth: "hidden_truth",
  hiddenTruth: "hidden_truth",
  secret: "hidden_truth",
  system_only: "system_only",
  systemOnly: "system_only",
  forbidden: "system_only",
  mode_private: "mode_private"
});

const PLAYER_SAFE = new Set(["player_visible"]);

function playerSafety(r) {
  return {
    id: r?.id || "",
    type: r?.type || "",
    visibility: normalizeVisibilityGrade(r),
    knownBy: normalizeKnownBy(r?.knownBy)
  };
}

export function normalizeKnownBy(knownBy) {
  if (!Array.isArray(knownBy)) return [];
  return [...new Set(knownBy.map((id) => String(id || "").trim()).filter(Boolean))].slice(0, 64);
}

/**
 * Normalize a raw visibility label or entry-like object to a policy grade.
 * Default deny grade is gm_only (PRD §6).
 */
export function normalizeVisibilityGrade(input, fallback = "gm_only") {
  if (input && typeof input === "object") {
    if (input.gmOnly === true || input.gm_only === true) return "gm_only";
    if (input.systemOnly === true || input.system_only === true) return "system_only";
    if (input.hiddenTruth === true || input.hidden_truth === true) return "hidden_truth";
    const raw = input.visibility;
    if (raw == null || raw === "") {
      // Legacy injectable worldbook entries without visibility stay player_visible
      // only when explicitly opted in via fallback override; callers may pass "player_visible".
      return fallback === "player_visible" ? "player_visible" : (fallback || "gm_only");
    }
    return GRADE_ALIASES[raw] || (POLICY_VISIBILITY.includes(raw) ? raw : "gm_only");
  }
  if (input == null || input === "") return fallback || "gm_only";
  const raw = String(input);
  return GRADE_ALIASES[raw] || (POLICY_VISIBILITY.includes(raw) ? raw : "gm_only");
}

/** Writer/worldbook path: empty visibility on legacy entries → player_visible (dc-5 / S2). */
export function normalizeWriterVisibility(entry = {}) {
  if (entry.gmOnly === true || entry.gm_only === true) return "gm_only";
  if (entry.systemOnly === true || entry.system_only === true) return "system_only";
  if (entry.hiddenTruth === true || entry.hidden_truth === true) return "hidden_truth";
  const raw = entry.visibility;
  if (raw == null || raw === "") return "player_visible";
  // Writer-specific aliases (keep dc-5 map; strategy "private"≠mode_private stays in GRADE_ALIASES)
  const writerMap = {
    player_visible: "player_visible",
    public: "player_visible",
    player_known: "player_visible",
    character_known: "player_visible",
    faction_known: "player_visible",
    gm_only: "gm_only",
    gmOnly: "gm_only",
    hidden_truth: "hidden_truth",
    hiddenTruth: "hidden_truth",
    secret: "hidden_truth",
    system_only: "system_only",
    systemOnly: "system_only",
    mode_private: "mode_private",
    private: "mode_private",
    forbidden: "system_only"
  };
  if (Object.prototype.hasOwnProperty.call(writerMap, raw)) return writerMap[raw];
  return normalizeVisibilityGrade(raw, "gm_only");
}

function observerAllowed(record, context = {}) {
  const knownBy = normalizeKnownBy(record?.knownBy);
  if (!knownBy.length) return true; // no restriction → visibility alone decides
  const observerId = context.observerId != null ? String(context.observerId) : "";
  if (!observerId) {
    // No observer supplied: knownBy-restricted facts are not broadly player-visible
    return false;
  }
  return knownBy.includes(observerId);
}

/**
 * Sole grading predicate (PRD §6): visibility + knownBy.
 * context: { modeId, observerId, audience? }
 * audience "gm"|"system" may see gm_only; writer/player/director cannot.
 */
export function canExposeToPlayer(record, context = {}) {
  if (!record) return false;
  const vis = normalizeVisibilityGrade(record, "gm_only");
  const audience = String(context.audience || "player");

  if (isHiddenTruth({ visibility: vis }) || vis === "hidden_truth") return false;
  if (vis === "system_only") return false;

  if (vis === "mode_private") {
    const allowed = Array.isArray(record.modeScope) ? record.modeScope : [];
    if (!allowed.includes(context?.modeId)) return false;
    return observerAllowed(record, context);
  }

  if (vis === "gm_only") {
    if (audience === "gm" || audience === "system") return observerAllowed(record, context);
    return false;
  }

  if (vis === "player_visible" || PLAYER_SAFE.has(vis)) {
    return observerAllowed(record, context);
  }

  // unknown visibility: safe default = deny
  return false;
}

export function filterPlayerVisible(records, context = {}) {
  if (!Array.isArray(records)) return [];
  return records.filter((r) => canExposeToPlayer(r, context)).map(playerSafety);
}

export function filterPromptVisible(records, context = {}) {
  // For prompt injection (Writer): same boundaries, full records retained
  if (!Array.isArray(records)) return [];
  const promptContext = { ...context, audience: context.audience || "writer" };
  return records.filter((r) => canExposeToPlayer(r, promptContext));
}

/** Build policy-grade records from tabletop hiddenGmState / gmBook for leak scanning. */
export function hiddenFactsFromGmState(hiddenGmState = {}, gmBook = {}) {
  const facts = [];
  const hiddenTruth = gmBook?.hiddenTruth || "";
  if (hiddenTruth && String(hiddenTruth).length > 3) {
    facts.push({
      id: "gmBook.hiddenTruth",
      type: "hidden_truth",
      visibility: "hidden_truth",
      text: String(hiddenTruth).slice(0, 100),
      source: "gmBook.hiddenTruth"
    });
  }
  const hiddenClocks = hiddenGmState?.hiddenClocks || hiddenGmState?.clocks || [];
  for (const clock of hiddenClocks) {
    if (clock?.label) {
      facts.push({
        id: `hiddenClock:${clock.id || clock.clockId || clock.label}`,
        type: "hidden_clock",
        visibility: "gm_only",
        text: String(clock.label),
        source: `hiddenClock:${clock.id || clock.clockId || ""}`
      });
    }
  }
  const npcSecrets = hiddenGmState?.npcSecrets || {};
  for (const [npcId, secrets] of Object.entries(npcSecrets)) {
    for (const [key, val] of Object.entries(secrets || {})) {
      if (typeof val === "string" && val.length > 5 && key !== "lastUpdated") {
        facts.push({
          id: `npcSecret:${npcId}.${key}`,
          type: "npc_secret",
          visibility: "gm_only",
          knownBy: [npcId],
          text: String(val).slice(0, 80),
          source: `npcSecret:${npcId}.${key}`
        });
      }
    }
  }
  return facts;
}

/** Sensitive terms = facts the player/writer must not see (policy-graded). */
export function collectNonPlayerSensitiveTerms(hiddenGmState = {}, gmBook = {}, context = {}) {
  const facts = hiddenFactsFromGmState(hiddenGmState, gmBook);
  const playerContext = { ...context, audience: "player" };
  return facts
    .filter((fact) => !canExposeToPlayer(fact, playerContext))
    .map((fact) => ({ source: fact.source, text: fact.text, visibility: fact.visibility }));
}

// ── Canary helpers (PRD §6 金丝雀) ──

export function makeCanaryToken(seed = "s4-3", nonce = "") {
  const n = String(nonce || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24);
  return `WT_CANARY_${seed}_${n || "x"}`;
}

export function countCanaryHits(text = "", tokens = []) {
  const body = String(text || "");
  const list = Array.isArray(tokens) ? tokens : [tokens];
  let hits = 0;
  for (const token of list) {
    const t = String(token || "");
    if (!t) continue;
    if (body.includes(t)) hits += 1;
  }
  return hits;
}

export function scanOutputForCanaries(text = "", tokens = []) {
  const list = (Array.isArray(tokens) ? tokens : [tokens]).map(String).filter(Boolean);
  const hits = list.filter((token) => String(text || "").includes(token));
  return { ok: hits.length === 0, hits };
}

/**
 * Output-side block: redact canary / sensitive term hits.
 * Used by tabletop scanForHiddenLeaks (unified call site).
 */
export function redactHiddenLeaks(narration = "", sensitiveTerms = [], canaryTokens = []) {
  const leaks = [];
  let sanitized = String(narration || "");
  for (const term of sensitiveTerms) {
    const text = term?.text || term;
    if (!text || String(text).length < 1) continue;
    if (sanitized.includes(text)) {
      leaks.push(term.source || "sensitive");
      const escaped = String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      sanitized = sanitized.replace(new RegExp(escaped, "g"), "【已隐藏】");
    }
  }
  const canary = scanOutputForCanaries(sanitized, canaryTokens);
  for (const token of canary.hits) {
    leaks.push(`canary:${token}`);
    const escaped = String(token).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    sanitized = sanitized.replace(new RegExp(escaped, "g"), "【已隐藏】");
  }
  return {
    leaks,
    sanitizedNarration: leaks.length > 0 ? sanitized : String(narration || ""),
    canaryHits: canary.hits
  };
}

/**
 * Build a proposal-bus shaped payload to promote/reveal a fact (no direct Canon write).
 * Callers must submit via proposal-bus.createProposal — this only shapes the change.
 */
export function buildVisibilityRevealProposalInput(record = {}, options = {}) {
  const id = record.id || options.recordId || "";
  const fromVisibility = normalizeVisibilityGrade(record, "gm_only");
  const toVisibility = options.toVisibility || "player_visible";
  const observerId = options.observerId || "player";
  const knownBy = normalizeKnownBy([
    ...normalizeKnownBy(record.knownBy),
    observerId,
    ...(Array.isArray(options.addKnownBy) ? options.addKnownBy : [])
  ]);
  return {
    type: "visibility_reveal",
    summary: options.summary || `Reveal ${id || "fact"} → ${toVisibility}`,
    impactLevel: options.impactLevel || "major",
    requiresUserApproval: true,
    patch: {
      recordId: id,
      fromVisibility,
      toVisibility,
      knownBy
    },
    metadata: {
      kind: "visibility_reveal",
      recordId: id,
      fromVisibility,
      toVisibility
    }
  };
}
