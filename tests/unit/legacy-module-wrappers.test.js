import test from "node:test";
import assert from "node:assert/strict";

import { MODULE_STATUS } from "../../src/core/modules/module-contract.js";
import { MODULE_MANIFEST } from "../../src/core/modules/module-manifest.js";
import { getModuleGraph } from "../../src/core/modules/module-registry.js";
import { loadModuleWrapper, loadWrappersForMode } from "../../src/core/modules/module-loader.js";
import {
  getModuleWrapper,
  listModuleWrappers,
  listWrapperHooks
} from "../../src/core/modules/wrappers/index.js";

const P1_MODULES = Object.freeze({
  "core.world_container": "M1",
  "lore.worldbook_trigger": "M2",
  "core.dynamic_state": "M3",
  "entity.relationship_network": "M6",
  "character.preset": "M8",
  "character.cognition": "M9",
  "scene.session": "M11",
  "narrative.story_template": "M12",
  "narrative.five_layer_engine": "M13",
  "rule.world_rule": "M15",
  "audit.narrative_quality": "M15c",
  "character.card_runtime": "M19",
  "creation.alchemy": "M-创作",
  "scope.proximity": null,
  "tracking.world_events": null,
  "scene.summary_chain": null,
  "content.impact_gate": null,
  "context.engine": null,
  "character.emotional_inertia": null,
  "narrative.director_layer": null,
  "lore.worldbook_growth_tree": null,
  "world.profile_overlay": null,
  "timeline.branch_tree": null,
  "world.telemetry": null,
  "system.auto_advance": null,
  "processing.completion_engine": null
});

test("wrapper registry exposes standardized legacy and P0 modules", () => {
  const wrappers = listModuleWrappers();
  assert.equal(wrappers.length, 26);
  assert.deepEqual(new Set(wrappers.map((wrapper) => wrapper.id)), new Set(Object.keys(P1_MODULES)));
  assert.equal(getModuleWrapper("lore.worldbook_trigger")?.legacyId, "M2");
  assert.equal(loadModuleWrapper("lore.worldbook_trigger")?.id, "lore.worldbook_trigger");
  assert.equal(loadModuleWrapper("not.registered"), null);
});

test("every P1 wrapper implements defensive context, prompt, and debug hooks", () => {
  for (const wrapper of listModuleWrappers()) {
    assert.equal(wrapper.legacyId, P1_MODULES[wrapper.id]);
    assert.equal(wrapper.status, wrapper.legacyId ? MODULE_STATUS.LEGACY_WRAPPED : MODULE_STATUS.IMPLEMENTED);
    for (const hook of ["buildContext", "buildPromptBlock", "getDebugInfo"]) {
      assert.equal(typeof wrapper[hook], "function", `${wrapper.id}.${hook}`);
      assert.ok(listWrapperHooks(wrapper.id).includes(hook));
    }
    assert.doesNotThrow(() => wrapper.buildContext({}));
    const context = wrapper.buildContext({});
    assert.equal(typeof context, "object");
    assert.equal(typeof context.ok, "boolean");
    assert.equal(context.moduleId, wrapper.id);
    assert.equal(context.legacyId, wrapper.legacyId);
    assert.ok(Array.isArray(context.warnings));

    assert.doesNotThrow(() => wrapper.buildPromptBlock({}));
    const prompt = wrapper.buildPromptBlock({});
    assert.equal(typeof prompt, "string");
    assert.ok(prompt.length > 0);
    assert.ok(prompt.length <= 1200);

    assert.doesNotThrow(() => wrapper.getDebugInfo({}));
    const debug = wrapper.getDebugInfo({});
    assert.equal(typeof debug, "object");
    assert.equal(debug.id, wrapper.id);
    assert.ok(Array.isArray(debug.warnings));
  }
});

