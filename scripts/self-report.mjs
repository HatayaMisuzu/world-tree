import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { mkdir, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = resolve(".");
const dataDir = resolve(process.env.WT_SELF_REPORT_DATA_DIR || join(root, "data"));
const reportDir = resolve(process.env.WT_SELF_REPORT_DIR || join(root, "docs", "reports"));

async function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await walk(path, out);
    else out.push(path);
  }
  return out;
}

function readJsonl(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map(line => {
      try { return JSON.parse(line); } catch { return null; }
    })
    .filter(Boolean);
}

function summarizeUsage(records) {
  return records.reduce((acc, record) => {
    const usage = record.usage || record;
    acc.records += 1;
    acc.promptTokens += Number(usageValue(usage, "promptTokens") || 0);
    acc.completionTokens += Number(usageValue(usage, "completionTokens") || 0);
    acc.totalTokens += Number(usageValue(usage, "totalTokens") || 0);
    acc.cacheHitTokens += Number(usageValue(usage, "cacheHitTokens") || 0);
    acc.cacheMissTokens += Number(usageValue(usage, "cacheMissTokens") || 0);
    acc.reasoningTokens += Number(usageValue(usage, "reasoningTokens") || 0);
    if (record.provider) acc.providers.add(String(record.provider));
    if (record.model) acc.models.add(String(record.model));
    return acc;
  }, { records: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, cacheHitTokens: 0, cacheMissTokens: 0, reasoningTokens: 0, providers: new Set(), models: new Set() });
}

function usageValue(usage = {}, key = "") {
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

await mkdir(reportDir, { recursive: true });

const files = await walk(dataDir);
const chatFiles = files.filter(file => file.endsWith(`${join("runtime", "chat.jsonl")}`) || file.endsWith("chat.jsonl"));
const usageFiles = files.filter(file => file.endsWith(`${join("runtime", "usage.jsonl")}`) || file.endsWith("usage.jsonl"));
const chatRecords = chatFiles.flatMap(readJsonl);
const usageRecords = usageFiles.flatMap(readJsonl);
const usage = summarizeUsage(usageRecords);
const assistantTurns = chatRecords.filter(record => record.role === "assistant").length;
const userTurns = chatRecords.filter(record => record.role === "user").length;

const report = {
  status: "PASS",
  anonymized: true,
  dataDirPresent: existsSync(dataDir),
  files: {
    chatJsonl: chatFiles.length,
    usageJsonl: usageFiles.length
  },
  chat: {
    records: chatRecords.length,
    userTurns,
    assistantTurns
  },
  usage: {
    records: usage.records,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    totalTokens: usage.totalTokens,
    cacheHitTokens: usage.cacheHitTokens,
    cacheMissTokens: usage.cacheMissTokens,
    reasoningTokens: usage.reasoningTokens,
    providers: [...usage.providers].sort(),
    models: [...usage.models].sort()
  },
  redaction: "No prompt, response, user path, secret, or unique project id is included.",
  generatedAt: new Date().toISOString()
};

writeFileSync(join(reportDir, "self-report-latest.json"), JSON.stringify(report, null, 2), "utf8");
writeFileSync(join(reportDir, "self-report-latest.md"), [
  "# Anonymous Self Report",
  "",
  `Status: ${report.status}`,
  `Generated: ${report.generatedAt}`,
  "",
  `- chat records: ${report.chat.records}`,
  `- user turns: ${report.chat.userTurns}`,
  `- assistant turns: ${report.chat.assistantTurns}`,
  `- usage records: ${report.usage.records}`,
  `- total tokens: ${report.usage.totalTokens}`,
  `- cache hit tokens: ${report.usage.cacheHitTokens}`,
  `- reasoning tokens: ${report.usage.reasoningTokens}`,
  `- providers: ${report.usage.providers.join(", ") || "none"}`,
  "",
  report.redaction
].join("\n") + "\n", "utf8");

console.log(JSON.stringify(report, null, 2));
