import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, access, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { writeJson, appendJsonl } from "../../src/server/fs-utils.js";
import { composeModulesForMode } from "../../src/core/modes/module-composer.js";
import { initializeBranchTree, createBranch, switchBranch, listBranches, archiveBranch, resolveActiveBranchProjectRoot } from "../../src/core/timeline/branch-manager.js";
import { createBranchDiffSummary } from "../../src/core/timeline/branch-diff-summary.js";
import { collectWorldTelemetry } from "../../src/core/telemetry/world-telemetry.js";
import { TELEMETRY_LEVELS } from "../../src/core/telemetry/telemetry-policy.js";
import { isContinueIntent, canAutoLight } from "../../src/core/advance/advance-policy.js";
import { detectChoicePoint } from "../../src/core/advance/choice-point-detector.js";
import { runAutoLightAdvance } from "../../src/core/advance/auto-advance.js";
import { ingestMaterial } from "../../src/core/processing/material-ingest.js";
import { extractMaterialCandidates } from "../../src/core/processing/material-extractor.js";
import { scoreMaterialCandidate } from "../../src/core/processing/material-scorer.js";
import { evaluateProcessingDelivery } from "../../src/core/processing/processing-policy.js";
import { deliverProcessingCandidate } from "../../src/core/processing/processing-delivery.js";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const profilesRoot = join(repoRoot, "defaults", "world-profiles");
async function project() { const root = await mkdtemp(join(tmpdir(), "wt-p2-")); await writeJson(join(root, "shared", "world_state.json"), { states: { capital: { value: "stable" } } }); await writeJson(join(root, "runtime", "tracking", "foreshadowing.json"), { items: [] }); await writeJson(join(root, "runtime", "tracking", "conflicts.json"), { items: [] }); return root; }
const profile = { profilesRoot };

// World Profile Overlay: 7 focused tests
test("P2 profile 1 preserves base modules", () => assert.ok(composeModulesForMode("world-rpg", "epic-war", profile).modules.includes("core.world_container")));
test("P2 profile 2 adds profile modules", () => assert.ok(composeModulesForMode("world-rpg", "epic-war", profile).modules.includes("world.telemetry")));
test("P2 profile 3 adds user enabled registered modules", () => assert.ok(composeModulesForMode("world-rpg", "epic-war", { ...profile, enabledModules: ["processing.completion_engine"] }).modules.includes("processing.completion_engine")));
test("P2 profile 4 user disabled wins", () => assert.equal(composeModulesForMode("world-rpg", "epic-war", { ...profile, disabledModules: ["world.telemetry"] }).modules.includes("world.telemetry"), false));
test("P2 profile 5 unknown modules warn without crash", () => assert.ok(composeModulesForMode("world-rpg", "epic-war", { ...profile, enabledModules: ["unknown.x"] }).warnings.some((item) => item.includes("unregistered"))));
test("P2 profile 6 unregistered modules never enter result", () => assert.equal(composeModulesForMode("world-rpg", "epic-war", { ...profile, enabledModules: ["unknown.x"] }).modules.includes("unknown.x"), false));
test("P2 profile 7 mode mismatch blocks profile modules", () => assert.ok(composeModulesForMode("character", "urban-mystery", profile).warnings.some((item) => item.includes("profile_mode_mismatch"))));

