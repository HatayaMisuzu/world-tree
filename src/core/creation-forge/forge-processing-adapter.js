import { ingestMaterial } from "../processing/material-ingest.js";
import { extractMaterialCandidates } from "../processing/material-extractor.js";
import { scoreMaterialCandidate } from "../processing/material-scorer.js";
export async function prepareForgeMaterialCandidates(branchRoot, input = {}) { const ingested = await ingestMaterial(branchRoot, input); const candidates = extractMaterialCandidates(ingested.record, ingested.content, input.options); return { material: ingested.record, candidates: candidates.map((candidate) => ({ ...candidate, score: scoreMaterialCandidate(candidate, input.context) })) }; }
