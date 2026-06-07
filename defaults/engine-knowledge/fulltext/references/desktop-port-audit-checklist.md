# World Tree Desktop 全功能引擎移植 — 审核清单

> 当主人让 Codex 产出 Desktop 引擎代码后，用此清单逐层审查。
> 核心原则：独立引擎（脱离 Hermes），直连 LLM，四层架构。

## 审查流程

### 0. 先确认全局假设

- [ ] 本次移植的目标是**独立引擎直连 LLM** 还是 **与 Hermes 共存**？
  - 独立引擎：overlay 作为安全缓冲层，路径、数据合并、场景链都不用考虑 Hermes 兼容
  - 共存模式：需要额外处理数据合并、写入边界、场景链同步

### 1. 逐层审查

#### Layer 1 — 代码层（src/core/engine/ + src/core/data/）

**引擎框架：**
- [ ] `runtime.js` — 状态机是否完整（idle/load/ready/running/blocked/error/exit）？
- [ ] `lifecycle.js` — prepareTurn + completeTurn 两段式是否正确？
- [ ] `modules.js` — 模块依赖链（expandModuleDependencies）是否正确？关闭父模块时子模块是否级联关闭？
- [ ] `output-parser.js` — parseMarkedOutput 能否正确解析中文【段名】？parseLooseYaml 容错如何？
- [ ] `guardian.js` — 是否覆盖四项校验（模组加载/路径越界/角色归属/续写安全）？
- [ ] `context-budget.js` — 四档预算的注入量是否合理？

**数据层是否真写了逻辑（不是存根）：**
- [ ] `worldbook.js` matchEntries — **匹配方向是否正确**？（应该是：用户输入匹配条目内容的相关性，不是检查内容中有没有触发词）
- [ ] `world-state.js` — merge + diff 是否可用？
- [ ] `scenes.js` — addScene/rotateChain/getContextWindow 是否正常工作？
- [ ] `characters.js` — 角色状态规范化是否正确？
- [ ] `cognition.js` — 认知过滤是否区分已知/未知/秘密？
- [ ] `rules.js` checkFeasibility — 是真正的规则检查还是正则存根？
- [ ] `rules.js` auditNarrative — 是否检查了角色一致性/场景连续性/节奏/风格（而不只是长度）？
- [ ] `prediction.js` — 预测是动态的（基于当前局势）还是静态模板？
- [ ] `random-events.js` — 是真正随机（Math.random）还是伪随机（seed 固定）？
- [ ] `character-card.js` — 是否正确区分了 M8 角色和 M19 角色卡？
- [ ] `processing-engine.js` — 七步评分是否真实有效？

**命令层：**
- [ ] `commands.js` execSlashCommand — 操作级指令（/存档/读档/世界书/角色/场景）是否有**真实的代码实现**，还是全部返回"交给 LLM"？
- [ ] 是否有两处重复的 classifyWorldTreeInput/commandIntent 实现？

**数据合并：**
- [ ] `data-store.js` 是否将 overlay 数据合并到核心数据中？
- [ ] 每轮的 LLM 上下文是否包含了上一轮 overlay 中的状态变更？

#### Layer 2 — 知识卡层（defaults/engine-profile/modules/）

- [ ] 每张卡片的 `summary` 是否是**该模块的真实描述**，还是通用模板？
- [ ] `rules` 字段是否足够让 LLM 理解模块如何工作？（应 3-10 条具体规则，不是一句话）
- [ ] `edgeCases` 是否是**该模块特有的边界情况**，还是引擎级通用表述？
- [ ] `activatedBy` 是否准确反映各预设对模块的激活情况？
- [ ] 所有 M1-M19 + M-创作 知识卡是否都存在？

#### Layer 3 — 全文库（defaults/engine-knowledge/fulltext/）

- [ ] 原始 skill 的 50+ reference 文档是否完整复制？
- [ ] `references/` 目录下每个模块的文档是否存在？
- [ ] engineKnowledgeSearch 是否同时搜索知识卡目录和全文库？

#### Layer 4 — 帮助层（defaults/engine-profile/help/）

- [ ] 是否有命令详解？
- [ ] 是否有模块说明？
- [ ] 是否有 LLM 输出协议说明？

### 2. 关键架构一致性检查

- [ ] `app-manifest.json` 的 `isolatedOverlayShape` 与实际 `overlay-store.js` 的路径是否一致？
- [ ] `app-manifest.json` 的 `runObjectIsolation` 与实际隔离逻辑是否一致？
- [ ] overlay 写入模式（merge-json/append-jsonl/append-json-array）是否正确处理了各种场景？
- [ ] main.cjs 中的 IPC handler 是否全部在 preload.cjs 中暴露？
- [ ] LLM adapter（llm.js）是否调用了 completeTurn 返回结构化结果？

### 3. 常见已发现的问题（快速检查清单）

| # | 问题 | 检查方式 |
|---|------|---------|
| 1 | 世界书匹配方向反了 | 看 `matchEntries` 是否检查 `entry.content.includes(key)` 而非真正语义匹配 |
| 2 | 知识卡全部模板克隆 | 随机抽 3 张卡的 `summary`，看是否只有模块名不同 |
| 3 | 命令执行器全是存根 | 搜 `/存档` 等操作指令，看是否有文件写入代码 |
| 4 | 数据不合并 overlay | 看 `data-store.js` 或 `lifecycle.js` 是否读取 overlay 并合并 |
| 5 | 高级模块是正则/rng 存根 | 看 `rules.js` 是否只有 regex，`prediction.js` 是否静态模板 |
| 6 | 全文库缺文件 | 数 `fulltext/references/` 下的文件数量 |
| 7 | overlay 路径与 manifest 不一致 | 对比 overlay-store.js 的 moduleOverlayPath 和 manifest 的 isolatedOverlayShape |
| 8 | 两份 commandIntent 实现 | main.cjs 和 commands.js 各有一份 |

