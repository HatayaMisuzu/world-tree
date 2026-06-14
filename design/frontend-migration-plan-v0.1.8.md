# World Tree v0.1.8 Frontend Migration Plan

## 目标

把 `F:\world-tree` 中 v0 生成的新前端原型迁移回主项目 `D:\工作台\world-tree-desktop`，但不直接把 Next/React 项目塞进当前仓库。

当前主项目是纯 `HTML/CSS/JS + Node server.js` 架构，已有 API、数据目录、测试脚本和发布流程。迁移目标是吸收 v0 原型的信息架构、页面组织、视觉语言和交互模式，并用当前主项目能运行、能发布、能测试的方式实现。

## 迁移原则

- 不引入 React / Next 到主项目本轮迁移中，除非后续明确决定重构技术栈。
- 不改后端 API 语义，优先复用现有 `/api/*`。
- 不一次性替换全部前端，避免破坏当前可运行状态。
- 先迁移结构，再迁移视觉，再补细节交互。
- 保留当前项目 `npm run preflight`、`npm run test:unit`、`npm pack --dry-run --json` 可验证链路。
- 不引入 v0 原型中的具体原创素材，继续使用中性占位或真实用户数据。
- API Key、secrets、runtime 私密数据仍保持本地安全边界。

## 输入资产

主项目当前前端：

- `world-tree-console.html`
- `world-tree-console.css`
- `world-tree-console.js`

v0 原型参考：

- `F:\world-tree\components/world-tree-shell.tsx`
- `F:\world-tree\components/workbench-view.tsx`
- `F:\world-tree\components/chat-view.tsx`
- `F:\world-tree\components/library-view.tsx`
- `F:\world-tree\components/world-management-view.tsx`
- `F:\world-tree\components/observability-view.tsx`
- `F:\world-tree\components/settings-view.tsx`
- `F:\world-tree\lib/mock-data.ts`
- `F:\world-tree\r2-*.png`

主项目规划稿：

- `design/v0-world-tree-frontend-prompt-v0.1.8.md`
- `design/v0-world-tree-frontend-revision-prompt-v0.1.8.md`
- `ui-layout-summary-demo.html`

## 功能映射

| 当前主项目功能 | 目标新位置 | 迁移策略 |
| --- | --- | --- |
| 首页模块选择、快速开始、炼金台入口 | 工作台 | 重构 `home`，保留 API 调用，改为新布局 |
| 世界书总览 | 工作台 + 资料库/世界书 | 首页只展示摘要，完整编辑迁入资料库 |
| 存档/历史 | 工作台 + 世界管理 | 首页展示最近存档，完整管理放世界管理 |
| 聊天 | 工作台加载后状态 + 对话 | 保留现有 `CH` 与 `/api/llm/chat`，重排 UI |
| 消息复制/编辑/删除/收藏/候选 | 对话 | 保留现有 `/api/chat/message`，优化消息工具条 |
| 角色库 | 资料库/角色库 | 合并现有 `characters` 页 |
| 世界书编辑器 | 资料库/世界书 | 合并现有 `worldbook` 页 |
| 炼金台导入 | 资料库/炼金台 | 从首页大块入口改为资料库子页，工作台保留快速入口 |
| 审核队列 | 资料库/审核队列 | 合并现有 `alchemy` 页 |
| 世界包 | 世界管理 | 合并现有 `worldpack` 页 |
| 连接档案 | 设置/模型连接 | 合并现有 `connections` 页 |
| 插件 | 设置/插件 | 合并现有 `plugins` 页 |
| 脉象 | 观测/世界脉象 | 合并现有 `telemetry` 页 |
| 构成 | 观测/世界构成 | 合并现有 `entities` 页 |
| 叙事黑盒 | 观测/叙事黑盒 | 合并现有 `narrative` 页 |
| 体检 | 观测/健康体检 + 设置/高级 | 合并现有 `health` 页 |
| 指令 | 对话命令面板 | 不再做一级页 |
| debug logs / raw JSON / engine manifest | 设置/高级 + 观测高级模式 | 默认隐藏 |

## 阶段计划

### Phase 0: 保护当前可运行状态

目标：在正式迁移前建立回退点和验收基线。

任务：

- 确认当前主项目能启动。
- 保存当前 `world-tree-console.*` 的行为基线。
- 跑一次完整验证。
- 不提交 v0 原型目录到主项目，避免引入 Next 依赖。

验证：

- `npm run preflight`
- `npm run test:unit`
- `npm pack --dry-run --json`
- `git diff --check`

### Phase 1: 建立新前端壳层

目标：把 13 个顶部 tab 收敛为 6 个一级入口，但尽量不改业务逻辑。

任务：

- 在 `world-tree-console.js` 中把 `CFG.tabs` 改为目标 6 页：`workbench`、`chat`、`library`、`worlds`、`observe`、`settings`。
- 保留旧 view 的 render 逻辑，但先通过新页面组合调用。
- 在 `world-tree-console.css` 中引入左侧导航、顶部状态栏、主工作区、上下文面板基础样式。
- 移动端改为底部导航 + 更多抽屉。

验收：

- 所有旧功能仍能通过新入口到达。
- 没有功能消失，只是位置变化。
- 桌面和移动端无横向滚动。

### Phase 2: 迁移工作台

目标：首页符合用户已经确定的规则：先展示世界书和存档，加载后对话框占主体。

任务：

