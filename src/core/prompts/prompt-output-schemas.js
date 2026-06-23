// prompt-output-schemas.js — Output schema definitions for all modes and tasks
// Part of World Tree Prompt Orchestration Layer v1

// ── Mode output section definitions ──

export const MODE_OUTPUT_SECTIONS = {
  "quick-setting": {
    allowed: ["VISIBLE_SUMMARY", "STARTER_FIELDS", "MISSING_FIELDS", "OPTIONAL_SUGGESTIONS", "BLOCKED"],
    primary: "VISIBLE_SUMMARY",
    forbidden: ["hidden_truth", "full_worldbook", "canon_declaration"]
  },
  "world-rpg": {
    allowed: ["narrative", "scene_update", "character_reaction", "next_options"],
    primary: "narrative",
    forbidden: ["hidden_truth", "answer_lock", "rpg_mechanics", "canon_override"]
  },
  "character": {
    allowed: ["dialogue", "action", "emotion", "inner_thought"],
    primary: "dialogue",
    forbidden: ["hidden_secret_direct", "persona_override", "user_proxy", "ooc_commentary"]
  },
  "tabletop": {
    allowed: ["narrative", "npc_action", "check_result", "clock_update", "next_options"],
    primary: "narrative",
    forbidden: ["full_dnd_rules", "auto_combat", "player_proxy", "auto_success"]
  },
  "mystery-puzzle": {
    allowed: ["found_clue", "reasonable_speculation", "unconfirmed", "next_investigation"],
    primary: "found_clue",
    forbidden: ["answer_lock_direct", "truth_revelation", "skip_evidence", "npc_confession"]
  },
  "murder-mystery": {
    allowed: ["suspect_testimony", "scene_search", "timeline_fact", "contradiction", "phase_summary"],
    primary: "suspect_testimony",
    forbidden: ["truth_lock_exposure", "killer_self_reveal", "suspect_omniscience", "premature_solution"]
  },
  "strategy-sim": {
    allowed: ["faction_action", "resource_change", "diplomatic_signal", "risk_alert", "consequence"],
    primary: "faction_action",
    forbidden: ["full_4x", "infinite_cascade", "player_decision_override", "hidden_resource_manipulation"]
  },
  "creation-forge": {
    allowed: ["extracted_elements", "character_candidate", "world_candidate", "blueprint", "gap_question", "processing_candidate"],
    primary: "extracted_elements",
    forbidden: ["canon_write", "project_auto_create", "full_narrative", "unconfirmed_as_fact"]
  }
};

// ── Task JSON output schemas ──

export const TASK_SCHEMAS = {
  "writer": {
    type: "text",
    schema: {
      narrative: "string (visible to user)",
      sections: "sections object (parsed by output-parser)"
    }
  },
  "director": {
    type: "json",
    schema: {
      beatType: "string",
      pace: "string",
      tension: "string",
      focus: ["string"],
      shouldAdvanceScene: "boolean",
      shouldRevealSecret: "boolean",
      stopAtChoicePoint: "boolean",
      maxNewEvents: "number",
      forbiddenMoves: ["string"],
      reason: "string"
    }
  },
  "guardian": {
    type: "json",
    schema: {
      score: "number(0-100)",
      oocDetected: "boolean",
      hiddenTruthLeaked: "boolean",
      userAutonomyViolated: "boolean",
      canonCandidateConfused: "boolean",
      overPaced: "boolean",
      formatErrors: ["string"],
      recommendations: ["string"]
    }
  },
  "proposal-extractor": {
    type: "json",
    schema: {
      candidates: [{
        type: "string",
        targetFile: "string",
        summary: "string",
        patch: "object",
        impactLevel: "string",
        reversible: "boolean"
      }]
    }
  },
  "scene-summary": {
    type: "json",
    schema: {
      sceneId: "string",
      title: "string",
      summary: "string",
      charactersPresent: ["string"],
      keyEvents: ["string"],
      changes: ["string"]
    }
  },
  "worldbook-candidate": {
    type: "json",
    schema: {
      candidates: [{
        title: "string",
        content: "string",
        keys: ["string"],
        type: "string",
        confidence: "string",
        riskLevel: "string"
      }]
    }
  },
  "processing-extractor": {
    type: "json",
    schema: {
      candidates: [{
        title: "string",
        type: "string",
        summary: "string",
        suggestedTarget: "string",
        confidence: "string",
        riskLevel: "string",
        source: "object"
      }]
    }
  },
  "emotional-inertia": {
    type: "json",
    schema: {
      updates: [{
        characterId: "string",
        track: "string",
        direction: "string",
        magnitude: "number",
        reason: "string"
      }]
    }
  },
  "telemetry-explanation": {
    type: "text",
    schema: {
      stability: "string",
      tension: "string",
      recommendations: ["string"]
    }
  }
};

/**
 * Get output schema for a mode.
 */
export function getModeOutputSections(modeId) {
  return MODE_OUTPUT_SECTIONS[modeId] || null;
}

/**
 * Get task output schema.
 */
export function getTaskSchema(taskId) {
  return TASK_SCHEMAS[taskId] || null;
}

/**
 * Validate that output matches expected schema for a task.
 */
export function validateTaskOutput(taskId, output) {
  const schema = TASK_SCHEMAS[taskId];
  if (!schema) return { ok: true, warnings: [`no schema defined for task: ${taskId}`] };
  if (schema.type === "text") return { ok: typeof output === "string", errors: typeof output !== "string" ? ["expected text"] : [] };
  return { ok: true, errors: [] }; // Schema validation is non-blocking for now
}
