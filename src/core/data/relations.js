// ===== 角色关系图谱 v1 =====
// 独立于组织实体（M4）的角色间关系系统。
// 关系是角色之间的动态连接，不依赖组织、不预设固定结局。
//
// 关系类型：血缘/师徒/敌对/盟友/契约/暗恋/朋友/对手/陌生/复杂
// 每条关系有：态度强度(-5到+5)、变化历史、触发条件、可见性
//
// 设计原则（来自 v12.20 设计决策）：
//   角色关系网独立于组织关系，不在组织中的角色也可以有关系。

// ═══════════════════════════════════════════════════════════════
//  关系类型定义
// ═══════════════════════════════════════════════════════════════

export const RELATION_TYPES = {
  blood:       { name: "血缘",   category: "innate",    reversible: false },
  mentor:      { name: "师徒",   category: "acquired",  reversible: true  },
  enemy:       { name: "敌对",   category: "acquired",  reversible: true  },
  ally:        { name: "盟友",   category: "acquired",  reversible: true  },
  contract:    { name: "契约",   category: "acquired",  reversible: true  },
  crush:       { name: "暗恋",   category: "emotional", reversible: true  },
  friend:      { name: "朋友",   category: "acquired",  reversible: true  },
  rival:       { name: "对手",   category: "acquired",  reversible: true  },
  stranger:    { name: "陌生",   category: "neutral",   reversible: true  },
  complex:     { name: "复杂",   category: "emotional", reversible: true  },
  master_servant: { name: "主从", category: "acquired", reversible: true  },
  lover:       { name: "恋人",   category: "emotional", reversible: true  },
  betrayed:    { name: "背叛",   category: "acquired",  reversible: false },
  protector:   { name: "守护",   category: "emotional", reversible: true  }
};

// ═══════════════════════════════════════════════════════════════
//  关系存储
// ═══════════════════════════════════════════════════════════════

const RELATION_STORE = {
  relations: [],            // 所有关系记录
  changeLog: [],            // 关系变化历史
  maxChangeLog: 200
};

let relationIdCounter = 0;

// ═══════════════════════════════════════════════════════════════
//  创建与更新
// ═══════════════════════════════════════════════════════════════

/**
 * 创建或更新一条关系
 * @param {Object} opts
 * @param {string} opts.source - 角色 A 名称
 * @param {string} opts.target - 角色 B 名称
 * @param {string} opts.type - 关系类型（见 RELATION_TYPES）
 * @param {number} opts.attitude - 态度强度 -5(极端敌对) 到 +5(极度亲密)
 * @param {string} [opts.description] - 关系描述
 * @param {string} [opts.origin] - 关系起源（如何建立的）
 * @param {string[]} [opts.secrets] - 关系中一方不知道的秘密
 * @param {number} [opts.visibility] - 公开程度 0-10
 * @returns {Object} 关系对象
 */
export function setRelation({ source, target, type = "stranger", attitude = 0, description = "", origin = "", secrets = [], visibility = 5 }) {
  if (!source || !target) return { error: "source 和 target 不能为空" };
  if (source === target) return { error: "不能建立与自身的关系" };

  const typeDef = RELATION_TYPES[type];
  if (!typeDef) return { error: `未知关系类型: ${type}` };

  // 查找已有关系
  const existing = findRelation(source, target);
  const prevAttitude = existing ? existing.attitude : null;
  const prevType = existing ? existing.type : null;

  if (existing) {
    // 更新已有关系
    const changeEntries = [];
    if (prevType !== type) changeEntries.push({ field: "type", from: prevType, to: type });
    if (prevAttitude !== attitude) changeEntries.push({ field: "attitude", from: prevAttitude, to: attitude });

    Object.assign(existing, {
      type, attitude, description: description || existing.description,
      origin: origin || existing.origin,
      secrets: [...new Set([...(existing.secrets || []), ...secrets])],
      visibility,
      updatedAt: new Date().toISOString()
    });

    if (changeEntries.length) {
      logRelationChange(existing.id, changeEntries, "update");
    }
    return existing;
  }

  // 创建新关系
  const relation = {
    id: `rel-${++relationIdCounter}`,
    source,
    target,
    type,
    typeName: typeDef.name,
    typeCategory: typeDef.category,
    attitude,
    description,
    origin,
    secrets,
    visibility,
    status: "active",         // active / dormant / severed
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    changeHistory: [{
      at: new Date().toISOString(),
      event: "created",
      detail: `关系建立: ${typeDef.name}`
    }]
  };

  RELATION_STORE.relations.push(relation);
  return relation;
}

