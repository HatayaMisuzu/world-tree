// adapters/server-workflow-adapter.js — WSD-6 minimal server workflow API
import { runWorkflowAction } from "../workflow-runner.js";
import { WORKFLOW_TYPES } from "../workflow-types.js";
import { buildContractInstruction } from "../../prompts/prompt-task-contracts.js";
import { buildOpenAICompatibleChatBody } from "../../../adapters/providers/openai-compatible.js";

export async function handleWorkflowApiRequest(body = {}, deps = {}) {
  const { workflowType, modeId, projectId, branchId, userInput, options } = body || {};
  // Build real LLM adapter from server deps if available
  const workflowDeps = { ...deps };
  if (deps.llmConfig && deps.apiKey) {
    workflowDeps.realLlm = async ({ envelope, promptPacket }) => {
      try {
        const baseUrl = String(deps.llmConfig.llmBaseUrl || "").replace(/\/$/, "");
        const model = deps.llmConfig.llmModel || "";
        if (!baseUrl || !model) throw new Error("LLM not configured");
        const taskContract = buildContractInstruction("workflow-writer");
        const messages = [
          {
            role: "system",
            content: [
              "你是 World Tree 工作流执行器。",
              "必须遵守当前 prompt packet 与 workflow-writer task contract。",
              "不要声称已保存、已写入 canon、已完成外部操作，除非上游明确返回。",
              taskContract
            ].join("\n")
          },
          { role: "user", content: promptPacket?.promptText || envelope.userInput || "" }
        ];
        const resp = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${deps.apiKey}` },
          body: JSON.stringify(buildOpenAICompatibleChatBody({
            baseUrl,
            providerId: deps.llmConfig.llmProvider || deps.llmConfig.provider || "openai-compatible",
            model,
            messages,
            temperature: 0.7,
            maxTokens: 1024,
            thinking: deps.llmConfig.llmThinking ?? deps.llmConfig.thinking ?? "auto"
          })),
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
