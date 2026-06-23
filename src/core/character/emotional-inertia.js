import { join } from "node:path";
import { readJson, writeJson } from "../../server/fs-utils.js";
import { validateInertiaShift } from "./emotional-inertia-policy.js";

const filePath = (root) => join(root, "runtime", "character-inertia.json");
export async function readCharacterInertia(projectRoot) { const data = await readJson(filePath(projectRoot), { version: 1, characters: {} }); return { version: 1, characters: {}, ...data, characters: data?.characters || {} }; }
export async function updateCharacterInertia(projectRoot, characterId, patch = {}, context = {}) {
  const data = await readCharacterInertia(projectRoot); const current = data.characters[characterId] || { toward: context.toward || "protagonist" };
  const validation = validateInertiaShift(current, patch);
  const next = { ...current, ...validation.accepted, lastShiftReason: context.reason || current.lastShiftReason || "", lastUpdatedSceneId: context.sceneId || current.lastUpdatedSceneId || null, lastUpdatedTurn: context.turn ?? current.lastUpdatedTurn ?? null };
  data.characters[characterId] = next; await writeJson(filePath(projectRoot), data);
  return { character: next, ...validation, requiresProposalForLongTerm: true };
}