test("wrapper prompts and debug summaries scrub local paths and secrets", () => {
  const unsafeContext = {
    model: {
      selected: { id: "unsafe", name: "C:\\Users\\Alice\\private\\world.json", branch: "main" },
      moduleData: { runtime: {}, characters: [], scenes: [], worldbook: { entries: [] } }
    },
    input: "apiKey=sk-1234567890abcdef",
    options: { sourceType: "D:\\private\\source.txt" }
  };
  for (const wrapper of listModuleWrappers()) {
    const text = `${wrapper.buildPromptBlock(unsafeContext)}\n${JSON.stringify(wrapper.getDebugInfo(unsafeContext))}`;
    assert.doesNotMatch(text, /[A-Za-z]:\\/);
    assert.doesNotMatch(text, /sk-1234567890abcdef/);
  }
});

test("real legacy functions are reused through focused wrapper summaries", () => {
  const worldbook = getModuleWrapper("lore.worldbook_trigger").buildContext({
    input: "玻璃城",
    worldbookState: { entries: [{ id: "glass", title: "玻璃城", keys: ["玻璃城"], content: "风暴中的城市" }] }
  });
  assert.equal(worldbook.ok, true);
  assert.equal(worldbook.data.selectedCount, 1);

  const cognition = getModuleWrapper("character.cognition").buildContext({
    cards: [{ name: "档案员", personality: "冷静", first_mes: "欢迎", deepTraits: "害怕遗忘", emotionGradients: { highTensionDialogue: "柔和" } }],
    engineState: { emotionState: { tension: 8 } }
  });
  assert.equal(cognition.data.cardDetected, true);
  assert.equal(cognition.data.deepLayerAvailable, true);

  const audit = getModuleWrapper("audit.narrative_quality").validateOutput({
    narrative: "很短。",
    model: { selected: { id: "demo" }, moduleData: { characters: [] } }
  });
  assert.equal(audit.ok, true);
  assert.equal(audit.data.audited, true);
});

test("mode loader returns available wrappers without treating gaps as fatal", () => {
  const quick = loadWrappersForMode("quick-setting");
  const quickIds = quick.wrappers.map((wrapper) => wrapper.id);
  for (const id of ["core.world_container", "lore.worldbook_trigger", "core.dynamic_state", "scene.session", "audit.narrative_quality", "narrative.story_template", "narrative.five_layer_engine"]) {
    assert.ok(quickIds.includes(id), `quick-setting missing ${id}`);
  }
  // quick-setting now has wrappers for all 7 declared modules; no missing wrappers expected
  assert.equal(quick.missingWrappers.length, 0);

  const character = loadWrappersForMode("character");
  const characterIds = character.wrappers.map((wrapper) => wrapper.id);
  for (const id of ["character.preset", "character.cognition", "character.card_runtime"]) {
    assert.ok(characterIds.includes(id), `character missing ${id}`);
  }
  assert.ok(Array.isArray(character.warnings));
});

test("module graph reports real wrapper availability, callable state, and hooks", () => {
  const graph = getModuleGraph(["lore.worldbook_trigger", "rpg.quest"]);
  const wrapped = graph.modules.find((module) => module.id === "lore.worldbook_trigger");
  assert.equal(wrapped.hasWrapper, true);
  assert.equal(wrapped.callable, true);
  assert.ok(wrapped.hooks.includes("buildContext"));
  assert.ok(wrapped.hooks.includes("buildPromptBlock"));
  assert.ok(wrapped.hooks.includes("getDebugInfo"));

  const unwrapped = graph.modules.find((module) => module.id === "rpg.quest");
  assert.equal(unwrapped.hasWrapper, false);
  assert.equal(unwrapped.callable, false);
  assert.deepEqual(unwrapped.hooks, []);
});

test("P1 manifest status and capabilities agree with wrapper existence", () => {
  for (const [id, legacyId] of Object.entries(P1_MODULES)) {
    const definition = MODULE_MANIFEST[id];
    assert.equal(definition.legacyId, legacyId);
    assert.equal(definition.status, legacyId ? MODULE_STATUS.LEGACY_WRAPPED : MODULE_STATUS.IMPLEMENTED);
    assert.ok(getModuleWrapper(id), `${id} wrapper missing`);
    for (const hook of ["buildContext", "buildPromptBlock", "getDebugInfo"]) {
      assert.ok(definition.capabilities.includes(hook), `${id} manifest missing ${hook}`);
    }
  }
});
