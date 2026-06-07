// ===== Markdown 解析器 =====
// 解析 Markdown 设定文档：按标题分块、提取 frontmatter、解析 [[wikilink]]

// ═══════════════════════════════════════════════════════════════
//  Frontmatter 解析（YAML 格式）
// ═══════════════════════════════════════════════════════════════

function parseFrontmatter(text) {
  if (!text.startsWith("---")) return { frontmatter: {}, bodyStart: 0 };

  const endIdx = text.indexOf("\n---", 3);
  if (endIdx < 0) return { frontmatter: {}, bodyStart: 0 };

  const fmText = text.slice(3, endIdx).trim();
  const bodyStart = endIdx + 4;

  const frontmatter = {};
  for (const line of fmText.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      let value = line.slice(colonIdx + 1).trim();
      // 去掉引号
      value = value.replace(/^["']|["']$/g, "");
      // 尝试解析列表
      if (value.startsWith("[") && value.endsWith("]")) {
        try { value = JSON.parse(value); } catch {}
      }
      frontmatter[key] = value;
    }
  }

  return { frontmatter, bodyStart };
}

// ═══════════════════════════════════════════════════════════════
//  [[wikilink]] 解析
// ═══════════════════════════════════════════════════════════════

function parseWikilinks(text) {
  const links = [];
  const regex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    links.push({
      target: match[1].trim(),
      alias: match[2]?.trim() || match[1].trim()
    });
  }
  return links;
}

// ═══════════════════════════════════════════════════════════════
//  按标题分块
// ═══════════════════════════════════════════════════════════════

function chunkByHeadings(text, minChunkSize = 10, maxChunkSize = 2000) {
  const lines = text.split("\n");
  const chunks = [];
  let currentHeading = "";
  let currentText = "";
  let chunkStart = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 检测标题
    const headingMatch = line.match(/^(#{1,4})\s+(.+)/);
    if (headingMatch) {
      // 保存上一个块
      if (currentText.trim().length >= minChunkSize) {
        chunks.push({
          index: chunks.length,
          heading: currentHeading,
          text: currentText.trim(),
          length: currentText.length,
          wikilinks: parseWikilinks(currentText),
          lineStart: chunkStart,
          lineEnd: i - 1
        });
      }
      currentHeading = headingMatch[2].trim();
      currentText = "";
      chunkStart = i;
      continue;
    }

    currentText += line + "\n";

    // 如果当前块超过最大大小，强制分割
    if (currentText.length >= maxChunkSize) {
      chunks.push({
        index: chunks.length,
        heading: currentHeading,
        text: currentText.trim(),
        length: currentText.length,
        wikilinks: parseWikilinks(currentText),
        lineStart: chunkStart,
        lineEnd: i
      });
      currentText = "";
      chunkStart = i + 1;
    }
  }

  // 最后一个块
  if (currentText.trim().length >= minChunkSize) {
    chunks.push({
      index: chunks.length,
      heading: currentHeading,
      text: currentText.trim(),
      length: currentText.length,
      wikilinks: parseWikilinks(currentText),
      lineStart: chunkStart,
      lineEnd: lines.length - 1
    });
  }

  return chunks;
}

// ═══════════════════════════════════════════════════════════════
//  主入口
// ═══════════════════════════════════════════════════════════════

/**
 * 解析 Markdown 设定文档
 * @param {string} text - 完整 Markdown 文本
 * @returns {Object} { format, frontmatter, chunks, wikilinks, raw }
 */
export function parseMarkdown(text) {
  if (!text || typeof text !== "string") return null;

  const { frontmatter, bodyStart } = parseFrontmatter(text);
  const bodyText = text.slice(bodyStart);
  const chunks = chunkByHeadings(bodyText);
  const allWikilinks = chunks.flatMap(c => c.wikilinks);

  return {
    format: "markdown",
    frontmatter,
    chunks,
    wikilinks: [...new Map(allWikilinks.map(l => [l.target, l])).values()],
    chunkCount: chunks.length,
    totalLength: text.length,
    raw: text
  };
}

/**
 * Markdown 解析结果 → 炼金台 items（仅从 frontmatter 和 wikilink 的确定性提取）
 * 完整的 LLM 提取在后续阶段进行
 */
export function markdownToItems(md) {
  if (!md) return [];
  const items = [];

  // 从 frontmatter 提取
  const fm = md.frontmatter || {};
  if (fm.title && (fm.author || fm.type)) {
    items.push({
      typeId: "worldbook-entry",
      typeName: "世界知识",
      entity: fm.title,
      confidence: 0.7,
      source: "markdown_frontmatter",
      data: {
        title: fm.title,
        content: fm.description || fm.summary || "",
        category: fm.type || "设定",
        tags: fm.tags || []
      },
      missingFields: ["content"],
      conflicts: []
    });
  }

  // 从 wikilinks 提取潜在实体
  for (const link of md.wikilinks || []) {
    items.push({
      typeId: "character",  // 默认归类为角色（最可能的类型）
      typeName: "角色",
      entity: link.target,
      confidence: 0.4,       // 低置信度——仅凭 [[link]] 无法确定类型
      source: "wikilink",
      data: {
        name: link.target,
        traits: [],
        tags: []
      },
      missingFields: ["description", "personality", "background"],
      conflicts: [],
      _hint: "需要 LLM 分类确定实际类型"
    });
  }

  return items;
}
