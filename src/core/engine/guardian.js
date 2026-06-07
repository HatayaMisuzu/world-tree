// ===== M1 守门人校验 =====
// 所有数据读写前执行统一校验

export function validatePathWithinRoot(rootPath, targetPath) {
  if (!rootPath || !targetPath) return false;
  const normalizedRoot = String(rootPath).replaceAll("\\", "/").replace(/\/+$/, "").toLowerCase();
  const normalizedTarget = String(targetPath).replaceAll("\\", "/").toLowerCase();
  return normalizedTarget === normalizedRoot || normalizedTarget.startsWith(`${normalizedRoot}/`);
}

export function runGuardian({ model, intent, targetPath = "" }) {
  const checks = [];

  // 1. 模组加载检查
  checks.push({
    id: "module-loaded",
    ok: Boolean(model.loaded || model.selected),
    detail: model.loaded ? "模组已加载" : "未加载模组，仅允许引擎级指令"
  });

  // 2. 活跃模组归属检查
  if (model.selected && model.selected.id) {
    checks.push({
      id: "active-module-tracked",
      ok: true,
      detail: `活跃模组：${model.selected.id || model.selected.name || "unknown"}`
    });
  }

  // 3. 写入路径边界检查
  if (targetPath) {
    const pathOk = validatePathWithinRoot(model.rootPath || "", targetPath);
    checks.push({
      id: "path-boundary",
      ok: pathOk,
      detail: pathOk ? "写入路径在数据根内" : `写入路径越界。数据根：${model.rootPath}，目标：${targetPath}`
    });
  }

  // 4. overlay 路径约束
  // 🆕 v0.7.4.1 数据归家
  if (targetPath && !targetPath.includes("data/engine")) {
    checks.push({
      id: "overlay-only",
      ok: false,
      detail: "Desktop 引擎只写入 data/engine/ overlay，不得直接写核心 JSON。"
    });
  }

  // 5. 续写安全检查（进行中）
  if (intent?.kind === "narrative" && (!model.loaded || !model.selected)) {
    checks.push({
      id: "continuation-safety",
      ok: false,
      detail: "续写请求未加载模组。请先 /引擎 load 或 /引擎 new。"
    });
  }

  const ok = checks.every((item) => item.ok);
  return {
    ok,
    checks,
    blockedReason: ok ? "" : checks.find((item) => !item.ok)?.detail || "守门人校验失败"
  };
}

// ═══════════════════════════════════════════════════════════════
//  叙事内容校验（Guardian Auditor — JS 实现）
//  检查 Writer 输出是否符合 Direction Packet。
//  负责 must_include / must_not_include / 玩家回应 / 约束 四项。
//  复杂语义检查（角色OOC、世界事实冲突）留待 LLM Guardian。
// ═══════════════════════════════════════════════════════════════

/**
 * 校验 Writer 输出是否纳入方向包指定的内容
 * @param {Object} opts
 * @param {string} opts.narrative - Writer 输出正文
 * @param {Object} opts.directionPacket - 方向包
 * @param {string} opts.userInput - 玩家输入
 * @returns {Object} { pass, severity, score, issues: [], revisionInstructions: [] }
 */
