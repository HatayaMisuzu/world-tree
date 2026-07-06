import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(".");
const manifest = JSON.parse(readFileSync(join(root, "defaults", "examples", "manifest.json"), "utf8"));

const expectedIds = [
  "demo-world-cloud-steam-city",
  "blank-world-template",
  "blank-worldbook-template",
  "blank-character-template",
  "blank-strategy-sim-template",
  "blank-tabletop-template",
  "blank-detective-case-template",
  "blank-scriptkill-template",
  "blank-alchemy-localization-template"
];
const blankExamples = manifest.examples.filter((item) => item.kind === "blank_template");
const demoExamples = manifest.examples.filter((item) => item.kind === "playable_demo");

function readTemplateFile(template, relPath) {
  return readFileSync(join(root, "defaults", "examples", template.path, relPath), "utf8");
}

function parseJsonTemplateFile(template, relPath) {
  return JSON.parse(readTemplateFile(template, relPath));
}

test("examples manifest contains one playable demo and blank template placeholders", () => {
  assert.equal(manifest.version, 1);
  assert.deepEqual(manifest.examples.map((item) => item.id), expectedIds);
  assert.equal(demoExamples.length, 1);
  assert.equal(blankExamples.length, 8);

  const demo = demoExamples[0];
  assert.equal(demo.id, "demo-world-cloud-steam-city");
  assert.equal(demo.contentPolicy, "original_demo_content");
  assert.equal(demo.expectedInstallResult?.containsNarrativeContent, true);
  assert.equal(demo.expectedInstallResult?.minimumRealLlmSmokeTarget, true);
  assert.ok(demo.suggestedFirstInput);

  for (const item of blankExamples) {
    assert.equal(item.kind, "blank_template");
    assert.equal(item.contentPolicy, "blank_structure_only");
    assert.equal(item.type, "world");
    assert.ok(item.path);
    assert.ok(item.entrypoint);
    assert.equal(item.expectedInstallResult?.createsPlayableStructure, true);
    assert.equal(item.expectedInstallResult?.containsNarrativeContent, false);
    assert.equal(item.expectedInstallResult?.containsTutorialContent, false);
    assert.ok(item.files.includes("world.json"));
    assert.ok(item.files.includes("shared/worldbook.json"));
    assert.ok(item.files.includes("shared/characters.json"));
    assert.ok(item.files.includes("runtime/state.json"));
    assert.ok(item.files.includes("runtime/alchemy-deliveries.jsonl"));
  }
});

test("blank template files exist and contain only empty structures plus metadata", () => {
  for (const item of blankExamples) {
    const templateDir = join(root, "defaults", "examples", item.path);
    assert.equal(existsSync(templateDir), true);
    assert.equal(statSync(templateDir).isDirectory(), true);

    for (const relPath of item.files) {
      assert.equal(existsSync(join(templateDir, relPath)), true, `${item.id} missing ${relPath}`);
    }

    const world = parseJsonTemplateFile(item, "world.json");
    assert.equal(world.templateKind, "blank_template");
    assert.equal(world.contentPolicy, "blank_structure_only");

    const worldbook = parseJsonTemplateFile(item, "shared/worldbook.json");
    assert.deepEqual(worldbook.entries, []);

    const characters = parseJsonTemplateFile(item, "shared/characters.json");
    assert.deepEqual(characters, []);

    const state = parseJsonTemplateFile(item, "runtime/state.json");
    assert.equal(state.turnCount, 0);
    assert.equal(state.lastScene, "");
    assert.equal(state.lastInput, "");
    assert.deepEqual(state.engineState, {});
  }
});

test("blank templates do not include story, tutorial, secret, hidden, or local path payloads", () => {
  const forbidden = [
    /hiddenTruth/i,
    /gm_only/i,
    /system_only/i,
    /api.?key/i,
    /secret/i,
    /token/i,
    /authorization/i,
    /tutorial/i,
    /onboarding/i,
    /demo/i,
    /\b[A-Za-z]:\\/,
    /\/(?:Users|home|var|tmp)\//
  ];

  for (const item of blankExamples) {
    const templateDir = join(root, "defaults", "examples", item.path);
    const payload = item.files.map((relPath) => readFileSync(join(templateDir, relPath), "utf8")).join("\n");
    for (const pattern of forbidden) {
      assert.doesNotMatch(payload, pattern, `${item.id} matched ${pattern}`);
    }
  }
});

test("playable demo files are original content and avoid secrets or local paths", () => {
  const forbidden = [
    /hiddenTruth/i,
    /gm_only/i,
    /api.?key/i,
    /secret/i,
    /token/i,
    /authorization/i,
    /\b[A-Za-z]:\\/,
    /\/(?:Users|home|var|tmp)\//
  ];

  for (const item of demoExamples) {
    const templateDir = join(root, "defaults", "examples", item.path);
    const payload = item.files.map((relPath) => readFileSync(join(templateDir, relPath), "utf8")).join("\n");
    assert.match(payload, /云上蒸汽城/);
    assert.match(payload, /雾铃塔/);
    for (const pattern of forbidden) {
      assert.doesNotMatch(payload, pattern, `${item.id} matched ${pattern}`);
    }
  }
});