- 重构首页为默认状态和加载后状态。
- 默认状态展示：当前世界、连接状态、回合数、世界书条目数、存档数、待审核数、世界书总览、存档总览。
- 加载后状态展示：对话主体、世界书小按钮、存档小按钮、叙事摘要入口、返回总览。
- 保留快速开始：拖拽文件/文件夹、粘贴文本、`.md/.txt/.json`、快速对话不保存正式记录。
- 工作台仅保留炼金台快捷入口，不承载完整炼金台。

验收：

- 点击加载后在工作台内进入对话，不跳到割裂页面。
- 世界书和存档能收起为按钮或抽屉。
- 快速开始仍可进入快速对话。

### Phase 3: 迁移资料库

目标：把角色库、世界书、世界数据、炼金台、审核队列收进一个页面。

任务：

- 新建资料库内部 tabs：角色库、世界书、世界数据、炼金台、审核队列。
- 角色库迁移现有导入、搜索、预览、备份、删除、开始 RP。
- 世界书迁移现有加载、新增、编辑、启停、删除、触发测试。
- 炼金台迁移粘贴/拖拽/提取到审核队列。
- 审核队列迁移确认、合并、忽略、结构数据展开。
- 世界数据展示实体、角色、场景、组织、地点、关系、时间线、规则。

验收：

- 原 `characters`、`worldbook`、`alchemy` 的主要操作全部可达。
- 未确认内容不会写入正式世界数据。

### Phase 4: 迁移对话

目标：对话页面和工作台加载后状态共用同一套聊天体验。

任务：

- 优化消息工具条：复制、编辑、删除、收藏、重生成、候选切换。
- 添加清空当前对话确认弹窗。
- 把命令页改为 `/` 命令面板或按钮弹窗。
- 右侧上下文显示世界书命中、角色状态、记忆快照、Direction Packet、Guardian。
- 移动端上下文为底部抽屉。

验收：

- `/api/llm/chat` 和 `/api/chat/message` 行为不退化。
- 候选回复刷新后仍依赖现有持久化逻辑。

### Phase 5: 迁移世界管理

目标：世界级操作独立出来，避免干扰创作主流程。

任务：

- 世界/模块列表迁入世界管理。
- 新建世界、从模板创建、从素材创建、删除世界。
- 最近存档和分支状态展示。
- `.worldtree` 导入导出和摘要确认。
- 备份入口。
- 危险操作区独立并二次确认。
- 旧版数据导入导出放到高级/数据工具，不作为主入口。

验收：

- `.worldtree` 默认排除 secrets 和私密 runtime。
- 删除和覆盖类操作有确认。

### Phase 6: 迁移观测与设置

目标：把技术功能后置，同时保持创作者可观察叙事。

观测任务：

- 合并脉象、构成、叙事黑盒、健康体检。
- 默认显示摘要。
- 原始 JSON、Direction Packet 详情、Guardian 详情折叠。
- 高级模式显示 engine manifest 和 debug logs。

设置任务：

- 合并连接档案、插件、数据与备份、外观、高级。
- API Key 输入只在设置里展开。
- 插件权限、manifest、错误状态放在插件页。
- 开发者模式控制 raw/debug/manifest 展示。

验收：

- 原 `telemetry`、`entities`、`narrative`、`health`、`connections`、`plugins` 功能都有新位置。
- 普通用户第一屏不看到 debug 信息。

### Phase 7: 视觉与响应式收尾

目标：把 v0 的视觉优势迁入，但不复制 React/Tailwind 代码。

任务：

- 从 v0 原型提炼颜色、间距、按钮、卡片、分段控件、抽屉、弹窗样式。
- 落到 `world-tree-console.css` 的 CSS variables 和组件类。
- 修复移动端布局：底部导航、抽屉、触控尺寸、无横向滚动。
- 检查中文文案。

验收：

- 桌面、平板、手机宽度可用。
- 文本不重叠。
- 按钮可点击区域合理。
- UI 不再像 13 个 tab 的调试面板。

## 不建议直接迁移的内容

- 不要复制 `F:\world-tree\app`、`components`、`lib` 到主项目作为生产前端。
- 不要把 `pnpm-lock.yaml`、Next、React、Tailwind 依赖加入主项目，除非另开技术栈迁移决策。
- 不要使用 v0 mock 数据作为真实默认内容。
- 不要保留具体故事素材。
- 不要用 v0 的空状态替代已有真实 API 功能。

## 主要风险

- 当前 `world-tree-console.js` 已经很大，继续在单文件里堆 UI 会增加维护难度。
- 直接大改导航可能导致旧事件绑定失效。
- 工作台和对话共用聊天组件时，要避免状态重复和消息丢失。
- 世界书/存档在首页展示摘要时，不能误导用户以为首页可完整编辑。
- 高级调试功能隐藏后，开发者仍需要容易找到入口。

## 建议执行顺序

1. 先做 Phase 1 + Phase 2，解决最大的信息架构问题和首页规则。
2. 再做 Phase 3，资料库是功能最多的区域，需要单独验证。
3. 接着做 Phase 4，统一聊天体验。
4. 最后做 Phase 5 + Phase 6 + Phase 7，收纳管理、观测、设置和视觉细节。

## 每阶段验证命令

```bash
npm run preflight
npm run test:unit
npm pack --dry-run --json
git diff --check
```

前端视觉验证：

- 桌面宽度：1365px。
- 平板宽度：768px。
- 手机宽度：390px。
- 检查工作台、加载后对话、资料库、世界管理、观测、设置。
- 检查无控制台错误、无空白主界面、无横向滚动、核心按钮可点击。
