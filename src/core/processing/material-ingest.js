import { createHash } from "node:crypto";
import { join } from "node:path";
import { appendJsonl } from "../../server/fs-utils.js";
export async function ingestMaterial(branchRoot, input = {}) { const content = String(input.content || ""); const record = { id: input.id || `mat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, sourceType: input.sourceType || "unknown", sourceLabel: input.sourceLabel || "Unlabelled material", createdAt: new Date().toISOString(), branchId: input.branchId || "main", contentHash: createHash("sha256").update(content).digest("hex"), rawPreview: content.slice(0, 240), status: "ingested" }; await appendJsonl(join(branchRoot, "runtime", "processing", "materials.jsonl"), record); return { record, content };
}