// Timeline / Branch: 8 focused tests
test("P2 branch 1 initializes main", async () => { const root=await project(); const tree=await initializeBranchTree(root); assert.equal(tree.activeBranchId,"main"); });
test("P2 branch 2 creates metadata", async () => { const root=await project(); const b=await createBranch(root,{id:"alternate",label:"Alt"}); assert.equal(b.parentBranchId,"main"); });
test("P2 branch 3 copies shared and runtime", async () => { const root=await project(); await createBranch(root,{id:"copy"}); await access(join(root,"branches","copy","shared","world_state.json")); await access(join(root,"branches","copy","runtime","tracking","conflicts.json")); });
test("P2 branch 4 switches one active branch", async () => { const root=await project(); await createBranch(root,{id:"alt"}); await switchBranch(root,"alt"); assert.equal((await resolveActiveBranchProjectRoot(root)).endsWith(join("branches","alt")),true); });
test("P2 branch 5 lists branches", async () => { const root=await project(); await createBranch(root,{id:"alt"}); assert.equal((await listBranches(root)).length,2); });
test("P2 branch 6 isolates writes", async () => { const root=await project(); await createBranch(root,{id:"alt"}); await switchBranch(root,"alt"); const active=await resolveActiveBranchProjectRoot(root); await writeJson(join(active,"shared","world_state.json"),{states:{capital:{value:"fallen"}}}); const main=JSON.parse(await readFile(join(root,"branches","main","shared","world_state.json"),"utf8")); assert.equal(main.states.capital.value,"stable"); });
test("P2 branch 7 creates diff without merge", async () => { const root=await project(); await createBranch(root,{id:"alt"}); await appendJsonl(join(root,"branches","alt","runtime","tracking","change-log.jsonl"),{id:"c1",reason:"different"}); const diff=await createBranchDiffSummary(root,"main","alt"); assert.deepEqual(diff.majorDifferences,["different"]); });
test("P2 branch 8 archives inactive branch and exposes no merge API", async () => { const root=await project(); await createBranch(root,{id:"alt"}); assert.equal((await archiveBranch(root,"alt")).status,"archived"); const mod=await import("../../src/core/timeline/branch-manager.js"); assert.equal("mergeBranch" in mod,false); });

// Telemetry: 8 focused tests
test("P2 telemetry 1 runs with missing optional files", async () => { const root=await mkdtemp(join(tmpdir(),"wt-tel-")); assert.equal((await collectWorldTelemetry(root,{}, {persist:false})).version,1); });
test("P2 telemetry 2 writes its digest", async () => { const root=await project(); await collectWorldTelemetry(root); await access(join(root,"runtime","world-telemetry.jsonl")); });
test("P2 telemetry 3 does not modify shared", async () => { const root=await project(); const before=await readFile(join(root,"shared","world_state.json"),"utf8"); await collectWorldTelemetry(root); assert.equal(await readFile(join(root,"shared","world_state.json"),"utf8"),before); });
test("P2 telemetry 4 uses enum levels", async () => { const root=await project(); const d=await collectWorldTelemetry(root,{}, {persist:false}); assert.equal(Object.values(d.metrics).every((v)=>TELEMETRY_LEVELS.includes(v)),true); });
test("P2 telemetry 5 conflicts raise pressure", async () => { const root=await project(); await writeJson(join(root,"runtime","tracking","conflicts.json"),{items:[{status:"open"},{status:"open"},{status:"open"}]}); assert.equal((await collectWorldTelemetry(root,{}, {persist:false})).metrics.conflictPressure,"high"); });
test("P2 telemetry 6 foreshadowing raises mystery load", async () => { const root=await project(); await writeJson(join(root,"runtime","tracking","foreshadowing.json"),{items:Array.from({length:4},()=>({status:"active"}))}); assert.equal((await collectWorldTelemetry(root,{}, {persist:false})).metrics.mysteryLoad,"high"); });
test("P2 telemetry 7 load raises memory metric", async () => { const root=await project(); for(let i=0;i<12;i++) await appendJsonl(join(root,"runtime","tracking","change-log.jsonl"),{id:`c${i}`}); assert.equal((await collectWorldTelemetry(root,{}, {persist:false})).metrics.memoryLoad,"high"); });
test("P2 telemetry 8 recommendations contain no story facts", async () => { const root=await project(); const d=await collectWorldTelemetry(root,{}, {persist:false}); assert.equal(d.recommendations.every((v)=>/^[a-z_]+$/.test(v)),true); });

