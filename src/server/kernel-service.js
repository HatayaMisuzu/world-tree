import { join } from "node:path";
import { appendJsonl, readJson, readJsonlTail } from "./fs-utils.js";
import { createKernelTurnContext, summarizeKernelTurnContext } from "../core/kernel/kernel-turn-context.js";
import { initializeBranchTree, createBranch, switchBranch, listBranches, archiveBranch, resolveActiveBranchProjectRoot, getActiveBranch } from "../core/timeline/branch-manager.js";
import { createBranchDiffSummary } from "../core/timeline/branch-diff-summary.js";
import { collectWorldTelemetry } from "../core/telemetry/world-telemetry.js";
import { approveProposal, rejectProposal } from "../core/system/proposal-bus.js";
import { readStopLossWindows } from "../core/content/stop-loss-window.js";
import { createReverseProposal } from "../core/content/reversible-change.js";
import { prepareForgeMaterialCandidates } from "../core/creation-forge/forge-processing-adapter.js";
import { deliverProcessingCandidate } from "../core/processing/processing-delivery.js";

async function branchRoot(projectRoot) {
  await initializeBranchTree(projectRoot);
  return resolveActiveBranchProjectRoot(projectRoot);
}

export async function getKernelSummary(projectRoot, options = {}) {
  const root = await branchRoot(projectRoot);
  const [context, proposals, windows, candidates] = await Promise.all([
    createKernelTurnContext({ projectRoot, modeId: options.modeId, userInput: "", model: options.model || {}, engineState: options.engineState || {} }),
    readJsonlTail(join(root, "runtime", "world-proposals.jsonl"), 200),
    readStopLossWindows(root),
    readJsonlTail(join(root, "runtime", "processing", "extracted-candidates.jsonl"), 200)
  ]);
  const pendingProposals = proposals.filter((item) => item.status === "pending").slice(-20).map((item) => ({
    id: item.id,
    title: item.title || item.kind || "待审提案",
    kind: item.kind || "proposal",
    impactLevel: item.impactLevel || "normal",
    summary: item.summary || item.reason || "",
    requiresSecondConfirm: item.requiresSecondConfirm === true,
    affectedFiles: Array.isArray(item.affectedFiles) ? item.affectedFiles : [],
    reversible: item.reversible === true,
    stopLossWindow: item.stopLossWindow || null
  }));
  return { status: "ok", ...summarizeKernelTurnContext(context), pendingProposals, pendingProposalsCount: pendingProposals.length, pendingCriticalProposalsCount: pendingProposals.filter((item) => item.impactLevel === "critical").length, openStopLossWindows: windows.windows.filter((item) => item.status === "open"), processingCandidateCount: candidates.length };
}

export async function handleBranchOperation(projectRoot, action, input = {}) {
  await initializeBranchTree(projectRoot);
  if (action === "list") return { status: "ok", activeBranch: (await readJson(join(projectRoot, "active-branch.json"), { branchId: "main" })).branchId, branches: await listBranches(projectRoot) };
  if (action === "create") return { status: "ok", branch: await createBranch(projectRoot, input) };
  if (action === "switch") return { status: "ok", branch: await switchBranch(projectRoot, input.branchId) };
  if (action === "archive") return { status: "ok", branch: await archiveBranch(projectRoot, input.branchId) };
  if (action === "diff") return { status: "ok", diff: await createBranchDiffSummary(projectRoot, input.fromBranchId || "main", input.branchId) };
  throw new Error(`unsupported branch action: ${action}`);
}

export async function getLatestKernelTelemetry(projectRoot) { const root = await branchRoot(projectRoot); return { status: "ok", telemetry: (await readJsonlTail(join(root, "runtime", "world-telemetry.jsonl"), 1))[0] || null }; }
export async function refreshKernelTelemetry(projectRoot, context = {}) { const root = await branchRoot(projectRoot); const active = await getActiveBranch(projectRoot); return { status: "ok", telemetry: await collectWorldTelemetry(root, { branchId: active?.id || "main", ...context }, { persist: true }) }; }
export async function previewAutoLight(projectRoot, input = {}) {
  const root = await branchRoot(projectRoot);
  const context = await createKernelTurnContext({
    projectRoot,
    modeId: input.modeId,
    userInput: input.userInput || "继续",
    activeProposals: input.activeProposals || [],
    runtimeFlags: {
      advanceMode: "auto-light",
      hiddenTruthRequired: input.hiddenTruthRequired === true,
      suggestedUserChoices: input.suggestedUserChoices || []
    }
  });
  const preview = context.autoAdvancePreview || { advanced: false, reason: "not_continue_intent" };
  const result = { ...preview, status: preview.advanced ? (preview.stoppedBecause === "choice_point" ? "stopped" : "ready") : "blocked" };
  await appendJsonl(join(root, "runtime", "auto-advance-state.jsonl"), { ...result, requestedAt: new Date().toISOString() });
  return { status: "ok", result };
}

export async function approveKernelProposal(projectRoot, proposalId, input = {}) { const root = await branchRoot(projectRoot); return approveProposal({ projectRoot: root, proposalLog: join(root, "runtime", "world-proposals.jsonl") }, proposalId, {}, { secondConfirm: input.secondConfirm === true, currentTurn: Number(input.currentTurn || 0) }); }
export async function rejectKernelProposal(projectRoot, proposalId) { const root = await branchRoot(projectRoot); return rejectProposal({ projectRoot: root, proposalLog: join(root, "runtime", "world-proposals.jsonl") }, proposalId); }
export async function getKernelStopLoss(projectRoot) { const root = await branchRoot(projectRoot); return { status: "ok", ...(await readStopLossWindows(root)) }; }
export async function reverseKernelProposal(projectRoot, proposalId) {
  const root = await branchRoot(projectRoot);
  const proposals = await readJsonlTail(join(root, "runtime", "world-proposals.jsonl"), 1000);
  const original = [...proposals].reverse().find((item) => item.id === proposalId);
  const windows = await readStopLossWindows(root);
  const window = windows.windows.find((item) => item.proposalId === proposalId && item.status === "open");
  if (!original || !window) throw new Error("proposal or open stop-loss window not found");
  const reverse = createReverseProposal(original, window);
  await appendJsonl(join(root, "runtime", "world-proposals.jsonl"), reverse);
  return { status: "ok", proposal: reverse, originalWindowStatus: "open_until_reverse_approved" };
}

export async function ingestProcessingMaterial(projectRoot, input = {}) { const root = await branchRoot(projectRoot); const prepared = await prepareForgeMaterialCandidates(root, { ...input, content: input.content || input.text || "", sourceLabel: input.sourceLabel || input.sourceType || "kernel-api" }); for (const candidate of prepared.candidates) await appendJsonl(join(root, "runtime", "processing", "extracted-candidates.jsonl"), candidate); return { status: "ok", ...prepared }; }
export async function listProcessingCandidates(projectRoot) { const root = await branchRoot(projectRoot); return { status: "ok", candidates: await readJsonlTail(join(root, "runtime", "processing", "extracted-candidates.jsonl"), 200) }; }
export async function deliverProcessingById(projectRoot, candidateId) { const root = await branchRoot(projectRoot); const candidates = await readJsonlTail(join(root, "runtime", "processing", "extracted-candidates.jsonl"), 1000); const candidate = [...candidates].reverse().find((item) => item.id === candidateId); if (!candidate) throw new Error("processing candidate not found"); return { status: "ok", result: await deliverProcessingCandidate(root, candidate, candidate.score || {}) }; }
