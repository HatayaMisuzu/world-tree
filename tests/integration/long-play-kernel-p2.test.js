import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeJson } from "../../src/server/fs-utils.js";
import { initializeBranchTree, createBranch, switchBranch, resolveActiveBranchProjectRoot } from "../../src/core/timeline/branch-manager.js";
import { collectWorldTelemetry } from "../../src/core/telemetry/world-telemetry.js";
import { runAutoLightAdvance } from "../../src/core/advance/auto-advance.js";
import { prepareForgeMaterialCandidates } from "../../src/core/creation-forge/forge-processing-adapter.js";

test("P2 active branch drives read-only telemetry, one-beat advance, and branch-local processing", async()=>{const root=await mkdtemp(join(tmpdir(),"wt-p2-int-"));await writeJson(join(root,"shared","world_state.json"),{states:{}});await initializeBranchTree(root);await createBranch(root,{id:"alternate"});await switchBranch(root,"alternate");const branch=await resolveActiveBranchProjectRoot(root);const telemetry=await collectWorldTelemetry(branch,{}, {persist:false});const advance=runAutoLightAdvance({userInput:"继续",advanceMode:"auto-light",profile:{autoAdvance:{allowAutoLight:true}},telemetry,directorPlan:{stopAtChoicePoint:false},activeProposals:[]});const processed=await prepareForgeMaterialCandidates(branch,{content:"Northern Mine Rune Slate",sourceLabel:"User notes"});assert.equal(advance.beatCount,1);assert.equal(processed.candidates.length,1);assert.equal(processed.candidates[0].source.label,"User notes");});
