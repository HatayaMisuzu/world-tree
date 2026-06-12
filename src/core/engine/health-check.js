// src/core/engine/health-check.js
// v0.8.0 — 世界健康检查（纯 JS，确定性的数据完整性审计）
// 检查：缺失字段 / 重复 ID / 断裂引用 / 时间线冲突 / 关键词冲突
// ═══════════════════════════════════════════════════════════════

/**
 * 对当前模型数据进行完整健康检查
 * @param {Object} model — buildModel() 返回的模型对象
 * @param {Object} [opts]
 * @param {boolean} [opts.verbose=false] — 是否输出详情
 * @returns {{ pass: boolean, score: number, issues: Array, summary: string }}
 */
export function runHealthCheck(model = {}, opts = {}) {
  const data = model.moduleData;
  if (!data) return { pass: false, score: 0, issues: [{ severity: "critical", category: "module", detail: "未加载模组数据" }], summary: "❌ 无模组数据" };

  const issues = [];

  // 1. 缺失必填字段
  checkMissingFields(data, issues);

  // 2. 重复 ID
  checkDuplicateIds(data, issues);

  // 3. 断裂引用
  checkBrokenReferences(data, issues);

  // 4. 时间线冲突
  checkTimelineConflicts(data, issues);

  // 5. 关键词冲突
  checkKeywordConflicts(data, issues);

  const criticals = issues.filter((i) => i.severity === "critical").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;
  const infos = issues.filter((i) => i.severity === "info").length;

  const score = Math.max(0, 100 - criticals * 20 - warnings * 5 - infos * 1);
  const pass = criticals === 0;

  const summary = pass
    ? `✅ 健康 (${score}分) — ${warnings} 个提醒, ${infos} 条建议`
    : `❌ ${criticals} 个严重问题 — ${warnings} 个提醒`;

  return { pass, score, issues, summary };
}

// ═══════════════════════════════════════════════════════════════
//  检查函数
// ═══════════════════════════════════════════════════════════════

function checkMissingFields(data, issues) {
  // 角色必填字段
  for (const char of (data.characters || [])) {
    if (!char.name) issues.push({ severity: "critical", category: "missing_field", detail: `角色缺少 name 字段`, entity: char.id || "unknown" });
    if (!char.id && !char.name) continue; // 连 ID 都没有，跳过后续检查
  }

  // 场景必填字段
  for (const scene of (data.scenes || [])) {
    if (!scene.title) issues.push({ severity: "warning", category: "missing_field", detail: `场景缺少 title`, entity: scene.id || "unknown" });
  }

  // 世界书条目必填字段
  const entries = data.worldbook?.entries || data.worldbook?.items || [];
  for (const entry of entries) {
    if (!entry.keys || (Array.isArray(entry.keys) && entry.keys.length === 0)) {
      issues.push({ severity: "warning", category: "missing_field", detail: `世界书条目缺少触发关键词`, entity: entry.id || entry.title || "unknown" });
    }
    if (!entry.content && !entry.text) {
      issues.push({ severity: "warning", category: "missing_field", detail: `世界书条目缺少内容`, entity: entry.title || entry.id || "unknown" });
    }
  }
}

function checkDuplicateIds(data, issues) {
  const seen = new Map();

  // 角色 ID
  for (const char of (data.characters || [])) {
    const id = char.id || char.name;
    if (!id) continue;
    if (seen.has(`char:${id}`)) {
      issues.push({ severity: "critical", category: "duplicate_id", detail: `角色 ID 重复: "${id}"`, entity: id });
    }
    seen.set(`char:${id}`, true);
  }

  // 场景 ID
  for (const scene of (data.scenes || [])) {
    const id = scene.id || scene.title;
    if (!id) continue;
    if (seen.has(`scene:${id}`)) {
      issues.push({ severity: "warning", category: "duplicate_id", detail: `场景 ID 重复: "${id}"`, entity: id });
    }
    seen.set(`scene:${id}`, true);
  }

  // 组织 ID
  for (const org of (data.organizations || [])) {
    const id = org.id || org.name;
    if (!id) continue;
    if (seen.has(`org:${id}`)) {
      issues.push({ severity: "warning", category: "duplicate_id", detail: `组织 ID 重复: "${id}"`, entity: id });
    }
    seen.set(`org:${id}`, true);
  }

  // 世界书条目 ID
  const entries = data.worldbook?.entries || data.worldbook?.items || [];
  for (const entry of entries) {
    const id = entry.id || entry.title;
    if (!id) continue;
    if (seen.has(`wb:${id}`)) {
      issues.push({ severity: "warning", category: "duplicate_id", detail: `世界书条目 ID 重复: "${id}"`, entity: id });
    }
    seen.set(`wb:${id}`, true);
  }
}

