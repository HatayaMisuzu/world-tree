// llm-task-gateway.js
// Safe construction and invocation helpers for LLM tasks.

import { buildPromptOrchestrationPacket } from "./prompt-builder.js";
import {
  buildContractInstruction,
  requirePromptTaskContract,
  OUTPUT_FORMAT
} from "./prompt-task-contracts.js";
import { resolvePromptRuntimeIdentity } from "./prompt-runtime-identity.js";
import { sanitizeForLlm, sanitizeText } from "./prompt-hidden-sanitizer.js";

export function buildLLMTaskPrompt({
  modeId = "",
  dataMode = "",
  worldSubType = "",
  taskId = "writer",
  userInput = "",
  generationType = "normal",
  kernelContext = null,
  worldbookContext = null,
  characterContext = null,
  extraBlocks = [],
  extraContext = null,
  overrideBudget = 0
} = {}) {
  const contract = requirePromptTaskContract(taskId);
  const identity = resolvePromptRuntimeIdentity({ modeId, dataMode, worldSubType });
  const promptModeId = identity.promptModeId;

  const gatewayBlock = {
    id: `gateway.contract.${taskId}`,
    title: `LLM Task Contract: ${taskId}`,
    layer: "task",
    role: "system",
    position: "pre_context",
    priority: 950,
    order: 1,
    required: true,
    budgetWeight: 1,
    content: [
      buildContractInstruction(taskId),
      identity.warnings?.length ? `【Runtime Identity Warnings】\n${identity.warnings.map((w) => `- ${w}`).join("\n")}` : "",
      extraContext ? buildExtraContext(extraContext) : ""
    ].filter(Boolean).join("\n\n"),
    tags: ["llm-contract", taskId]
  };

  const packet = buildPromptOrchestrationPacket({
    modeId: promptModeId,
    taskId: mapContractToPromptBlockTask(taskId),
    userInput: sanitizeText(userInput),
    generationType,
    kernelContext: kernelContext ? sanitizeForLlm(kernelContext) : null,
    worldbookContext: worldbookContext ? sanitizeForLlm(worldbookContext) : null,
    characterContext: characterContext ? sanitizeForLlm(characterContext) : null,
    extraBlocks: [gatewayBlock, ...(extraBlocks || [])],
    overrideBudget
  });

  return {
    ...packet,
    taskId,
    contract,
    identity,
    promptModeId,
    llmOptions: {
      temperature: contract.temperature,
      max_tokens: contract.maxTokens
    }
  };
}

function buildExtraContext(extraContext) {
  return `【Task Extra Context】\n${JSON.stringify(sanitizeForLlm(extraContext), null, 2)}`;
}

function mapContractToPromptBlockTask(taskId) {
  if (taskId === "director-analysis") return "director-analysis";
  if (taskId === "director-packet") return "director";
  if (taskId === "guardian-audit" || taskId === "guardian-correction") return taskId;
  if (taskId === "alchemy-extractor") return "processing-extractor";
  if (taskId === "alchemy-classifier" || taskId === "alchemy-cocreate") return "processing-extractor";
  if (taskId === "character-v2-live" || taskId === "character-refinery") return "writer";
  if (taskId === "tabletop-narration-polish") return "writer";
  if (taskId.startsWith("detective-")) return "writer";
  if (taskId.startsWith("scriptkill-")) return "writer";
  if (taskId === "workflow-writer") return "writer";
  return taskId;
}

export async function callLLMTask({
  taskId,
  modeId,
  dataMode,
  worldSubType,
  userInput,
  context = null,
  llmCaller,
  config = {},
  apiKey = "",
  role = null,
  options = {}
} = {}) {
  if (!llmCaller) throw new Error("callLLMTask requires llmCaller");
  const packet = buildLLMTaskPrompt({
    modeId,
    dataMode,
    worldSubType,
    taskId,
    userInput,
    extraContext: context,
    generationType: options.generationType || "normal"
  });
  const actualRole = role || packet.contract.role || "writer";
  const result = await llmCaller(actualRole, packet.promptText, config, apiKey, {
    ...packet.llmOptions,
    ...(options.llmOptions || {})
  });
  return normalizeLLMTaskResult(result, packet);
}

export function normalizeLLMTaskResult(result = {}, packet = {}) {
  const rawText = result?.parsedContent || result?.rawResponse || result?.text || result?.content || "";
  const outputFormat = packet.contract?.outputFormat || OUTPUT_FORMAT.TEXT;
  const normalized = {
    ok: true,
    taskId: packet.taskId,
    text: String(rawText || "").trim(),
    raw: result,
    contract: packet.contract,
    modelUsed: result?.modelUsed || result?.model || "",
    warnings: []
  };
  if (outputFormat === OUTPUT_FORMAT.JSON) {
    const parsed = parseJsonLoose(normalized.text);
    if (!parsed.ok) {
      normalized.ok = false;
      normalized.warnings.push(`JSON_PARSE_FAILED: ${parsed.error}`);
    }
    normalized.json = parsed.value;
  }
  return normalized;
}

export function parseJsonLoose(text = "") {
  const raw = String(text || "").trim();
  if (!raw) return { ok: false, value: null, error: "empty" };
  const unwrapped = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return { ok: true, value: JSON.parse(unwrapped), error: null };
  } catch (err) {
    const obj = extractBalanced(unwrapped, "{", "}") || extractBalanced(unwrapped, "[", "]");
    if (!obj) return { ok: false, value: null, error: err.message };
    try {
      return { ok: true, value: JSON.parse(obj), error: null };
    } catch (inner) {
      return { ok: false, value: null, error: inner.message };
    }
  }
}

function extractBalanced(text, open, close) {
  const start = text.indexOf(open);
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\") { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === open) depth++;
    if (ch === close) {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}
