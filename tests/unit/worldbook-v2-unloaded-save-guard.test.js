import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// H4: browser/controllers/entry-controller.js handleWorldbookV2Action runs in a
// browser global scope; extract it and execute it against stubbed globals.
const source = readFileSync(new URL("../../browser/controllers/entry-controller.js", import.meta.url), "utf8");
const startIdx = source.indexOf("async function handleWorldbookV2Action(");
const endIdx = source.indexOf("\n}\n", startIdx);
assert.ok(startIdx >= 0 && endIdx > startIdx, "handleWorldbookV2Action not found");
const fnSource = source.slice(startIdx, endIdx + 2);

const EXISTING = [
  { entryId: "e1", id: "e1", title: "A", content: "a", enabled: true },
  { entryId: "e2", id: "e2", title: "B", content: "b", enabled: true },
];

function makeEnv({ loadFails = false } = {}) {
  const saves = [];
  const fields = { "#worldbookV2Title": { value: "New" }, "#worldbookV2Content": { value: "new content" }, "#worldbookV2Keys": { value: "k" }, "#worldbookV2Enabled": { checked: true }, "#worldbookV2AlwaysOn": { checked: false } };
  const ctx = {
    AS: { worldbookV2: { loaded: null }, selectedModule: { id: "world-1", type: "world" }, worldbookEntries: [] },
    U: { qs: (sel) => fields[sel] || null },
    API: {
      worldbookV2Load: async () => { if (loadFails) throw new Error("offline"); return { status: "ok", entries: structuredClone(EXISTING) }; },
      worldbookV2Save: async ({ entries }) => { saves.push(structuredClone(entries)); return { status: "ok", entries }; },
    },
    createToast: () => {}, render: () => {}, confirm: () => true, buildWorldbookV2EntryFromText: () => ({}),
    structuredClone, Date, Number, String, Error, console,
  };
  vm.createContext(ctx);
  vm.runInContext(`${fnSource}\nthis.handleWorldbookV2Action = handleWorldbookV2Action;`, ctx);
  return { ctx, saves, s: ctx.AS.worldbookV2 };
}
const btnFor = (id) => ({ closest: () => ({ dataset: { worldbookV2Id: id } }) });

test("H4: saving a new entry from an unloaded panel keeps existing entries", async () => {
  const { ctx, saves, s } = makeEnv();
  s.editingId = "__new__";
  await ctx.handleWorldbookV2Action("worldbook-v2-save-entry", null);
  assert.equal(s.error, "");
  assert.equal(saves.length, 1);
  assert.deepEqual(saves[0].map((e) => e.title), ["A", "B", "New"]);
});

test("H4: new -> save flow from an unloaded panel keeps existing entries", async () => {
  const { ctx, saves, s } = makeEnv();
  await ctx.handleWorldbookV2Action("worldbook-v2-new", null);
  assert.ok(s.loaded);
  await ctx.handleWorldbookV2Action("worldbook-v2-save-entry", null);
  assert.deepEqual(saves[0].map((e) => e.title), ["A", "B", "New"]);
});

test("H4: toggle/delete from an unloaded panel keep the other entries", async () => {
  let env = makeEnv();
  await env.ctx.handleWorldbookV2Action("worldbook-v2-toggle", btnFor("e1"));
  assert.deepEqual(env.saves[0].map((e) => [e.id, e.enabled]), [["e1", false], ["e2", true]]);
  env = makeEnv();
  await env.ctx.handleWorldbookV2Action("worldbook-v2-delete", btnFor("e1"));
  assert.deepEqual(env.saves[0].map((e) => e.id), ["e2"]);
});

test("H4: if loading fails, save is aborted and nothing is overwritten", async () => {
  const { ctx, saves, s } = makeEnv({ loadFails: true });
  s.editingId = "__new__";
  await ctx.handleWorldbookV2Action("worldbook-v2-save-entry", null);
  assert.equal(saves.length, 0);
  assert.match(s.error, /加载失败/);
});