// ═══════════════════════════════════════════════════════════════
//  查询
// ═══════════════════════════════════════════════════════════════

/** 查找两角色之间的关系（无向） */
export function findRelation(a, b) {
  return RELATION_STORE.relations.find(
    r => (r.source === a && r.target === b) || (r.source === b && r.target === a)
  ) || null;
}

/** 获取某角色的所有关系 */
export function getRelationsFor(name) {
  return RELATION_STORE.relations.filter(
    r => (r.source === name || r.target === name) && r.status === "active"
  );
}

/** 获取某角色的关系图谱（含对方名称和态度） */
export function getRelationGraph(name) {
  return getRelationsFor(name).map(r => {
    const other = r.source === name ? r.target : r.source;
    const direction = r.source === name ? "outgoing" : "incoming";
    return {
      other,
      type: r.type,
      typeName: r.typeName,
      attitude: direction === "outgoing" ? r.attitude : r.attitude,  // 目前是对称的
      direction,
      description: r.description,
      visibility: r.visibility
    };
  });
}

/** 按关系类型筛选 */
export function getRelationsByType(type) {
  return RELATION_STORE.relations.filter(r => r.type === type && r.status === "active");
}

/** 获取态度极端的关系（绝对值 >= 4） */
export function getExtremeRelations() {
  return RELATION_STORE.relations.filter(
    r => Math.abs(r.attitude) >= 4 && r.status === "active"
  );
}

/** 获取最近变化的关系 */
export function getRecentChanges(limit = 5) {
  return RELATION_STORE.changeLog.slice(-limit);
}

// ═══════════════════════════════════════════════════════════════
//  态度变化
// ═══════════════════════════════════════════════════════════════

/**
 * 调整态度值（增量）
 * @param {string} a - 角色 A
 * @param {string} b - 角色 B
 * @param {number} delta - 变化量（正=更亲近，负=更疏远）
 * @param {string} reason - 变化原因
 */
export function adjustAttitude(a, b, delta, reason = "") {
  const rel = findRelation(a, b);
  if (!rel) {
    // 如果关系不存在，以陌生人为基础创建
    return setRelation({
      source: a, target: b, type: "stranger",
      attitude: Math.max(-5, Math.min(5, delta)),
      origin: reason
    });
  }

  const oldAttitude = rel.attitude;
  rel.attitude = Math.max(-5, Math.min(5, oldAttitude + delta));
  rel.updatedAt = new Date().toISOString();

  rel.changeHistory.push({
    at: new Date().toISOString(),
    event: "attitude_change",
    detail: `态度 ${oldAttitude} → ${rel.attitude}${reason ? ` (${reason})` : ''}`
  });

  // 态度穿越阈值时自动更新关系类型
  if (oldAttitude <= -3 && rel.attitude > -3) {
    rel.type = "complex";
    rel.typeName = "复杂";
    rel.changeHistory.push({ at: new Date().toISOString(), event: "type_change", detail: "态度转正 → 关系变为「复杂」" });
  }
  if (oldAttitude >= 3 && rel.attitude < 3) {
    rel.type = "complex";
    rel.typeName = "复杂";
    rel.changeHistory.push({ at: new Date().toISOString(), event: "type_change", detail: "态度转冷 → 关系变为「复杂」" });
  }

  logRelationChange(rel.id, [{ field: "attitude", from: oldAttitude, to: rel.attitude }], "attitude_change");
  return rel;
}

// ═══════════════════════════════════════════════════════════════
//  关系切断
// ═══════════════════════════════════════════════════════════════