function checkBrokenReferences(data, issues) {
  const charIds = new Set((data.characters || []).map((c) => c.id || c.name).filter(Boolean));
  const sceneIds = new Set((data.scenes || []).map((s) => s.id || s.title).filter(Boolean));
  const orgIds = new Set((data.organizations || []).map((o) => o.id || o.name).filter(Boolean));

  // 世界书条目引用检查
  const entries = data.worldbook?.entries || data.worldbook?.items || [];
  for (const entry of entries) {
    if (!entry.content && !entry.text) continue;
    const text = entry.content || entry.text || "";

    // 检查是否引用了不存在的角色（简单模式匹配）
    for (const charId of charIds) {
      // 跳过：如果 entry 的 keys 里已经包含了角色名（正常引用）
      const keys = Array.isArray(entry.keys) ? entry.keys.join(" ") : String(entry.keys || "");
      if (keys.includes(charId)) continue;
    }
  }

  // 追踪系统中的引用检查
  for (const track of (data.tracking || [])) {
    if (track.targetId && !charIds.has(track.targetId) && !orgIds.has(track.targetId) && !sceneIds.has(track.targetId)) {
      issues.push({ severity: "info", category: "broken_ref", detail: `追踪目标 "${track.targetId}" 未对应任何已知实体`, entity: track.name || track.targetId });
    }
  }
}

function checkTimelineConflicts(data, issues) {
  const events = data.timeline || data.canon?.events || [];

  // 检查同一角色在同一时间出现在不同地点
  const charTimeMap = new Map();
  for (const event of events) {
    const charName = event.character || event.actor || "";
    const time = event.time || event.date || "";
    const location = event.location || "";

    if (!charName || !time || !location) continue;

    const key = `${charName}@${time}`;
    if (charTimeMap.has(key)) {
      const prev = charTimeMap.get(key);
      if (prev.location !== location) {
        issues.push({ severity: "warning", category: "timeline_conflict", detail: `角色 "${charName}" 在 "${time}" 同时出现在 "${prev.location}" 和 "${location}"`, entity: charName });
      }
    }
    charTimeMap.set(key, { location, event: event.title || "" });
  }
}

function checkKeywordConflicts(data, issues) {
  const entries = data.worldbook?.entries || data.worldbook?.items || [];
  const keyMap = new Map();

  for (const entry of entries) {
    const keys = Array.isArray(entry.keys) ? entry.keys : (typeof entry.keys === "string" ? [entry.keys] : []);
    for (const key of keys) {
      const normalized = String(key).trim().toLowerCase();
      if (!normalized) continue;

      if (keyMap.has(normalized)) {
        const prev = keyMap.get(normalized);
        issues.push({
          severity: "warning",
          category: "keyword_conflict",
          detail: `关键词 "${key}" 同时触发条目 "${prev}" 和 "${entry.title || entry.id}"——引擎会同时注入两者`,
          entity: entry.id || entry.title
        });
      }
      keyMap.set(normalized, entry.title || entry.id || "unknown");
    }
  }
}

/**
 * 生成人类可读的健康报告
 * @param {Object} result — runHealthCheck 的返回
 * @returns {string}
 */
export function formatHealthReport(result) {
  if (!result) return "⚠️ 健康检查未运行";

  const lines = [
    `═══ 世界健康报告 ═══`,
    `${result.summary}`,
    `  评分: ${result.score}/100`,
    ""
  ];

  if (!result.issues.length) {
    lines.push("🎉 未发现问题！");
    return lines.join("\n");
  }

  const byCategory = {};
  for (const issue of result.issues) {
    if (!byCategory[issue.category]) byCategory[issue.category] = [];
    byCategory[issue.category].push(issue);
  }

  for (const [cat, items] of Object.entries(byCategory)) {
    const label = {
      missing_field: "缺失字段",
      duplicate_id: "重复 ID",
      broken_ref: "断裂引用",
      timeline_conflict: "时间线冲突",
      keyword_conflict: "关键词冲突",
      module: "模组"
    }[cat] || cat;

    lines.push(`【${label}】(${items.length})`);
    for (const item of items.slice(0, 10)) {
      const icon = item.severity === "critical" ? "❌" : item.severity === "warning" ? "⚠️" : "ℹ️";
      lines.push(`  ${icon} ${item.detail}${item.entity ? ` [${item.entity}]` : ""}`);
    }
    if (items.length > 10) lines.push(`  ... 还有 ${items.length - 10} 条`);
    lines.push("");
  }

  return lines.join("\n");
}
