import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { ensureDir, readJsonSync, withFileLock, writeJson } from "../fs-utils.js";

/**
 * Recoverable multi-file JSON transaction coordinator.
 *
 * The durable journal contains the complete desired state before any target is
 * replaced. A crash can therefore leave only the old state or a recoverable
 * mixed state; `recover()` deterministically rolls the whole transaction
 * forward on the next start.
 */
export function createJsonFileTransaction({ journalPath, faultInjector = null } = {}) {
  if (!journalPath) throw new TypeError("journalPath is required");
  const journal = resolve(journalPath);
  const transactionLock = `${journal}.lock`;

  async function inject(stage, context = {}) {
    if (typeof faultInjector === "function") await faultInjector(stage, context);
  }

  function validateEntries(entries) {
    if (!Array.isArray(entries) || entries.length === 0) throw new TypeError("transaction entries are required");
    return entries.map((entry) => {
      if (!entry?.path) throw new TypeError("transaction entry path is required");
      return { path: resolve(entry.path), data: entry.data };
    });
  }

  async function applyJournal(payload) {
    const entries = validateEntries(payload?.entries);
    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      await inject("before-target-write", { index, entry, transactionId: payload.id });
      await writeJson(entry.path, entry.data);
      await inject("after-target-write", { index, entry, transactionId: payload.id });
    }
    await inject("before-journal-remove", { transactionId: payload.id });
    await rm(journal, { force: true });
  }

  async function recoverUnlocked() {
    if (!existsSync(journal)) return { recovered: false };
    const payload = readJsonSync(journal, null);
    if (!payload?.id || !Array.isArray(payload.entries)) {
      throw new Error(`Invalid JSON transaction journal: ${journal}`);
    }
    await applyJournal(payload);
    return { recovered: true, transactionId: payload.id };
  }

  async function recover() {
    ensureDir(dirname(journal));
    return withFileLock(transactionLock, recoverUnlocked);
  }

  async function transact(buildPlan) {
    ensureDir(dirname(journal));
    return withFileLock(transactionLock, async () => {
      await recoverUnlocked();
      const plan = typeof buildPlan === "function" ? await buildPlan() : buildPlan;
      const rawEntries = plan?.entries || plan;
      if (Array.isArray(rawEntries) && rawEntries.length === 0) return plan?.result;
      const entries = validateEntries(rawEntries);
      const payload = {
        version: 1,
        id: `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        createdAt: new Date().toISOString(),
        entries
      };
      await writeJson(journal, payload);
      await inject("after-journal-write", { transactionId: payload.id });
      await applyJournal(payload);
      return plan?.result;
    });
  }

  return { journalPath: journal, recover, transact };
}
