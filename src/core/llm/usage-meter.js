import { appendFile, readFile } from "node:fs/promises";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

export function summarizeUsageRecords(records = [], pricing = {}) {
  const stages = Array.isArray(records) ? records : [];
  const promptTokens = sum(stages, "promptTokens");
  const completionTokens = sum(stages, "completionTokens");
  const totalTokens = sum(stages, "totalTokens") || promptTokens + completionTokens;
  const cacheHitTokens = sum(stages, "cacheHitTokens");
  const cacheMissTokens = sum(stages, "cacheMissTokens");
  const reasoningTokens = sum(stages, "reasoningTokens");
  const yuanPerMillion = Number(pricing.yuanPerMillionTokens || pricing.cnyPerMillionTokens || 0);
  const estimatedCostCny = yuanPerMillion > 0 ? Number(((totalTokens / 1_000_000) * yuanPerMillion).toFixed(6)) : 0;
  return { promptTokens, completionTokens, totalTokens, cacheHitTokens, cacheMissTokens, reasoningTokens, estimatedCostCny, stageCount: stages.length };
}

export async function appendUsageRecord(filePath, record) {
  if (!filePath) return null;
  mkdirSync(dirname(filePath), { recursive: true });
  await appendFile(filePath, `${JSON.stringify(record)}\n`, "utf8");
  return record;
}

export async function readUsageSummary(filePath) {
  if (!filePath || !existsSync(filePath)) return { promptTokens: 0, completionTokens: 0, totalTokens: 0, cacheHitTokens: 0, cacheMissTokens: 0, reasoningTokens: 0, estimatedCostCny: 0, turnCount: 0 };
  const text = await readFile(filePath, "utf8");
  const records = text.split(/\r?\n/).filter(Boolean).map((line) => {
    try { return JSON.parse(line); } catch { return null; }
  }).filter(Boolean);
  const flat = records.flatMap((record) => record.stages || []);
  return { ...summarizeUsageRecords(flat), turnCount: records.length };
}

function sum(records, key) {
  return records.reduce((total, record) => {
    const usage = record?.usage || record || {};
    return total + Number(valueByUsageKey(usage, key) || 0);
  }, 0);
}

function valueByUsageKey(usage = {}, key = "") {
  const promptDetails = usage.prompt_tokens_details || usage.promptTokensDetails || {};
  const completionDetails = usage.completion_tokens_details || usage.completionTokensDetails || {};
  const aliases = {
    promptTokens: ["promptTokens", "prompt_tokens", "inputTokens", "input_tokens", "promptTokenCount"],
    completionTokens: ["completionTokens", "completion_tokens", "outputTokens", "output_tokens", "candidatesTokenCount"],
    totalTokens: ["totalTokens", "total_tokens", "totalTokenCount"],
    cacheHitTokens: ["cacheHitTokens", "promptCacheHitTokens", "prompt_cache_hit_tokens", "cachedTokens", "cached_tokens"],
    cacheMissTokens: ["cacheMissTokens", "promptCacheMissTokens", "prompt_cache_miss_tokens"],
    reasoningTokens: ["reasoningTokens", "reasoning_tokens"]
  };
  for (const alias of aliases[key] || [key]) {
    if (usage[alias] !== undefined) return usage[alias];
  }
  if (key === "cacheHitTokens") return promptDetails.cachedTokens ?? promptDetails.cached_tokens ?? 0;
  if (key === "reasoningTokens") return completionDetails.reasoningTokens ?? completionDetails.reasoning_tokens ?? 0;
  return 0;
}
