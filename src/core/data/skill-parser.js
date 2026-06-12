// skill-parser.js
// SKILL.md（创生skill 格式）→ JSON card 对象（parseCharacterCard 可读格式）
// 解析桥：Markdown 人格模拟文件 → 引擎结构化数据
// ═══════════════════════════════════════════════════════════════

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * 解析 YAML frontmatter（极简实现，仅覆盖 SKILL.md 使用的字段）
 */
function parseFrontmatter(text) {
  const frontmatter = {};
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return frontmatter;
  const body = match[1];
  let currentKey = null;
  for (const line of body.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const keyMatch = trimmed.match(/^(\w+):\s*(.*)$/);
    if (keyMatch) {
      currentKey = keyMatch[1];
      let val = keyMatch[2].replace(/^["']|["']$/g, "").trim();
      frontmatter[currentKey] = val || [];
      if (!val) frontmatter[currentKey] = [];
    } else if (trimmed.startsWith("- ") && currentKey) {
      if (!Array.isArray(frontmatter[currentKey])) frontmatter[currentKey] = [];
      frontmatter[currentKey].push(trimmed.slice(2).replace(/^["']|["']$/g, "").trim());
    }
  }
  return frontmatter;
}

/**
 * 按 ## 标题切分 markdown section
 */
function parseSections(md) {
  const sections = {};
  const lines = md.split(/\r?\n/);
  let currentSection = null;
  let currentBody = [];
  for (const line of lines) {
    const headingMatch = line.match(/^##\s+(.+)$/);
    if (headingMatch) {
      if (currentSection) sections[currentSection] = currentBody.join("\n").trim();
      currentSection = headingMatch[1].trim();
      currentBody = [];
    } else if (currentSection) {
      currentBody.push(line);
    }
  }
  if (currentSection) sections[currentSection] = currentBody.join("\n").trim();
  return sections;
}

/**
 * 解析 markdown 表格（含表头）
 * 返回 [{col1: val1, col2: val2, ...}]
 */
function parseTable(body) {
  const lines = body.split(/\r?\n/).filter(l => l.trim());
  const tableStart = lines.findIndex(l => l.includes("|") && l.includes("---") === false);
  if (tableStart === -1) return [];
  const headerLine = lines[tableStart];
  const headers = headerLine.split("|").map(h => h.trim()).filter(Boolean);
  const dataLines = lines.slice(tableStart + 2).filter(l => l.includes("|") && !l.includes("---"));
  return dataLines.map(line => {
    const cells = line.split("|").map(c => c.trim()).filter(Boolean);
    const row = {};
    headers.forEach((h, i) => { if (cells[i] !== undefined) row[h] = cells[i]; });
    return row;
  });
}

/**
 * 解析无序列表（- 开头行）
 */
function parseList(body) {
  return body.split("\n")
    .map(l => l.trim())
    .filter(l => l.startsWith("- "))
    .map(l => l.slice(2).trim());
}

/**
 * 从列表项中提取 key: value 对
 * 例如 "- 口癖：当然よ" → { 口癖: "当然よ" }
 */
function parseKeyValueList(body) {
  const result = {};
  for (const line of parseList(body)) {
    const match = line.match(/^([^：:]+)[：:]\s*(.*)$/);
    if (match) result[match[1].trim()] = match[2].trim();
  }
  return result;
}

/**
 * 主入口：SKILL.md path → JSON card object
 */
export function parseSkillFile(skillPath) {
  if (!existsSync(skillPath)) return null;
  const md = readFileSync(skillPath, "utf-8");
  return parseSkillMd(md);
}

/**
 * 主入口：SKILL.md 文本 → JSON card object
 */
export function parseSkillMd(md) {
  const fm = parseFrontmatter(md);
  const sections = parseSections(md.replace(/^---[\s\S]*?---\n?/, ""));
  const card = {};

  // 基本信息
  card.name = fm.name || "";
  card.名称 = fm.name || "";
  card.description = fm.description || "";

  // entrypoints 作为别名
  if (Array.isArray(fm.entrypoints)) {
    card.aliases = fm.entrypoints;
    card.别名 = fm.entrypoints;
  }

  // ── 人格底盘 ──
  if (sections["人格底盘"]) {
    const rows = parseTable(sections["人格底盘"]);
    for (const row of rows) {
      const content = row["内容"] || "";
      if (row["维度"]?.includes("欲望")) card.欲望 = content;
      if (row["维度"]?.includes("恐惧")) card.恐惧 = content;
      if (row["维度"]?.includes("执念")) card.执念 = content;
      if (row["维度"]?.includes("情绪默认态")) card.情绪默认态 = content;
      if (row["维度"]?.includes("情绪爆发点")) card.情绪爆发点 = content;
    }
  }

  // ── 表达DNA ──
  if (sections["表达DNA"]) {
    const body = sections["表达DNA"];
    const lines = body.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    
    // 提取口癖：找列表项中带"开场白定番"的行
    const catchphraseLine = lines.find(l => l.startsWith("- ") && l.includes("开场白定番"));
    if (catchphraseLine) {
      const val = catchphraseLine.replace(/^-\s*[^：:]*[：:]\s*/, "").trim();
      if (val) card.口癖 = [val];
    }
    
    // 提取高频语气词
    const toneLine = lines.find(l => l.startsWith("- ") && l.includes("高频语气词"));
    if (toneLine) {
      const val = toneLine.replace(/^-\s*[^：:]*[：:]\s*/, "").trim();
      if (val) card.语气词密度 = val;
    }
    
    // 提取句式偏好
    const sentenceLine = lines.find(l => l.startsWith("- ") && l.includes("句式偏好"));
    if (sentenceLine) {
      const colonMatch = sentenceLine.match(/^-\s*[^：:]*[：:]\s*(.+)$/);
      if (colonMatch) card.句式偏好 = colonMatch[1].trim();
    }
    
    // 提取称呼习惯
    const addressLine = lines.find(l => l.startsWith("- ") && (l.includes("自称") || l.includes("称呼")));
    if (addressLine) {
      // 格式可能是 "- 自称「我」，对P称「前辈」"（无冒号）或 "- 称呼：xxx"
      const colonMatch = addressLine.match(/^-\s*[^：:]*[：:]\s*(.+)$/);
      if (colonMatch) {
        card.称呼习惯 = colonMatch[1].trim();
      } else {
        card.称呼习惯 = addressLine.replace(/^-\s*/, "").trim();
      }
    }
    
    // 提取签名动作（表情/动作DNA下的列表项）
    const dnaSection = body.split(/表情\/动作DNA|签名动作/i)[1];
    if (dnaSection) {
      const gestures = dnaSection.split(/\r?\n/)
        .map(l => l.trim())
        .filter(l => l.startsWith("- "))
        .map(l => l.slice(2).replace(/——.*$/, "").trim())
        .filter(Boolean);
      if (gestures.length) card.签名动作 = gestures[0];
    }
  }

  // ── 角色扮演规则 ──
  if (sections["角色扮演规则"]) {
    card.rules = parseList(sections["角色扮演规则"]);
  }

  // ── 用户与我的关系 ──
  if (sections["用户与我的关系"]) {
    card.currentRole = sections["用户与我的关系"].split("\n")[0]?.trim() || "";
    card.relationshipDesc = sections["用户与我的关系"];
  }

  // ── 外貌与穿着 ──
  if (sections["外貌与穿着"]) {
    card.外貌 = sections["外貌与穿着"].split("\n").filter(l => l.trim() && !l.startsWith("#")).slice(0, 5).join("\n");
  }

  // ── 场景响应模式 ──
  if (sections["场景响应模式（Phase 5 当前默认）"]) {
    const rows = parseTable(sections["场景响应模式（Phase 5 当前默认）"]);
    for (const row of rows) {
      const scene = row["场景"] || "";
      const reaction = row["典型反应"] || "";
      const gesture = row["动作/神态"] || "";
      const keywords = row["关键词"] || "";
      if (scene.includes("初次见面")) card.初次见面 = { reaction, gesture, dialogueStyle: keywords };
      if (scene.includes("被夸奖")) card.被夸奖 = { reaction, gesture, dialogueStyle: keywords };
      if (scene.includes("被冒犯") || scene.includes("挑衅")) card.被冒犯 = { reaction, gesture, dialogueStyle: keywords };
      if (scene.includes("亲密") || scene.includes("暧昧")) card.亲密试探 = { reaction, gesture, dialogueStyle: keywords };
      if (scene.includes("孤独") || scene.includes("低落")) card.孤独低落时 = { reaction, gesture, dialogueStyle: keywords };
    }
  }

  // ── 关系网络 ──
  if (sections["关系网络（内部推理工具，不主动输出）"]) {
    const rows = parseTable(sections["关系网络（内部推理工具，不主动输出）"]);
    card.关系 = rows.map(r => ({
      name: r["角色"] || "",
      relation: r["关系"] || "",
      attitude: r["态度"] || "",
      interaction: r["互动模式"] || ""
    }));
  }

  // ── 世界观知识边界 ──
  if (sections["世界观知识边界"]) {
    const lines = sections["世界观知识边界"].split("\n").filter(l => l.trim());
    const knows = [];
    const notKnows = [];
    let inKnow = false, inNotKnow = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.includes("我知道") || trimmed.includes("可以知道")) { inKnow = true; inNotKnow = false; continue; }
      if (trimmed.includes("我不知道") || trimmed.includes("不应该知道")) { inKnow = false; inNotKnow = true; continue; }
      if (inKnow && trimmed.startsWith("- ")) knows.push(trimmed.slice(2).trim());
      if (inNotKnow && trimmed.startsWith("- ")) notKnows.push(trimmed.slice(2).trim());
    }
    card.可以知道 = knows;
    card.不应该知道 = notKnows;
  }

  // ── 互动安全边界 ──
  if (sections["互动安全边界"]) {
    card.boundaries = sections["互动安全边界"];
  }

  // ── 时间线 ──
  if (sections["角色弧光与时间线"]) {
    card.growthStage = "Phase 5";
    // 提取当前默认 Phase
    const phaseMatch = sections["角色弧光与时间线"].match(/当前默认Phase[：:]\s*(.+)/);
    if (phaseMatch) card.growthStage = phaseMatch[1].trim();
  }

  // ── 来源 ──
  card.source = "skill-parser";
  card.format = "creation-skill";
  card.createdAt = new Date().toISOString();

  return card;
}

/**
 * 扫描显式传入的 skills/creative 目录，列出所有 SKILL.md。
 * 未配置外部目录时返回空数组，避免默认耦合到个人 Hermes 安装。
 */
export function listSkillFiles(skillsDir = "") {
  const dir = String(skillsDir || "").trim();
  if (!dir) return [];
  if (!existsSync(dir)) return [];
  try {
    const items = readdirSync(dir, { withFileTypes: true });
    const skills = [];
    for (const item of items) {
      if (item.isDirectory()) {
        const skillPath = join(dir, item.name, "SKILL.md");
        if (existsSync(skillPath)) {
          skills.push({ id: item.name, path: skillPath });
        }
      }
    }
    return skills;
  } catch { return []; }
}