export function validateNarrativeAgainstDirection({ narrative = "", directionPacket = null, userInput = "" } = {}) {
  const issues = [];
  const revisionInstructions = [];
  const dp = directionPacket?.packet || directionPacket;
  const cp = dp?.contentPlan || {};
  const we = dp?.writingConstraints || {};

  if (!narrative) {
    return {
      pass: false, severity: "critical", score: 0,
      issues: ["叙事输出为空"],
      revisionInstructions: ["Writer 必须输出【叙事】正文"]
    };
  }

  // 1. must_include 检查
  const mustItems = cp.mustInclude || [];
  const mustMissing = checkMustInclude(narrative, mustItems);
  for (const item of mustMissing) {
    issues.push(`缺少 mustInclude: ${item}`);
    revisionInstructions.push(`请确保叙事中包含了「${item}」`);
  }

  // 2. must_not_include 检查
  const mustNotItems = cp.mustNotInclude || [];
  const mustNotLeaked = checkMustNotInclude(narrative, mustNotItems);
  for (const item of mustNotLeaked) {
    issues.push(`泄露 mustNotInclude: ${item}`);
    revisionInstructions.push(`请移除叙事中「${item}」相关内容`);
  }

  // 3. 玩家回应检查
  const responseCheck = checkPlayerResponse(narrative, userInput);
  if (!responseCheck.ok) {
    issues.push(responseCheck.detail);
    revisionInstructions.push("叙事必须回应玩家的上一轮输入，不能忽略玩家的行动或提问");
  }

  // 4. 写作约束检查
  const constraintCheck = checkWritingConstraints(narrative, we);
  for (const c of constraintCheck) {
    issues.push(c);
    revisionInstructions.push(`请调整叙事以符合: ${c}`);
  }

  // 综合评分
  const score = Math.max(0, 100 - issues.length * 15);
  const severity = issues.length === 0 ? "none" :
    issues.length <= 2 ? "minor" :
    issues.length <= 4 ? "major" : "critical";

  return {
    pass: issues.length === 0,
    severity,
    score,
    issues,
    revisionInstructions: [...new Set(revisionInstructions)]
  };
}

/**
 * 检查 must_include 是否出现在叙事中
 * @param {string} narrative
 * @param {string[]} mustItems
 * @returns {string[]} 缺失项列表
 */
function checkMustInclude(narrative, mustItems) {
  if (!mustItems.length) return [];
  const text = String(narrative || "");
  return mustItems.filter((item) => {
    // 提取关键词（去掉前缀标签）
    const keywords = item.replace(/^[^:]*[:：]?\s*/, "").trim();
    if (!keywords) return false;
    // 拆成多个关键词，任一匹配即算通过
    const parts = keywords.split(/[,，、]/).map((s) => s.trim()).filter(Boolean);
    return !parts.some((part) => text.includes(part));
  });
}

/**
 * 检查 must_not_include 是否意外出现
 * @param {string} narrative
 * @param {string[]} mustNotItems
 * @returns {string[]} 泄露项列表
 */
function checkMustNotInclude(narrative, mustNotItems) {
  if (!mustNotItems.length) return [];
  const text = String(narrative || "");
  return mustNotItems.filter((item) => {
    const keywords = item.replace(/^[^:]*[:：]?\s*/, "").trim();
    if (!keywords) return false;
    const parts = keywords.split(/[,，、]/).map((s) => s.trim()).filter(Boolean);
    return parts.some((part) => text.includes(part));
  });
}

/**
 * 检查叙事是否回应了玩家输入
 */
function checkPlayerResponse(narrative, userInput) {
  if (!userInput || !narrative) return { ok: true };
  const input = String(userInput).trim();
  const ntext = String(narrative);

  // 玩家有问号 → 叙事必须有问号相关的回应
  if (/[？?]/.test(input)) {
    // 简单检查：叙事中没有明显回应问句
    const responseMarkers = [/她说|他说|回答|解释|告诉你|开口|开口说|因为|原因|原来|其实/];
    const hasResponse = responseMarkers.some((m) => m.test(ntext));
    if (!hasResponse) {
      return { ok: false, detail: "玩家提出了问题，但叙事中没有明显的回应" };
    }
  }

  // 玩家有动作描写 → 叙事应该提及
  if (/^(我|我们)/.test(input)) {
    const action = input.replace(/^(我|我们)/, "").slice(0, 6).trim();
    if (action && action.length > 1 && !ntext.includes(action)) {
      return { ok: false, detail: `玩家的动作「${action}」在叙事中未被体现` };
    }
  }

  return { ok: true };
}

/**
 * 检查写作约束
 */