## 四层架构速查

```
Layer 1 代码层：确定性逻辑（状态机/命令/overlay/匹配/解析）→ 写 JS
Layer 2 知识卡层：LLM 必须知道的叙事规则 → 浓缩 JSON，按激活模块注入
Layer 3 全文库层：完整 skill 文档 → 本地检索，按需注入
Layer 4 帮助层：用户可读文档 → 内置帮助面板
```

## LLM 输出协议速查

```
叙事正文...
【状态】      scene: xxx / time: xxx
【角色】      角色名: mood=xxx
【正史】      confirmed: / implied: / proposed:
【世界书提案】 entries: [keys/content]
【记忆】      叙事记忆条目
【场景预测】  next: [可能走向]
```

## 写入策略速查

- 独立引擎：overlay 作为安全缓冲层，高频自动变更写 overlay，用户主动操作可写 core
- `_desktop_engine` 路径建议放 Electron userData 下，与故事数据物理分离
- 写入保护：备份 + JSON 校验 + 路径越界检查

## 实施修复参考（2026-06-04 审核实战记录）

> 以下是在一次完整审核中发现的典型问题及修复方案。

### 修复 1：世界书匹配方向——从逆到正

**问题：** `matchEntries` 检查的是 `entry.content.includes(key)` 而非用户输入与条目的语义关系。

**修复：** 重写匹配引擎为 7 步流程：
```
1. 常驻条目直接加入（persistent mode 跳过关键词）
2. 精确关键词匹配（含 /regex/ 支持）
3. AND/OR 逻辑处理（全部命中才触发的条目）
4. 语义回退（content 词 ∩ input 词 ≥ 1 → 命中）
5. 场景变化触发（scene change → 自动激活相关条目）
6. 扫描深度过滤（近距3/中距5/远程10/全局无限）
7. 触发概率检查 + 层级排序 → 注入
```
关键代码见 `worldbook.js` 完整重写版。

### 修复 2：知识卡——从模板克隆到真实规则

**问题：** 21 张知识卡的 `summary` / `edgeCases` / `activatedBy` 全部是模板克隆。

**修复：** 从 v12.19 reference 文档提取每模块真实内容——
- `summary`：该模块是什么（不是"XX 的 Desktop LLM 适配知识卡"）
- `rules`：3-12 条具体的行为/叙事规则
- `edgeCases`：该模块特有的边界情况
- `activatedBy`：精确匹配 SKILL.md 中的类型→模块映射表

关键差异示例：M19 只应在 `character_card` 预设激活，而非 universal。

### 修复 3：数据合并——overlay 不回灌到 model

**问题：** `data-store.js` 构建 `buildModel` 后不读 overlay，每轮丢失状态。

**修复：** 在 `buildModel` 尾部追加 overlay 合并循环：
```javascript
for (const mode of ["worldbook", "character_card", "preset"]) {
  const overlayBase = `_desktop_engine/runs/${mode}/modules/${modKey}`;
  const rtOverlay = readJson(files, `${overlayBase}/runtime-overlay.json`, warnings);
  if (rtOverlay) moduleData.runtime = { ...moduleData.runtime, ...rtOverlay };
  // ... canon, characters, scenes 同理
}
```

### 修复 4：命令执行器——从全部存根到分级实现

**问题：** `/存档` `/读档` `/世界书 add` 等全部返回 "交给 LLM 处理"。

**修复：** 覆盖 14 组指令的真实实现——
- 引擎/模块/场景/角色/存档/分支/时间/随机 → 有具体叙事输出
- 世界书/规则/审查/认知 → 生成结构化 patch 供 overlay 写入
- 其他 → 生成 intent 标记供 engine packet 使用

### 修复 5：预测/随机/审查——从静态模板到动态生成

| 模块 | 旧实现 | 新实现 |
|:---|:---|:---|
| `prediction.js` | 3 条不变模板 | 基于场景名+在场角色+活跃伏笔动态生成 |
| `random-events.js` | seed 固定 → 同输入同输出 | Math.random() + 三级事件池(含真实模板) |
| `rules.js` | 正则匹配 4 个危险词 | 物理/社会/魔法三类约束 + 四维审查 |
| `guardian.js` | 仅检查路径越界 | 5 项校验(模组/路径/overlay/归属/续写) |

### 修复 6：路径一致性

**问题：** manifest 声明 `_desktop_engine/runs/<mode>/modules/<id>/`，
  但 overlay-store.js 生成 `_desktop_engine/modules/<id>/`。

**修复：** 统一为 `_desktop_engine/runs/<mode>/modules/<id>/` 带数据模式隔离。

### 修复 7：两份 commandIntent 分叉

**问题：** main.cjs 的 `commandIntent` 缺 `processing`/`time`/`random`/`cognition`/`worldbookset` 分类。

**修复：** 统一两份实现，新增 6 个分类。保持 main.cjs 和 commands.js 完全同步。