export function severRelation(a, b, reason = "") {
  const rel = findRelation(a, b);
  if (!rel) return { error: "关系不存在" };

  rel.status = "severed";
  rel.severedAt = new Date().toISOString();
  rel.severReason = reason;
  rel.changeHistory.push({
    at: new Date().toISOString(),
    event: "severed",
    detail: `关系切断${reason ? `: ${reason}` : ''}`
  });

  logRelationChange(rel.id, [{ field: "status", from: "active", to: "severed" }], "sever");
  return rel;
}

// ═══════════════════════════════════════════════════════════════
//  关系网络分析
// ═══════════════════════════════════════════════════════════════

/** 检测三角关系（A→B, B→C, A→C） */
export function detectTriangles() {
  const triangles = [];
  const names = [...new Set(RELATION_STORE.relations.flatMap(r => [r.source, r.target]))];

  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      for (let k = j + 1; k < names.length; k++) {
        const ab = findRelation(names[i], names[j]);
        const bc = findRelation(names[j], names[k]);
        const ac = findRelation(names[i], names[k]);
        if (ab && bc && ac) {
          triangles.push({
            vertices: [names[i], names[j], names[k]],
            relations: [ab, bc, ac],
            attitudeSum: ab.attitude + bc.attitude + ac.attitude
          });
        }
      }
    }
  }
  return triangles;
}

/** 获取全局关系网摘要 */
export function networkSummary() {
  const total = RELATION_STORE.relations.filter(r => r.status === "active").length;
  const byType = {};
  for (const r of RELATION_STORE.relations) {
    if (r.status !== "active") continue;
    byType[r.type] = (byType[r.type] || 0) + 1;
  }
  const extremes = getExtremeRelations().length;
  const triangles = detectTriangles();

  return {
    totalRelations: total,
    byType,
    extremes,
    triangles: triangles.length,
    avgAttitude: total > 0
      ? (RELATION_STORE.relations.reduce((s, r) => s + r.attitude, 0) / total).toFixed(1)
      : 0
  };
}

// ═══════════════════════════════════════════════════════════════
//  LLM 上下文注入
// ═══════════════════════════════════════════════════════════════

/** 为指定角色生成关系上下文（用于 LLM prompt） */
export function relationContextFor(name) {
  const rels = getRelationsFor(name);
  if (!rels.length) return "";

  const lines = [`【${name} 的关系网】`];
  for (const r of rels) {
    const other = r.source === name ? r.target : r.source;
    const attBar = attitudeBar(r.attitude);
    lines.push(`  ${r.typeName} ←→ ${other} ${attBar} ${r.description || ''}`);
  }
  return lines.join('\n');
}

/** 态度可视化条 */
function attitudeBar(value) {
  const chars = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
  const idx = Math.round((value + 5) / 10 * (chars.length - 1));
  const color = value > 1 ? '💚' : value < -1 ? '❤️' : '🤍';
  return `${color}${chars[Math.max(0, Math.min(chars.length - 1, idx))]}`;
}

// ═══════════════════════════════════════════════════════════════
//  内部
// ═══════════════════════════════════════════════════════════════

function logRelationChange(relationId, changes, event) {
  RELATION_STORE.changeLog.push({
    relationId,
    changes,
    event,
    at: new Date().toISOString()
  });
  if (RELATION_STORE.changeLog.length > RELATION_STORE.maxChangeLog) {
    RELATION_STORE.changeLog = RELATION_STORE.changeLog.slice(-RELATION_STORE.maxChangeLog);
  }
}

/** 重置关系存储 */
export function resetRelations() {
  RELATION_STORE.relations = [];
  RELATION_STORE.changeLog = [];
  relationIdCounter = 0;
}

/** 批量导入关系 */
export function importRelations(relations = []) {
  for (const r of relations) {
    if (!r.error) {
      RELATION_STORE.relations.push(r);
      if (r.id && parseInt(r.id.replace('rel-', '')) > relationIdCounter) {
        relationIdCounter = parseInt(r.id.replace('rel-', ''));
      }
    }
  }
}

/** 导出关系快照 */
export function exportRelations() {
  return {
    relations: RELATION_STORE.relations,
    changeLog: RELATION_STORE.changeLog.slice(-100),
    summary: networkSummary(),
    exportedAt: new Date().toISOString()
  };
}