function checkWritingConstraints(narrative, constraints = {}) {
  const issues = [];
  const text = String(narrative || "");

  const length = constraints.length || "medium";
  const charCount = text.length;

  if (length === "short" && charCount > 800) {
    issues.push(`要求 short（≤800字），实际约 ${charCount} 字`);
  } else if (length === "long" && charCount < 300) {
    issues.push(`要求 long（≥300字），实际约 ${charCount} 字`);
  }

  const perspective = constraints.perspective || "";
  if (perspective === "first_person" && /你[^的]/.test(text.slice(0, 100))) {
    issues.push(`要求 first_person 视角，但开头使用了第二人称「你」`);
  }
  if (perspective === "second_person" && !/你[^的]/.test(text.slice(0, 100))) {
    issues.push(`要求 second_person 视角，但开头未使用第二人称`);
  }

  const choices = constraints.choices || "none";
  if (choices === "required_2_to_3" && !/[？?]\s*$|选择|选项|决定/.test(text.slice(-100))) {
    issues.push("要求提供 2-3 个选择，但叙事结尾没有明显的选择点");
  }

  return issues;
}

// ═══════════════════════════════════════════════════════════════
//  v0.8.5 Guardian LLM 事实注入 + 自动修正
//  从 guardian-llm.js 重新导出，保持一致性
// ═══════════════════════════════════════════════════════════════
export { extractRelevantFacts, buildCorrectionPrompt, validateWithAutoCorrect } from "./guardian-llm.js";

// ═══════════════════════════════════════════════════════════════
//  v2 扩展：五项新检查（内容系统升级）
//  1. 人设一致性 2.世界观冲突 3.战力体系 4.时间线冲突 5.未授权内容
// ═══════════════════════════════════════════════════════════════

/**
 * 人设一致性检查
 * 检查叙事输出中角色行为是否与已知人设一致
 * @param {string} narrative - 叙事文本
 * @param {Object[]} characters - 已知角色列表 [{ name, traits, taboos, speechPattern }]
 * @returns {Object} { pass, issues }
 */
export function checkCharacterConsistency(narrative = "", characters = []) {
  const issues = [];
  const text = String(narrative || "");

  for (const ch of characters) {
    if (!ch.name || !text.includes(ch.name)) continue;

    // 检查禁用语感（角色不应使用的词汇或表达方式）
    const taboos = ch.taboos || [];
    for (const taboo of taboos) {
      if (text.includes(taboo)) {
        // 检查该禁用语是否出现在该角色的对话附近
        const aroundChar = textAround(text, ch.name, 200);
        if (aroundChar.includes(taboo)) {
          issues.push({
            type: "character_taboo",
            character: ch.name,
            detail: `「${ch.name}」使用了禁止词汇/表达: "${taboo}"`,
            severity: "minor"
          });
        }
      }
    }

    // 检查性格矛盾（简单规则）
    const traits = ch.traits || [];
    if (traits.includes("沉默寡言") || traits.includes("寡言")) {
      const speeches = countSpeeches(text, ch.name);
      if (speeches > 3 && avgSpeechLength(text, ch.name) > 150) {
        issues.push({
          type: "character_trait_contradiction",
          character: ch.name,
          detail: `「${ch.name}」人设为沉默寡言，但本轮发言 ${speeches} 次，单次平均过长`,
          severity: "major"
        });
      }
    }
    if (traits.includes("温和") || traits.includes("善良")) {
      const violentWords = ["一拳打", "踢飞", "掐住", "扇巴掌", "捅", "砍"];
      const aroundChar = textAround(text, ch.name, 150);
      const violents = violentWords.filter(w => aroundChar.includes(w));
      if (violents.length) {
        issues.push({
          type: "character_trait_contradiction",
          character: ch.name,
          detail: `「${ch.name}」人设为温和/善良，但出现了暴力行为: ${violents.join(', ')}`,
          severity: "major"
        });
      }
    }
  }

  return {
    pass: issues.filter(i => i.severity !== "minor").length === 0,
    issues,
    summary: issues.length ? `${issues.length} 项人设一致性疑虑` : "人设一致"
  };
}

