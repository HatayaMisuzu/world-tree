// ===== 去重器 =====
// 实体名称去重 + 冲突检测
// 纯 JS，零依赖，零 token

/**
 * 对炼金台 items 进行去重
 * @param {Object[]} items - 所有提取出的 items
 * @param {Object[]} [existingEntities] - 已有实体列表 [{ name, typeId, data }]
 * @returns {Object[]} 去重后的 items（带 _dedup 标记）
 */
export function deduplicate(items = [], existingEntities = []) {
  if (!items.length) return [];

  const result = [];
  const seen = new Map(); // entity+typeId → item

  for (const item of items) {
    const key = `${item.entity || ""}|${item.typeId}`;
    if (!key || key === "|") {
      result.push(item);
      continue;
    }

    const existing = seen.get(key);

    if (existing) {
      // 同实体同类型：保留置信度更高的
      if ((item.confidence || 0) > (existing.confidence || 0)) {
        // 替换
        existing._dedup = { merged: true, replacedLower: existing.entity };
        const idx = result.indexOf(existing);
        if (idx >= 0) {
          result[idx] = {
            ...item,
            _dedup: { merged: true, replaces: existing.entity, reason: "更高置信度" }
          };
          seen.set(key, result[idx]);
        }
      } else {
        // 保留旧的，标记跳过
        item._dedup = { skipped: true, keptExisting: existing.entity, reason: "已存在更高置信度版本" };
        result.push(item);
      }
      continue;
    }

    // 检查是否与已有实体冲突
    const conflict = checkConflict(item, existingEntities);
    if (conflict) {
      item.conflicts = [...(item.conflicts || []), conflict];
    }

    seen.set(key, item);
    result.push(item);
  }

  return result;
}

/**
 * 检查 item 与已有实体的冲突
 */
function checkConflict(item, existingEntities = []) {
  for (const existing of existingEntities) {
    if (!existing.name || !item.entity) continue;

    // 名称完全匹配
    if (existing.name === item.entity) {
      // 类型不同 → 可能冲突
      if (existing.typeId && item.typeId && existing.typeId !== item.typeId) {
        return {
          field: "type",
          existingValue: existing.typeId,
          extractedValue: item.typeId,
          detail: `"${item.entity}" 在已有数据中是 ${existing.typeId}，提取结果将其归类为 ${item.typeId}`
        };
      }
      // 类型相同 → 检查数据完整性
      if (existing.data && item.data) {
        const existingFields = Object.keys(existing.data).filter(k => existing.data[k]);
        const extractedFields = Object.keys(item.data).filter(k => item.data[k]);
        if (existingFields.length >= extractedFields.length) {
          return {
            field: "data_completeness",
            existingValue: `${existingFields.length}个字段`,
            extractedValue: `${extractedFields.length}个字段`,
            detail: `"${item.entity}" 已有更完整的数据，建议保留已有版本`
          };
        }
      }
    }

    // 名称相似（模糊匹配）
    const similarity = nameSimilarity(item.entity, existing.name);
    if (similarity >= 0.8 && similarity < 1.0) {
      return {
        field: "name_similarity",
        existingValue: existing.name,
        extractedValue: item.entity,
        detail: `"${item.entity}" 与已有 "${existing.name}" 相似度 ${(similarity*100).toFixed(0)}%，可能是同一实体`
      };
    }
  }

  return null;
}

/**
 * 简单的名称相似度（Jaccard 3-gram）
 */
function nameSimilarity(a = "", b = "") {
  if (a === b) return 1.0;
  const sa = String(a).toLowerCase();
  const sb = String(b).toLowerCase();
  if (sa === sb) return 1.0;

  // 3-gram
  const grams = (s) => {
    const g = new Set();
    for (let i = 0; i < s.length - 2; i++) {
      g.add(s.slice(i, i + 3));
    }
    return g;
  };

  const ga = grams(sa);
  const gb = grams(sb);
  if (!ga.size || !gb.size) return 0;

  const intersection = [...ga].filter(g => gb.has(g)).length;
  const union = ga.size + gb.size - intersection;
  return union > 0 ? intersection / union : 0;
}

/**
 * 按置信度和优先级排序 items
 */
export function sortByPriority(items = []) {
  const priorityOrder = {
    "character": 1, "organization": 2, "faction": 3,
    "location": 4, "timeline": 5, "rule": 6,
    "relation": 7, "item": 8, "worldbook-entry": 9
  };

  return [...items].sort((a, b) => {
    // 按置信度降序
    if (a.confidence !== b.confidence) return (b.confidence || 0) - (a.confidence || 0);
    // 按类型优先级
    return (priorityOrder[a.typeId] || 99) - (priorityOrder[b.typeId] || 99);
  });
}

/**
 * 统计去重结果
 */
export function dedupStats(items = []) {
  const merged = items.filter(i => i._dedup?.merged).length;
  const skipped = items.filter(i => i._dedup?.skipped).length;
  const conflicted = items.filter(i => i.conflicts?.length).length;
  return {
    total: items.length,
    unique: items.filter(i => !i._dedup?.skipped).length,
    merged,
    skipped,
    conflictCount: conflicted,
    conflicts: items.filter(i => i.conflicts?.length).flatMap(i => i.conflicts || [])
  };
}