// Auto-light: 9 focused tests
const autoBase={userInput:"continue",advanceMode:"auto-light",profile:{autoAdvance:{allowAutoLight:true}},telemetry:{metrics:{}},directorPlan:{stopAtChoicePoint:false},activeProposals:[]};
test("P2 auto 1 detects continue intents",()=>assert.equal(isContinueIntent("继续"),true));
test("P2 auto 2 manual profile blocks",()=>assert.equal(canAutoLight({...autoBase,profile:{autoAdvance:{allowAutoLight:false}}}).allowed,false));
test("P2 auto 3 critical proposal blocks",()=>assert.equal(canAutoLight({...autoBase,activeProposals:[{status:"pending",impactLevel:"critical"}]}).allowed,false));
test("P2 auto 4 critical telemetry blocks",()=>assert.equal(canAutoLight({...autoBase,telemetry:{metrics:{stability:"critical"}}}).allowed,false));
test("P2 auto 5 advances one beat",()=>assert.equal(runAutoLightAdvance(autoBase).beatCount,1));
test("P2 auto 6 stops at choice point",()=>assert.equal(runAutoLightAdvance({...autoBase,suggestedUserChoices:["A","B"]}).stoppedBecause,"choice_point"));
test("P2 auto 7 never approves proposals",()=>assert.equal("approvedProposals" in runAutoLightAdvance(autoBase),false));
test("P2 auto 8 mystery interpretation is choice point",()=>assert.equal(detectChoicePoint({modeId:"mystery-puzzle",requiresClueInterpretation:true}).isChoicePoint,true));
test("P2 auto 9 hidden truth blocks",()=>assert.equal(runAutoLightAdvance({...autoBase,hiddenTruthRequired:true}).advanced,false));

// Processing: 8 focused tests
test("P2 processing 1 ingests material",async()=>{const root=await project(); assert.equal((await ingestMaterial(root,{content:"Lore",sourceLabel:"note"})).record.status,"ingested");});
test("P2 processing 2 extracts candidates",async()=>{const root=await project();const m=await ingestMaterial(root,{content:"Ancient Slate",sourceLabel:"note"});assert.equal(extractMaterialCandidates(m.record,m.content).length,1);});
test("P2 processing 3 scores allowed enums",()=>assert.equal(Object.values(scoreMaterialCandidate({title:"x",summary:"y",conflicts:[],riskLevel:"medium"})).every((v)=>["low","medium","high","unknown"].includes(v)),true));
test("P2 processing 4 critical risk blocks",()=>assert.equal(evaluateProcessingDelivery({riskLevel:"critical",conflicts:[],source:{label:"known"}},{consistency:"high"}).allowed,false));
test("P2 processing 5 unresolved conflict blocks",()=>assert.equal(evaluateProcessingDelivery({riskLevel:"medium",conflicts:["x"],source:{label:"known"}},{consistency:"low"}).allowed,false));
test("P2 processing 6 delivery targets growth tree not shared",async()=>{const root=await project();const c={id:"cand",materialId:"m",type:"worldbookCandidate",title:"Slate",summary:"Lore",riskLevel:"medium",conflicts:[],source:{label:"known",hash:"h"}};assert.equal((await deliverProcessingCandidate(root,c,{consistency:"high"})).destination,"growth_tree");await assert.rejects(()=>access(join(root,"shared","worldbook.json")));});
test("P2 processing 7 preserves source label and hash",async()=>{const root=await project();const m=await ingestMaterial(root,{content:"Lore",sourceLabel:"User note"});const [c]=extractMaterialCandidates(m.record,m.content);assert.deepEqual(c.source,{label:"User note",hash:m.record.contentHash});});
test("P2 processing 8 is branch local",async()=>{const root=await project();await createBranch(root,{id:"alt"});await switchBranch(root,"alt");const branch=await resolveActiveBranchProjectRoot(root);await ingestMaterial(branch,{content:"Lore",sourceLabel:"note"});await access(join(branch,"runtime","processing","materials.jsonl"));await assert.rejects(()=>access(join(root,"branches","main","runtime","processing","materials.jsonl")));});