/**
 * 世界观冲突检查
 * 检查叙事是否违反已知世界规则
 * @param {string} narrative
 * @param {Object[]} rules - 已知世界规则 [{ name, category, constraints, checkPatterns }]
 * @returns {Object} { pass, issues }
 */
export function checkWorldviewConflict(narrative = "", rules = []) {
  const issues = [];
  const text = String(narrative || "");

  for (const rule of rules) {
    if (!rule.active && rule.active !== undefined) continue;

    // 使用规则的 JS 检查模式
    const patterns = rule.checkPatterns || [];
    for (const p of patterns) {
      try {
        const regex = new RegExp(p.pattern, "i");
        if (regex.test(text)) {
          issues.push({
            type: "worldview_violation",
            rule: rule.name,
            category: rule.category || "通用",
            detail: p.message || `违反规则「${rule.name}」`,
            severity: p.level || "violation"
          });
        }
      } catch {
        // 正则无效，跳过
      }
    }

    // 通用世界观检查
    const cat = (rule.category || "").toLowerCase();
    if (cat === "物理" || cat === "physics") {
      // 无传送规则下的瞬移
      if (!JSON.stringify(rule.constraints || []).includes("传送") && /瞬移|传送|闪现/.test(text)) {
        issues.push({
          type: "worldview_violation",
          rule: rule.name,
          category: "物理",
          detail: "传送类行为未在世界规则中定义",
          severity: "violation"
        });
      }
    }
  }

  return {
    pass: issues.filter(i => i.severity === "critical").length === 0,
    issues,
    summary: issues.length ? `${issues.length} 项世界观冲突` : "世界观一致"
  };
}

/**
 * 战力体系检查
 * 检查叙事中的战力描述是否与已知体系一致
 * @param {string} narrative
 * @param {Object} powerSystem - 战力体系定义 { tiers, rules, knownCharacters: { name: tier } }
 * @returns {Object}
 */
export function checkPowerSystem(narrative = "", powerSystem = null) {
  if (!powerSystem || !powerSystem.tiers) return { pass: true, issues: [], summary: "无战力体系定义" };

  const issues = [];
  const text = String(narrative || "");
  const tiers = powerSystem.tiers || [];

  // 检测战力越级
  for (const [name, tier] of Object.entries(powerSystem.knownCharacters || {})) {
    if (!text.includes(name)) continue;

    const charTier = tiers.findIndex(t => t.name === tier || t === tier);
    const aroundChar = textAround(text, name, 300);

    // 扫描周围是否有高级别战力描述
    for (const t of tiers) {
      const tIdx = tiers.indexOf(t);
      if (tIdx <= charTier) continue;  // 同级或更低，不检查

      const tKeywords = t.keywords || [t.name];
      const matches = tKeywords.some(kw => aroundChar.includes(kw));
      if (matches && !aroundChar.includes("爆发") && !aroundChar.includes("突破") && !aroundChar.includes("进阶")) {
        issues.push({
          type: "power_tier_violation",
          character: name,
          expectedTier: tier,
          detected: t.name,
          detail: `「${name}」(战力${tier}) 展示了 ${t.name} 级别的能力，无突破/进阶解释`,
          severity: "major"
        });
      }
    }
  }

  return {
    pass: issues.length === 0,
    issues,
    summary: issues.length ? `${issues.length} 项战力体系冲突` : "战力一致"
  };
}

/**
 * 时间线冲突检查
 * 检查叙事中的时间表述是否与已有时间线一致
 * @param {string} narrative
 * @param {Object[]} timelineEvents - 已确认的时间线事件
 * @param {Object} currentTime - 当前时间 { display, dayNumber, dayPhase }
 * @returns {Object}
 */
