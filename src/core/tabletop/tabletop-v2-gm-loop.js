// Tabletop V2 GM Loop Orchestration
// Each player turn follows a fixed 10-step loop.
// LLM is only used for narration polish, never for ruling/dice/state changes.

import { classifyPlayerIntent, createRulingRequest, resolveRulingWithoutLlm, buildGmNarrationPacket, buildDeterministicGmTurnText } from "./tabletop-v2-turn-ruling.js";
import { validatePlayerIntentAgainstBook } from "./tabletop-v2-adventure-module.js";
import { applyTabletopTurnConsequences, updateSceneTransition } from "./tabletop-v2-state-mutation.js";
import { recordTurn, stripHiddenState } from "./tabletop-v2-save-branch.js";

// ── GM Loop step enum ──

export const GM_LOOP_STEPS = [
  "classify_intent",
  "validate_against_book",
  "determine_roll",
  "execute_roll",
  "apply_state_mutation",
  "build_narration_packet",
  "optional_llm_polish",
  "hidden_leak_scan",
  "persist_state",
  "return_player_view",
];

// ── Main loop ──

export async function executeTabletopGmLoop({
  module,
  runState,
  playerIntent,
  llmClient = null,         // optional LLM client for narration polish
  deps = {},
} = {}) {
  const loopLog = [];
  let state = structuredClone(runState);
  let playerView = null;
  let error = null;

  const log = (step, detail) => loopLog.push({ step, ...detail, at: new Date().toISOString() });

  try {
    // Step 1: Classify intent
    const classification = classifyPlayerIntent(playerIntent);
    log("classify_intent", { classification });

    if (!classification || classification === "unknown") {
      return finalize(state, {
        status: "blocked",
        code: "UNKNOWN_INTENT",
        playerNarrative: "（请更清楚地描述你想做什么。）",
        loopLog,
      });
    }

    // Step 2: Validate against adventure book
    const rulingRequest = createRulingRequest({ module, runState: state, playerIntent });
    if (rulingRequest.error) {
      return finalize(state, {
        status: "blocked",
        code: "RULING_REQUEST_FAILED",
        playerNarrative: rulingRequest.error,
        loopLog,
      });
    }

    const bookCheck = validatePlayerIntentAgainstBook({
      module,
      scene: rulingRequest.scene,
      runState: state,
      intent: playerIntent,
      classification: rulingRequest.classification,
    });
    log("validate_against_book", { allowed: bookCheck.allowed, reason: bookCheck.reason });

    if (!bookCheck.allowed) {
      return finalize(state, {
        status: bookCheck.severity === "warn" ? "warned" : "blocked_by_book",
        code: bookCheck.severity === "warn" ? "ACTION_WARNED" : "ACTION_BLOCKED",
        bookCheck: { reason: bookCheck.reason, suggestion: bookCheck.suggestion, severity: bookCheck.severity },
        playerNarrative: bookCheck.reason || "这个行动在当前规则下不被允许。",
        loopLog,
      });
    }

    // Step 3: Determine if roll needed
    const needsRoll = rulingRequest.classification !== "knowledge" && rulingRequest.classification !== "observation";
    log("determine_roll", { needsRoll, classification: rulingRequest.classification });

    // Step 4: Execute roll (deterministic, no LLM)
    const ruling = resolveRulingWithoutLlm(rulingRequest);
    log("execute_roll", {
      rollOutcome: ruling.roll?.outcome,
      noRoll: ruling.noRoll,
      consequences: ruling.consequences?.length || 0,
    });

    // Step 5: Apply deterministic state mutation
    const { runState: mutatedState, applied } = applyTabletopTurnConsequences({
      module,
      runState: state,
      ruling,
      playerIntent,
    });
    state = mutatedState;
    log("apply_state_mutation", { applied: applied.map((a) => a.type) });

    // Step 6: Build GM narration packet
    const narrationPacket = buildDeterministicGmTurnText
      ? buildDeterministicGmTurnText({ request: rulingRequest, ruling, bookCheck, module, scene: rulingRequest.scene })
      : buildFallbackNarration(ruling, bookCheck);
    log("build_narration_packet", { length: narrationPacket?.length || 0 });

    // Step 7: Optional LLM polish (under guardrails)
    let finalNarration = narrationPacket;
    if (llmClient && typeof llmClient.polish === "function") {
      try {
        const polished = await llmClient.polish({
          deterministicText: narrationPacket,
          namespace: state.runtimeIsolation?.llmNamespace || "tabletop-v2:llm",
          publicContext: {
            sceneTitle: state.publicState?.sceneTitle || "",
            turnIndex: state.turnIndex || 0,
          },
          constraints: {
            noReroll: true,
            noStateChange: true,
            noHiddenReveal: true,
            maxTokens: 200,
          },
        });
        if (polished && typeof polished === "string") {
          finalNarration = polished;
          log("optional_llm_polish", { polished: true });
        }
      } catch {
        log("optional_llm_polish", { polished: false, reason: "LLM call failed, using deterministic" });
      }
    }

    // Step 8: Hidden leak scan
    const leakScan = scanForHiddenLeaks(finalNarration, state.hiddenGmState, module?.gmBook);
    log("hidden_leak_scan", { leaks: leakScan.leaks });

    if (leakScan.leaks) {
      // Strip leaked content
      finalNarration = leakScan.sanitizedNarration || finalNarration;
    }

    // Step 9: Persist state (record turn)
    const turnRecord = {
      roll: ruling.roll,
      publicStateUpdate: {
        lastNarrative: finalNarration,
        diceLogPublic: state.publicState?.diceLogPublic || [],
      },
      reviewCandidates: ruling.consequences?.some((c) => c.type === "setback" || c.type === "bonus")
        ? [{ type: "major_turn", description: `${ruling.classification}: ${ruling.roll?.outcome || "no roll"}` }]
        : [],
    };

    if (ruling.roll && ruling.roll.visibility !== "hidden") {
      turnRecord.publicStateUpdate.diceLogPublic = [
        ...(state.publicState?.diceLogPublic || []),
        {
          expression: ruling.roll.expression,
          total: ruling.roll.total,
          outcome: ruling.roll.outcome,
        },
      ];
    }

    state = recordTurn(state, turnRecord);
    log("persist_state", { turnIndex: state.turnIndex });

    // Step 10: Return player-safe view
    playerView = {
      status: "ok",
      narrative: finalNarration,
      ruling: {
        classification: ruling.classification,
        consequences: ruling.consequences || [],
        roll: ruling.roll?.visibility === "hidden"
          ? { expression: "暗骰", total: null, outcome: "暗骰已记录" }
          : ruling.roll,
      },
      sceneTitle: state.publicState?.sceneTitle || "",
      publicClocks: state.publicState?.publicClocks || state.publicState?.clocks || [],
      resources: state.publicState?.resources || {},
      questLog: state.publicState?.questLog || [],
    };

    return finalize(state, { ...playerView, loopLog });
  } catch (err) {
    error = { message: err.message, step: loopLog.length > 0 ? loopLog[loopLog.length - 1].step : "unknown" };
    log("error", { message: err.message });
    return finalize(state, {
      status: "error",
      code: "GM_LOOP_ERROR",
      playerNarrative: "（GM 循环出现故障，请尝试其他行动或重新开始。）",
      error,
      loopLog,
    });
  }
}

