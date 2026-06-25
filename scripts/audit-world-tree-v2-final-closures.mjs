// World Tree V2 Final Closure Audit
// Checks schema-specific final closure conditions that route-only audits miss.

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => existsSync(join(root, p)) ? readFileSync(join(root, p), "utf-8") : "";
const pkg = JSON.parse(read("package.json") || "{}");

let pass = 0;
let fail = 0;
function check(label, ok) {
  if (ok) pass++;
  else { fail++; console.error(`FAIL: ${label}`); }
}

const detectiveGenerator = read("src/core/detective/detective-case-generator.js");
const detectiveValidator = read("src/core/detective/detective-case-quality-validator.js");
const charLiveService = read("src/server/character-v2-live-turn-service.js");
const charCapsuleService = read("src/server/character-capsule-service.js");
const ui = read("world-tree-console.js");
const tabletopService = read("src/server/tabletop-v2-service.js");

check("script test:world-tree-v2-entries exists", !!pkg.scripts?.["test:world-tree-v2-entries"]);
check("script test:entry-closures exists", !!pkg.scripts?.["test:entry-closures"]);
check("detective generator emits non-empty evidence", /evidence:\s*\[\s*\{/.test(detectiveGenerator) || /buildEvidence\(/.test(detectiveGenerator));
check("detective generator emits testimonies", /testimonies:\s*\[\s*\{/.test(detectiveGenerator) || /buildTestimonies\(/.test(detectiveGenerator));
check("detective generator uses culpritIds", detectiveGenerator.includes("culpritIds") && !/truthLedger:\s*\{[\s\S]*culprit:\s*null/.test(detectiveGenerator));
check("detective generator emits criticalEvidenceIds", detectiveGenerator.includes("criticalEvidenceIds") && !detectiveGenerator.includes("criticalEvidenceIds: []"));
check("detective validator uses testimonies", detectiveValidator.includes("caseCapsule.testimonies") || detectiveValidator.includes("const testimonies"));
check("detective validator uses culpritIds", detectiveValidator.includes("culpritIds") && !detectiveValidator.includes("tl.culprit)"));
check("detective validator uses nested timeline", detectiveValidator.includes("timeline.realTimeline") && detectiveValidator.includes("timeline.publicTimeline"));
check("detective generator test exists", existsSync(join(root, "tests/unit/detective-v2-case-generator.test.js")));

check("character live service does not treat candidates as array length", !charLiveService.includes("const candidates = result.candidates || []") && !charLiveService.includes("candidates.length > 0"));
check("character live service uses candidate envelope persistence", charLiveService.includes("persistCharacterV2PendingCandidates") || charLiveService.includes("flattenCharacterV2CandidateEnvelope"));
check("character runtime reads long-term-state", charCapsuleService.includes("long-term-state.json"));
check("character long-term e2e test exists", existsSync(join(root, "tests/unit/character-v2-long-term-end-to-end.test.js")));

check("tabletop service uses GM loop", tabletopService.includes("executeTabletopGmLoop"));
check("tabletop service uses importer preview", tabletopService.includes("buildTabletopImportPreview"));
check("tabletop service imports sep", tabletopService.includes("join, sep"));

for (const method of [
  "tabletopV2ImportCommit", "tabletopV2ExportRun", "detectiveV2GeneratePreview", "detectiveV2GenerateCommit",
  "detectiveV2ExportRun", "characterV2Candidates", "characterV2CandidateReview"
]) {
  check(`UI API method ${method}`, ui.includes(`${method}(`));
}

console.log(`Final V2 closure audit: ${pass}/${pass + fail} pass`);
if (fail > 0) process.exit(1);
console.log("All final closure checks passed.");