export function checkTimelineConflict(narrative = "", timelineEvents = [], currentTime = {}) {
  const issues = [];
  const text = String(narrative || "");

  // 检查时间跳跃：当前是第3天早晨，叙事中提到"第二天早晨"或跳回过去
  const dayMentions = text.match(/第\s*(\d+)\s*天/g);
  if (dayMentions && currentTime.dayNumber) {
    for (const mention of dayMentions) {
      const mentionedDay = parseInt(mention.replace(/[^\d]/g, ""));
      if (mentionedDay < currentTime.dayNumber) {
        issues.push({
          type: "timeline_backwards",
          detail: `时间线倒退：叙事提到「第${mentionedDay}天」，但当前是第${currentTime.dayNumber}天`,
          severity: "major"
        });
      }
      if (mentionedDay > currentTime.dayNumber + 1) {
        issues.push({
          type: "timeline_skip",
          detail: `时间线跳跃：从第${currentTime.dayNumber}天跳到第${mentionedDay}天，跳过了${mentionedDay - currentTime.dayNumber - 1}天`,
          severity: "minor"
        });
      }
    }
  }

  // 检查已确认事件是否被矛盾重述
  for (const event of timelineEvents) {
    if (event.status !== "confirmed") continue;
    // 如果叙事中出现了相同的实体但结果不同
    if (event.relatedEntities?.characters) {
      for (const name of event.relatedEntities.characters) {
        if (text.includes(name) && text.includes(event.title)) {
          // 粗略检查：叙事是否在"否定"已确认事件
          const around = textAround(text, event.title, 150);
          if (/不是|没有|并非|从未/.test(around)) {
            issues.push({
              type: "timeline_contradiction",
              detail: `叙事似乎在否定已确认事件「${event.title}」`,
              severity: "critical"
            });
          }
        }
      }
    }
  }

  return {
    pass: issues.filter(i => i.severity === "critical").length === 0,
    issues,
    summary: issues.length ? `${issues.length} 项时间线冲突` : "时间线一致"
  };
}

/**
 * 未授权内容检查
 * 检查 LLM 是否编造了不在世界设定中的新内容
 * @param {string} narrative
 * @param {Object} canonState - 当前 canon_state { confirmed, implied, proposed }
 * @param {string[]} authorizedTypes - 允许 LLM 自由创作的内容类型
 * @returns {Object} { pass, issues, newContentWarnings }
 */
export function checkUnauthorizedContent(narrative = "", canonState = {}, authorizedTypes = []) {
  const issues = [];
  const warnings = [];
  const text = String(narrative || "");

  // 检测新角色名（不在 canon 中的新名字突然出现）
  const namePattern = /[「「]([^」」]{2,6})[」」]/g;
  const newNames = [];
  let match;
  while ((match = namePattern.exec(text)) !== null) {
    const name = match[1];
    const knownNames = [
      ...(canonState.confirmed?.characterNames || []),
      ...(canonState.implied?.characterNames || []),
      ...(authorizedTypes || [])
    ];
    if (!knownNames.includes(name) && !newNames.includes(name)) {
      newNames.push(name);
    }
  }
  if (newNames.length) {
    warnings.push({
      type: "new_character_name",
      detail: `出现未知角色名: ${newNames.join(', ')}（可能是临时 NPC 或需要注册的新角色）`,
      severity: "minor"
    });
  }

  // 检测新地名
  const knownLocations = [
    ...(canonState.confirmed?.locations || []),
    ...(canonState.implied?.locations || [])
  ];
  const locationPattern = /(?:前往|来到|到达|在)([^，。；,!]{2,8})(?:，|。|；|,)/g;
  let locMatch;
  const newLocs = [];
  while ((locMatch = locationPattern.exec(text)) !== null) {
    const loc = locMatch[1].trim();
    if (loc && !knownLocations.some(kl => loc.includes(kl) || kl.includes(loc)) && !newLocs.includes(loc)) {
      newLocs.push(loc);
    }
  }
  if (newLocs.length) {
    warnings.push({
      type: "new_location",
      detail: `出现未知地点: ${newLocs.join(', ')}（可能是临时场景或需要注册的新地点）`,
      severity: "minor"
    });
  }

  // 检测新世界规则/设定
  const rulePattern = /(?:在这里|这个世界|此界|这个世界里)[，,]?\s*(.{10,80})(?:，|。)/g;
  let ruleMatch;
  const newRules = [];
  while ((ruleMatch = rulePattern.exec(text)) !== null) {
    const snippet = ruleMatch[1];
    const knownRules = canonState.confirmed?.rules || [];
    const knownRuleTexts = knownRules.map(r => r.description || r).join("|");
    if (!knownRuleTexts.includes(snippet) && !newRules.includes(snippet)) {
      newRules.push(snippet);
    }
  }
  if (newRules.length) {
    warnings.push({
      type: "new_world_rule",
      detail: `叙事引入了新设定: "${newRules[0].slice(0, 60)}..."（需确认是否纳入世界规则）`,
      severity: "major"
    });
  }

  return {
    pass: issues.length === 0,
    issues,
    warnings,
    newContentDetected: warnings.length > 0,
    summary: warnings.length ? `${warnings.length} 项未授权新内容` : "无未授权内容"
  };
}

