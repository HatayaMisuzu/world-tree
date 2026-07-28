import { existsSync } from "node:fs";
import { open, readdir, rm } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";

import {
  appendJsonlBatch,
  ensureDir,
  readJsonSync,
  syncDirectory,
  withFileLock,
  writeJson
} from "../fs-utils.js";

const JOURNAL_VERSION = 1;

function normalizeOperations(operations = []) {
  if (!Array.isArray(operations) || operations.length === 0) {
    throw new TypeError("turn transaction operations are required");
  }
  return operations.map((operation, index) => {
    const path = resolve(operation?.path || "");
    if (!operation?.path) throw new TypeError(`turn transaction operation ${index} requires a path`);
    if (operation.type === "json") return { type: "json", path, data: operation.data, label: operation.label || `json-${index}` };
    if (operation.type === "jsonl") {
      if (!Array.isArray(operation.records) || operation.records.length === 0) {
        throw new TypeError(`turn transaction JSONL operation ${index} requires records`);
      }
      return { type: "jsonl", path, records: operation.records, label: operation.label || `jsonl-${index}` };
    }
    throw new TypeError(`unsupported turn transaction operation type: ${operation?.type}`);
  });
}

async function fileLength(path) {
  if (!existsSync(path)) return 0;
  const handle = await open(path, "r");
  try {
    return (await handle.stat()).size;
  } finally {
    await handle.close();
  }
}

export function createTurnTransaction({ journalPath, faultInjector = null } = {}) {
  if (!journalPath) throw new TypeError("journalPath is required");
  const journal = resolve(journalPath);
  const lockPath = `${journal}.lock`;

  async function inject(stage, context = {}) {
    if (typeof faultInjector === "function") await faultInjector(stage, context);
  }

  async function captureBefore(operation) {
    const existed = existsSync(operation.path);
    if (operation.type === "json") {
      return { existed, data: existed ? readJsonSync(operation.path, null) : null };
    }
    return { existed, length: await fileLength(operation.path) };
  }

  async function rollback(payload) {
    for (const operation of [...payload.operations].reverse()) {
      const before = operation.before || { existed: false };
      if (operation.type === "jsonl") {
        if (before.existed) {
          const handle = await open(operation.path, "r+");
          try {
            await handle.truncate(Number(before.length || 0));
            await handle.sync();
          } finally {
            await handle.close();
          }
        } else {
          await rm(operation.path, { force: true });
          if (existsSync(dirname(operation.path))) await syncDirectory(dirname(operation.path));
        }
      } else if (before.existed) {
        await writeJson(operation.path, before.data);
      } else {
        await rm(operation.path, { force: true });
        if (existsSync(dirname(operation.path))) await syncDirectory(dirname(operation.path));
      }
    }
  }

  async function recoverUnlocked() {
    if (!existsSync(journal)) return { recovered: false };
    const payload = readJsonSync(journal, null);
    if (!payload || payload.version !== JOURNAL_VERSION || !payload.id || !Array.isArray(payload.operations)) {
      const error = new Error(`Invalid turn transaction journal: ${journal}`);
      error.code = "TURN_TRANSACTION_JOURNAL_INVALID";
      throw error;
    }
    if (payload.status !== "committed") {
      await rollback(payload);
    }
    await rm(journal, { force: true });
    await syncDirectory(dirname(journal));
    return {
      recovered: true,
      transactionId: payload.id,
      action: payload.status === "committed" ? "cleanup" : "rollback"
    };
  }

  async function recover() {
    ensureDir(dirname(journal));
    return withFileLock(lockPath, recoverUnlocked);
  }

  async function transact({ id, operations, result = null } = {}) {
    ensureDir(dirname(journal));
    return withFileLock(lockPath, async () => {
      await recoverUnlocked();
      const normalized = normalizeOperations(operations);
      const prepared = [];
      for (const operation of normalized) {
        prepared.push({ ...operation, before: await captureBefore(operation) });
      }
      const payload = {
        version: JOURNAL_VERSION,
        id: String(id || `${process.pid}-${Date.now()}`),
        status: "prepared",
        createdAt: new Date().toISOString(),
        operations: prepared
      };
      await writeJson(journal, payload);
      await inject("after-journal", { transactionId: payload.id, payload });

      try {
        payload.status = "applying";
        await writeJson(journal, payload);
        for (let index = 0; index < prepared.length; index += 1) {
          const operation = prepared[index];
          if (operation.type === "json") await writeJson(operation.path, operation.data);
          else await appendJsonlBatch(operation.path, operation.records);
          await inject(`after-${operation.label}`, { transactionId: payload.id, index, operation });
        }
        payload.status = "committed";
        payload.committedAt = new Date().toISOString();
        await writeJson(journal, payload);
        await inject("after-commit-marker", { transactionId: payload.id, payload });
        await rm(journal, { force: true });
        await syncDirectory(dirname(journal));
        return result;
      } catch (error) {
        if (!error?.simulateCrash && payload.status !== "committed") {
          await rollback(payload);
          await rm(journal, { force: true });
          await syncDirectory(dirname(journal));
        }
        throw error;
      }
    });
  }

  return { journalPath: journal, recover, transact };
}

export async function recoverTurnTransactionsUnderRoot(rootPath, { maxDirectories = 10000 } = {}) {
  if (!rootPath || !existsSync(rootPath)) return { scannedDirectories: 0, recoveries: [] };
  const root = resolve(rootPath);
  const recoveries = [];
  let scannedDirectories = 0;

  async function walk(directory) {
    if (scannedDirectories >= maxDirectories) {
      const error = new Error(`turn transaction recovery scan exceeded ${maxDirectories} directories`);
      error.code = "TURN_TRANSACTION_RECOVERY_SCAN_LIMIT";
      throw error;
    }
    scannedDirectories += 1;
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(path);
      } else if (entry.isFile() && entry.name === "turn.json" && basename(directory) === "transactions") {
        const result = await createTurnTransaction({ journalPath: path }).recover();
        if (result.recovered) recoveries.push({ journalPath: path, ...result });
      }
    }
  }

  await walk(root);
  return { scannedDirectories, recoveries };
}
