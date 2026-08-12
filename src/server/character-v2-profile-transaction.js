import { existsSync, readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

import { syncDirectory, withFileLock, writeJson } from "./fs-utils.js";

export const CHARACTER_PROFILE_JOURNAL = ".character-profile-transaction.json";
const ALLOWED_TARGETS = new Set([
  "card.json",
  "v2/capsule.manifest.json",
  "v2/profile.wt-character.json",
  "v2/runtime-contract.json",
  "v2/cognition-boundary.json",
  "v2/performance-fingerprint.json",
  "v2/relationship.seed.json",
  "v2/ui-summary.json"
]);

function transactionError(code, message, cause) {
  const error = new Error(message, cause ? { cause } : undefined);
  error.code = code;
  return error;
}

function readJsonStrict(filePath, code) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch (cause) {
    throw transactionError(code, `${basename(filePath)} is corrupt`, cause);
  }
}

async function removeDurable(filePath) {
  await rm(filePath, { force: true });
  await syncDirectory(dirname(filePath));
}

async function restoreOriginals(capsuleRoot, originals) {
  for (const [relativePath, original] of Object.entries(originals || {})) {
    if (!ALLOWED_TARGETS.has(relativePath)) throw transactionError("CHARACTER_PROFILE_JOURNAL_CORRUPT", `journal target is not allowed: ${relativePath}`);
    const target = join(capsuleRoot, relativePath);
    if (original?.existed) await writeJson(target, original.value);
    else await removeDurable(target);
  }
}

export async function recoverCharacterProfileTransaction(v2Dir) {
  const journalPath = join(v2Dir, CHARACTER_PROFILE_JOURNAL);
  if (!existsSync(journalPath)) return { recovered: false };
  const journal = readJsonStrict(journalPath, "CHARACTER_PROFILE_JOURNAL_CORRUPT");
  if (journal?.schemaVersion !== 1 || !["prepared", "committed"].includes(journal.status) || !journal.originals) {
    throw transactionError("CHARACTER_PROFILE_JOURNAL_CORRUPT", `${CHARACTER_PROFILE_JOURNAL} has an invalid schema`);
  }
  if (Object.keys(journal.originals).some((relativePath) => !ALLOWED_TARGETS.has(relativePath))) {
    throw transactionError("CHARACTER_PROFILE_JOURNAL_CORRUPT", `${CHARACTER_PROFILE_JOURNAL} contains an invalid target`);
  }
  if (journal.status === "prepared") await restoreOriginals(dirname(v2Dir), journal.originals);
  await removeDurable(journalPath);
  return { recovered: true, action: journal.status === "prepared" ? "rolled_back" : "cleaned_committed" };
}

export async function withCharacterProfileRecovery(v2Dir, operation) {
  return withFileLock(join(v2Dir, ".character-profile-transaction.lock"), async () => {
    await recoverCharacterProfileTransaction(v2Dir);
    return operation();
  });
}

export async function commitCharacterProfileTransaction(capsuleRoot, updates, { faultInjector = null } = {}) {
  const journalPath = join(capsuleRoot, "v2", CHARACTER_PROFILE_JOURNAL);
  const originals = {};
  for (const relativePath of Object.keys(updates)) {
    if (!ALLOWED_TARGETS.has(relativePath)) throw transactionError("CHARACTER_PROFILE_SAVE_FAILED", `transaction target is not allowed: ${relativePath}`);
    const target = join(capsuleRoot, relativePath);
    originals[relativePath] = existsSync(target)
      ? { existed: true, value: readJsonStrict(target, "CHARACTER_PROFILE_SOURCE_CORRUPT") }
      : { existed: false, value: null };
  }
  const journal = { schemaVersion: 1, status: "prepared", originals };
  await writeJson(journalPath, journal);
  try {
    let index = 0;
    for (const [relativePath, value] of Object.entries(updates)) {
      index += 1;
      if (typeof faultInjector === "function") await faultInjector("before-write", { index, relativePath });
      await writeJson(join(capsuleRoot, relativePath), value);
      if (typeof faultInjector === "function") await faultInjector("after-write", { index, relativePath });
    }
    await writeJson(journalPath, { ...journal, status: "committed" });
    await removeDurable(journalPath).catch(() => {
      // A committed journal is safe to leave behind; the next load removes it without rollback.
    });
  } catch (cause) {
    try {
      await restoreOriginals(capsuleRoot, originals);
      await removeDurable(journalPath);
    } catch (rollbackCause) {
      throw transactionError("CHARACTER_PROFILE_SAVE_FAILED", "Character profile save and rollback failed; recovery journal retained", rollbackCause);
    }
    throw transactionError("CHARACTER_PROFILE_SAVE_FAILED", "Character profile save failed and was rolled back", cause);
  }
}