// ═══════════════════════════════════════════════════════════════
//  综合守门人检查（v2 扩展）
// ═══════════════════════════════════════════════════════════════

/**
 * 运行所有 Guardian 检查并返回综合报告
 * @param {Object} opts
 * @returns {Object} 综合报告
 */
export function runFullGuardian({
  narrative = "",
  characters = [],
  rules = [],
  powerSystem = null,
  timelineEvents = [],
  currentTime = {},
  canonState = {},
  authorizedTypes = []
} = {}) {
  const results = {};

  results.characterConsistency = checkCharacterConsistency(narrative, characters);
  results.worldviewConflict = checkWorldviewConflict(narrative, rules);
  if (powerSystem) {
    results.powerSystem = checkPowerSystem(narrative, powerSystem);
  }
  results.timelineConflict = checkTimelineConflict(narrative, timelineEvents, currentTime);
  results.unauthorizedContent = checkUnauthorizedContent(narrative, canonState, authorizedTypes);

  // 计算总通过率
  const checks = Object.values(results);
  const totalIssues = checks.reduce((s, c) => s + (c.issues || []).length, 0);
  const criticals = checks.reduce((s, c) => s + (c.issues || []).filter(i => i.severity === "critical").length, 0);
  const allPassed = criticals === 0;

  return {
    pass: allPassed,
    totalIssues,
    criticals,
    results,
    summary: checks.map(c => c.summary).filter(Boolean).join(" | "),
    timestamp: new Date().toISOString()
  };
}

// ═══════════════════════════════════════════════════════════════
//  工具函数
// ═══════════════════════════════════════════════════════════════

/** 获取文本中某个词周围的上下文 */
function textAround(text, keyword, window = 200) {
  const idx = text.indexOf(keyword);
  if (idx < 0) return "";
  const start = Math.max(0, idx - window / 2);
  const end = Math.min(text.length, idx + keyword.length + window / 2);
  return text.slice(start, end);
}

/** 统计角色发言次数 */
function countSpeeches(text, name) {
  const pattern = new RegExp(`${name}[^」」]*[说问道喊叫答][^」」]*[「「]`, 'g');
  return (text.match(pattern) || []).length;
}

/** 计算角色平均发言长度 */
function avgSpeechLength(text, name) {
  const pattern = new RegExp(`${name}[^」」]*[「「]([^」」]*)[」」]`, 'g');
  const speeches = [...text.matchAll(pattern)].map(m => m[1].length);
  if (!speeches.length) return 0;
  return speeches.reduce((a, b) => a + b, 0) / speeches.length;
}
