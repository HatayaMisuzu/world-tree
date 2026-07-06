import { appendFile, readFile } from "node:fs/promises";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

export function summarizeUsageRecords(records = [], pricing = {}) {
  const stages = Array.isArray(records) ? records : [];
  const promptTokens = sum(stages, "promptTokens");
  const completionTokens = sum(stages, "completionTokens");
  const totalTokens = sum(stages, "totalTokens") || promptTokens + completionTokens;
  const yuanPerMillion = Number(pricing.yuanPerMillionTokens || pricing.cnyPerMillionTokens || 0);
  const estimatedCostCny = yuanPerMillion > 0 ? Number(((totalTokens / 1_000_000) * yuanPerMillion).toFixed(6)) : 0;
  return { promptTokens, completionTokens, totalTokens, estimatedCostCny, stageCount: stages.length };
}

export async function appendUsageRecord(filePath, record) {
  if (!filePath) return null;
  mkdirSync(dirname(filePath), { recursive: true });
  await appendFile(filePath, `${JSON.stringify(record)}\n`, "utf8");
  return record;
}

export async function readUsageSummary(filePath) {
  if (!filePath || !existsSync(filePath)) return { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCostCny: 0, turnCount: 0 };
  const text = await readFile(filePath, "utf8");
  const records = text.split(/\r?\n/).filter(Boolean).map((line) => {
    try { return JSON.parse(line); } catch { return null; }
  }).filter(Boolean);
  const flat = records.flatMap((record) => record.stages || []);
  return { ...summarizeUsageRecords(flat), turnCount: records.length };
}

function sum(records, key) {
  return records.reduce((total, record) => total + Number(record?.usage?.[key] || record?.[key] || 0), 0);
}