function finalize(state, result) {
  return { runState: stripHiddenState(state), fullState: state, ...result };
}

// ── Narration fallback ──

function buildFallbackNarration(ruling, bookCheck) {
  const outcome = ruling.roll?.outcome || "success";
  const parts = [];
  if (ruling.roll && ruling.roll.visibility !== "hidden") {
    parts.push(`掷骰 ${ruling.roll.expression} = ${ruling.roll.total}（${outcome}）`);
  }
  if (bookCheck?.suggestion) parts.push(bookCheck.suggestion);
  if (ruling.consequences?.length) {
    parts.push(ruling.consequences.map((c) => c.description).filter(Boolean).join("；"));
  }
  return parts.join("。") || "行动已处理。";
}

// ── Hidden leak scanner ──

export function scanForHiddenLeaks(narration = "", hiddenGmState = {}, gmBook = {}) {
  const sensitiveTerms = [];
  const leaks = [];

  // Check hidden truth
  const hiddenTruth = gmBook?.hiddenTruth || "";
  if (hiddenTruth && hiddenTruth.length > 3) {
    sensitiveTerms.push({ source: "gmBook.hiddenTruth", text: hiddenTruth.slice(0, 100) });
  }

  // Check hidden clocks
  const hiddenClocks = hiddenGmState?.hiddenClocks || hiddenGmState?.clocks || [];
  for (const clock of hiddenClocks) {
    if (clock.label) sensitiveTerms.push({ source: `hiddenClock:${clock.id || clock.clockId}`, text: clock.label });
  }

  // Check NPC secrets
  const npcSecrets = hiddenGmState?.npcSecrets || {};
  for (const [npcId, secrets] of Object.entries(npcSecrets)) {
    for (const [key, val] of Object.entries(secrets || {})) {
      if (typeof val === "string" && val.length > 5 && key !== "lastUpdated") {
        sensitiveTerms.push({ source: `npcSecret:${npcId}.${key}`, text: val.slice(0, 80) });
      }
    }
  }

  // Scan narration for leaks
  let sanitized = narration;
  for (const term of sensitiveTerms) {
    if (narration.includes(term.text)) {
      leaks.push(term.source);
      sanitized = sanitized.replace(new RegExp(term.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '【已隐藏】');
    }
  }

  return { leaks, sanitizedNarration: leaks.length > 0 ? sanitized : narration };
}

// ── Hidden state visibility assertion ──

export function assertNoHiddenStateInPlayerView(playerView = {}) {
  const violations = [];
  if (JSON.stringify(playerView).includes("hiddenGmState")) violations.push("hiddenGmState key present");
  if (playerView.gmBook?.hiddenTruth) violations.push("gmBook.hiddenTruth present");
  return { safe: violations.length === 0, violations };
}
