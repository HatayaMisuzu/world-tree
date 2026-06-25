# Detective V2 Notebook & Credibility Design

> 玩家笔记本是 Detective V2 的核心机制。Step 1 定义数据层，Step 2 实现 UI。

## 笔记本条目

```js
{
  noteId,        // 唯一标识
  sourceType,    // "evidence" | "testimony" | "observation" | "deduction"
  sourceId,      // 关联的 evidenceId / testimonyId
  rawQuote,      // 原文引用
  summary,       // 玩家总结
  playerNote,    // 玩家自由笔记
  credibility,   // 可信度标签
  tags,          // 玩家自定义标签
  links,         // 链接到其他笔记条目
  createdAt,
  updatedAt
}
```

## 可信度标签

| 标签 | 含义 |
|------|------|
| unverified | 未验证 |
| observed | 亲眼观察 |
| documented | 有文档记录 |
| claimed | 他人声称 |
| suspicious | 可疑 |
| confirmed | 已确认 |
| disproved | 已证伪 |
| key | 关键证据 |
| misleading | 误导 |

## 笔记本操作

- `createNotebookEntryFromSelection` — 从选中文本/证据创建条目
- `updateNotebookEntry` — 更新摘要/笔记/可信度
- `linkNotebookEntry` — 条目间建立链接
- `filterNotebookEntries` — 按来源/可信度/标签/搜索过滤

## 设计原则

1. 玩家主动记录 — 不自动填充
2. 可信度由玩家标注 — 系统不判定
3. 条目可链接 — 构建证据关系网
4. 可搜索/过滤 — 支持复杂案件的认知管理
