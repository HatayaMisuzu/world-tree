// Reusable Scriptplay Spoiler Guard
// Prevents OOC/meta/DM-book leakage in role-play style entries.

const META_PATTERNS = [
  /\bAI\b/i, /模型/, /系统提示/, /prompt/i, /token/i, /API/i,
  /作为(一个)?(玩家代理|模拟玩家|AI玩家)/,
  /我的剧本写着/, /DM手册/, /主持人手册/, /根据设定/, /完整真相/, /复盘答案/
];

export function scanScriptplaySpoilers(text = "", context = {}) {
  const value = String(text || "");
  const findings = [];
  for (const pattern of META_PATTERNS) {
    if (pattern.test(value)) findings.push({ type: "meta_or_ooc", pattern: String(pattern), severity: "high" });
  }
  for (const forbidden of context.forbiddenTerms || []) {
    if (forbidden && value.includes(forbidden)) findings.push({ type: "forbidden_term", term: forbidden, severity: "high" });
  }
  for (const secret of context.secretSnippets || []) {
    const snippet = String(secret || "").slice(0, 24);
    if (snippet && value.includes(snippet)) findings.push({ type: "secret_snippet", snippet, severity: "critical" });
  }
  return { ok: !findings.some(f => ["high", "critical"].includes(f.severity)), findings };
}

export function sanitizeImmersiveSpeech(text = "") {
  return String(text || "")
    .replace(/我是(一个)?AI玩家/g, "我")
    .replace(/作为(一个)?模拟玩家/g, "")
    .replace(/根据DM手册[^。！？]*/g, "我记得")
    .replace(/根据我的剧本[^。！？]*/g, "我印象里")
    .trim();
}
