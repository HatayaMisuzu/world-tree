# World Tree V1 功能清单

## 用户功能

| 功能 | 状态 |
| --- | --- |
| 快速创建设定项目 | active |
| 人物卡创建/编辑/互动 | active |
| 世界书大世界探索 | active |
| 桌面叙事（单人跑团） | active |
| 解谜调查 | active |
| 策略模拟 | active |
| 单人剧本杀 | active |
| 项目导出/导入 | active |

## 创作功能

| 功能 | 状态 |
| --- | --- |
| 炼金台（灵感→蓝图→资产→项目） | active / conservative UI |
| 人物卡解析（plain/V1/V2/CHARACTER.md） | active |
| 世界书条目管理 | active |
| 提案审核 | active |

## 模式入口

| 入口 | V1 能力边界 |
| --- | --- |
| quick-setting | 粘贴设定，快速创建草稿 |
| character | 导入/编辑/互动/导出（不做多角色群聊、长期记忆） |
| world-rpg | 世界书探索、上下文激活、提案（不做传统 RPG 系统） |
| tabletop | 轻量检定、时钟、叙事（不做完整 DND） |
| mystery-puzzle | 线索、假说、答案锁（不做复杂推理判定） |
| strategy-sim | 阵营、资源、回合、外交（不做完整 4X） |
| murder-mystery | 案件、嫌疑人、真相锁（不做多人派对） |
| creation-forge | 灵感→蓝图→资产→项目（不做图片生成） |

## 存档/导出

| 功能 | 状态 |
| --- | --- |
| 项目文件夹结构 | active |
| .worldtree 导出/导入 | active |
| 提案日志 | active |

## 开发/测试

| 功能 | 状态 |
| --- | --- |
| 单元测试覆盖 | active |
| 集成测试覆盖 | active |
| preflight 全量检查 | active |
| 接口审计 | active |
| 文档检查 | active |

## P0-P2 可用性状态

| 能力 | 用户入口 | 实际边界 |
| --- | --- | --- |
| Living World / Stability sidecar | 每个真实 LLM turn、mode-runner debug | 预算化提示；不直接写 canon |
| Branch runtime | 世界内核面板与 API | 单活动分支；无 merge |
| Telemetry | 面板刷新与 latest/refresh API | 只输出低/中/高等枚举，不生成剧情 |
| Auto-light | 面板单次预演 | 最多一个 beat；遇选择/隐藏信息/critical 即停止 |
| Critical proposal / stop-loss | 面板二次确认、逆操作 | 逆操作仍是 pending proposal |
| Processing candidates | 面板素材导入、候选投递 | 仅 Growth Tree/proposal queue，不直接写世界书 |

## 工作流能力 (Current)

| 工作流 | 用户入口 | 说明 |
|--------|---------|------|
| Creation Wizard | creation-forge → 创建世界 | M1 六阶段向导；初始化写入需用户确认 |
| Alchemy Digest | creation-forge → 导入素材 | M2/M3 候选提取；不直接写 shared |
| Play Turn | world-rpg/tabletop 对话 | LLM adapter + post-check；default candidate-only |
| Character Chat | character 模式 | M4/M5 角色一致性与认知边界 |
| Mystery Investigate | mystery/murder-mystery | M5/M7/M8 真相锁保护 |
| Strategy Turn | strategy-sim | M6/M7/M8 阵营图与规则审查 |
| Workflow Debug | 控制台 Workflow 面板 | /api/workflow/status；safe redacted summary |

## 下一步 (Next)

- Real Play Productization：scenario runner, smoke scenarios, UX verification
- Deep UX (dice, clue board, resource panel)：ROADMAP CANDIDATE — 见 docs/ROADMAP_CANDIDATES.md
