// services/alchemy-workflow-service.js — W1 Alchemy workflows
import { parseSourceMaterial, extractCandidates } from "../../alchemy/alchemy-digest.js";
import { createWarehouse, registerCandidate } from "../../materials/material-warehouse.js";
import { WORKFLOW_TYPES } from "../workflow-types.js";

const warehouses = new Map();

export const alchemyWorkflowService = {
  async run(envelope, { authorityDecision }) {
    switch (envelope.workflowType) {
      case WORKFLOW_TYPES.ALCHEMY_IMPORT: return importMaterial(envelope);
      case WORKFLOW_TYPES.ALCHEMY_DIGEST: return digestMaterial(envelope);
      case WORKFLOW_TYPES.ALCHEMY_DELIVER: return deliverCandidates(envelope, authorityDecision);
      default: return digestMaterial(envelope);
    }
  }
};

function importMaterial(envelope) {
  const material = parseSourceMaterial({ text: envelope.userInput, sourceType: "api-import", sourceLabel: envelope.moduleKey || "user" });
  if (!warehouses.has(envelope.moduleKey || "default")) warehouses.set(envelope.moduleKey || "default", createWarehouse());
  const wh = warehouses.get(envelope.moduleKey || "default");
  wh.sources.push(material);
  return { ok: true, visibleText: `素材已导入 (${material.id})`, candidates: [], runtimeUpdates: [{ key: "material_imported", materialId: material.id }], canonWrites: [], warnings: [] };
}

function digestMaterial(envelope) {
  const material = parseSourceMaterial({ text: envelope.userInput, sourceType: "api-digest", sourceLabel: envelope.moduleKey || "user" });
  const candidates = extractCandidates(material);
  if (!warehouses.has(envelope.moduleKey || "default")) warehouses.set(envelope.moduleKey || "default", createWarehouse());
  const wh = warehouses.get(envelope.moduleKey || "default");
  for (const c of candidates) registerCandidate(wh, c, material.id);
  const summary = candidates.map(c => `[${c.type}] ${c.title}`).join(", ");
  return { ok: true, visibleText: candidates.length > 0 ? `提取了 ${candidates.length} 个候选：${summary}` : "未提取到候选", candidates, runtimeUpdates: [], canonWrites: [], warnings: [] };
}

function deliverCandidates(envelope, authorityDecision) {
  return { ok: true, visibleText: "候选已投递到 Growth Tree / Proposal Queue", candidates: [], proposals: [{ type: "alchemy_deliver", count: 0, status: "pending" }], runtimeUpdates: [], canonWrites: [], warnings: authorityDecision.candidateOnly ? [] : ["candidate delivery should remain candidate-only"] };
}
