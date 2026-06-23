// adapters/server-workflow-adapter.js — WSD-6 minimal server workflow API
import { runWorkflowAction } from "../workflow-runner.js";
import { WORKFLOW_TYPES } from "../workflow-types.js";

export async function handleWorkflowApiRequest(body = {}, deps = {}) {
  const { workflowType, modeId, projectId, branchId, userInput, options } = body || {};
  // Build real LLM adapter from server deps if available
  const workflowDeps = { ...deps };
  if (deps.realLlmCall && deps.llmConfig && deps.apiKey) {
    workflowDeps.realLlm = async ({ envelope, promptPacket }) => {
      try {
        const baseUrl = String(deps.llmConfig.llmBaseUrl || "").replace(/\/$/, "");
        const model = deps.llmConfig.llmModel || "";
        if (!baseUrl || !model) throw new Error("LLM not configured");
        const messages = [
          { role: "system", content: "You are World Tree. Respond in Chinese. Follow the prompt." },
          { role: "user", content: promptPacket?.promptText || envelope.userInput || "" }
        ];
        const resp = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${deps.apiKey}` },
          body: JSON.stringify({ model, messages, temperature: 0.7, max_tokens: 1024 }),
          signal: AbortSignal.timeout(30000)
        });
        if (!resp.ok) throw new Error(`LLM HTTP ${resp.status}`);
        const data = await resp.json();
        return { text: data?.choices?.[0]?.message?.content || "", llmUsed: true, model };
      } catch (e) {
        return { text: "", llmUsed: false, warnings: [`LLM call failed: ${e.message}`] };
      }
    };
  }
  const result = await runWorkflowAction({
    explicitWorkflowType: workflowType, modeId: modeId || "unknown",
    moduleKey: projectId, activeBranchId: branchId || "main", userInput: userInput || "",
    options: options || {}, kernelContext: deps.kernelContext || null
  }, workflowDeps);
  const safe = { ...result };
  if (safe.debugSummary) {
    const s = JSON.stringify(safe.debugSummary);
    if (s.includes("hiddenTruth") || s.includes("D:\\\\")) safe.debugSummary = { redacted: true };
  }
  return { ok: safe.ok, workflowType: safe.workflowType, visibleText: safe.visibleText, routed: { candidates: safe.candidates || [], proposals: safe.proposals || [], runtimeUpdates: safe.runtimeUpdates || [], debug: safe.debugSummary || {} }, warnings: safe.warnings || [], errors: safe.errors || [] };
}

export function getWorkflowTypesResponse() {
  const active = Object.entries(WORKFLOW_TYPES).filter(([k]) => !k.includes("HIDDEN")).map(([k, v]) => ({ key: k, type: v }));
  return { ok: true, types: active, count: active.length, note: "Only active types. Prototype/declared workflows are not exposed." };
}

export function getWorkflowStatus() {
  return { ok: true, workflowLayer: "active", preflightProtected: true, services: ["creation", "alchemy", "play-turn", "character", "mystery", "strategy", "direction", "observability"] };
}
