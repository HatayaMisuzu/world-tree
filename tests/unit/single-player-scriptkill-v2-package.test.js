import test from "node:test";
import assert from "node:assert/strict";
import { createSinglePlayerScriptKillPackage, validateSinglePlayerScriptKillPackage, extractSinglePlayerScriptKillPlayerPackageView } from "../../src/core/single-player-scriptkill/single-player-scriptkill-package.js";
import fixture from "../fixtures/single-player-scriptkill-v2/ready-package.json" with { type: "json" };

test("Single Player ScriptKill V2 package validates ready imported script", () => {
  const pkg = createSinglePlayerScriptKillPackage(fixture);
  const validation = validateSinglePlayerScriptKillPackage(pkg);
  assert.equal(validation.ok, true, validation.errors.join("; "));
  assert.equal(validation.playable, true, validation.warnings.join("; "));
  assert.equal(pkg.entryDisplayName, "单人剧本杀");
  assert.equal(pkg.moduleLayerBoundary.entryOwnedCore.includes("single-player-scriptkill"), true);
});

test("player package view hides dmBook and full truth", () => {
  const pkg = createSinglePlayerScriptKillPackage(fixture);
  const view = extractSinglePlayerScriptKillPlayerPackageView(pkg, "role_doctor");
  assert.equal(view.selectedRole.roleName, "沈医生");
  assert.equal(view.dmBook, undefined);
  assert.equal(view.fullTruth, undefined);
  assert.ok(!JSON.stringify(view).includes("真正凶手"));
});

test("missing ownership or DM book is not playable", () => {
  const pkg = createSinglePlayerScriptKillPackage({ title: "bad", roleBooks: [{ roleName: "A" }, { roleName: "B" }], clueCards: [{ title: "x", visibleText: "x" }], phases: [{ title: "读本" }] });
  const validation = validateSinglePlayerScriptKillPackage(pkg);
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.some(e => e.includes("ownership")));
  assert.ok(validation.errors.some(e => e.includes("dmBook")));
});
