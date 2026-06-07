审查记录。AI 无需阅读此文件。

## v12.19 (2026-06-01)

- 新增 M19 角色卡驱动模式：与世界书模式并列的第二驱动入口
- 核心区分：角色卡 ≠ M8角色预设，两套独立体系互不混用
- 控制台自动识别：加载JSON→检测结构→打标签【世界书】/【角色卡】
- DM姿态双模：世界书=DM在场引导提案，角色卡=DM完全隐退纯叙事无标记
- 角色卡格式吸收 creation-skill 四层优化：人格底盘+表达DNA+场景响应+知识边界
- 关系追踪完全隐形叙事化，无任何数值面板
- M9认知层重构：聚焦"角色对user的认知"+"角色自身秘密"
- M3轻量化+M17框架就位暂不触发，以用户括号提示引导事件
- 存档类型隔离：[W]前缀=世界书，[C]前缀=角色卡，跨模式读档阻断
- 新增 references/M19-角色卡驱动.md（11章完整规范）
- 模块映射表新增角色卡类型列
- 数据目录新增 saves/ 及模式标签
- 真相源 → SKILL.md → references → writer档案全链路同步

审查结论：通过（新增模块为独立驱动入口，不破坏世界书模式现有流程。两种卡泾渭分明，存档隔离到位）

- SKILL.md §9 新增：世界书创作方法论（创作工具·非引擎模块）
- 新增 references/M-世界书创作方法论.md v1.0：六步法+原则工具箱+三维必检维度
- 世界书制作检查清单.md 追加：创作完整流程+原则工具箱章节

审查结论：通过（新内容为独立章节+独立参考文件，不破坏引擎现有引用和流程）

## v12.16 (2026-06-01)

- 控制台新增单文件世界书加载：FileAccess.pickFile() + fromFile() + _wbDetect
- DataStore.buildModel() 新增 single-file 模式，直接从 .json 构建模块
- 概览 Tab 适配：世界书文件模式下显示条目数/类型分布/前15条预览
- Normalizers.worldbook() 用第一条触发词作条目标题
- 落地页新增「选择世界书文件」按钮
- §2 新增世界书导出目录 D:\模组\ 说明
- §8.5 新增 Profile 分工表（default做世界书/writer跑游戏）
- 控制台同步到 writer profile

审查结论：通过（新增功能不破坏已有流程，单文件模式下 fallback 兼容良好）

## v12.10 (2026-05-31)

- M2语义匹配：新增 `匹配模式` 字段（精确/语义/精确+语义），LLM语义判断回退
- §3.2 步骤编号修复：1→13 无重复无缺口，删除重复的审查步骤
- SKILL.md 指令注册行新增 `/世界书 match-mode`
- AI维护手册更新：v12.3→v12.10，新增跨档案同步规则+步骤编号审计模式

## v12.9 审计修复 (2026-05-31)

- 发现并修复：writer profile config.yaml `personality: kawaii` → `writer`
- writer 描述升级：v12.8缩略版 → v12.9 + SOUL.md引用
- SOUL.md 幽灵指令删除：`/世界树确认`（不存在于任何skill）、`/状态` → `/世界状态`
- SOUL.md 四项补全：双工作模式(DM/写作教练)、主动推进规则、暧昧阈值、快速开始初始化
- 路径统一：`~/.hermes/` → `C:\Users\Lenovo\AppData\Local\hermes\` (Windows)
- 模块命名：M15a/M15b → M15/M15c，M18 加入映射表
- 真相源 v12.5→v12.9 (后升至v12.10)
- M15-世界规则.md header M15a→M15
- M-引擎隔离架构版本更新 v12.2→v12.9
- 确认 D:/world-tree-data 存在且有内容

## v12.9 (2026-05-31)

- 新增 §8 可视化控制台与作家工作台
- 新增 references/控制台与作家档案.md（设置指南）
- 控制台 world-tree-console.html 已包含完整对话面板（SSE流式 + localStorage + 写作剪贴板）
- writer profile 配置：port=18742 platform=api_server, personality=writer
- 关键坑：API Server 端口在 platforms.api_server.extra.port 而非 api_server.port

审查结论：通过（新增内容为独立章节，不破坏现有引用）

## 2026-06-02 — v12.19 漏洞修复：真相源/模板/旧入口同步

- 修复版本漂移：SKILL、导航、AI维护手册、维护规范统一声明当前内容权威版本为 v12.19。
- 修复旧入口漂移：`自主输出小说模式.md` 标记为历史归档，当前运行入口固定为 `自动推进模式.md`。
- 修复独立 skill 冲突：旧 novel-engine 指针改为“如恢复则纳入 world-tree M-子模块”。
- 同步 D:/world-tree-data/_engine 模板到 v12.19，并新增角色卡模式运行字段与 R 子agent profile。
- 修正 M14 移除日期为 2026-06-02，避免未来日期造成生效歧义。

## 2026-06-02 — 优化升级：合约自检与 M19 测试样例

- 新增 `scripts/world_tree_contract_check.py`：检查 truth-source、SKILL、导航、维护手册、writer 镜像、`D:/world-tree-data/_engine` 模板与 M19 样例索引。
- 新增 `references/M19-最小测试样例.md`：世界书、角色卡、双重命中、未知格式四类导入样例。
- 控制台升级到 v1.2.0，体检页新增合约漂移检查清单和脚本路径。
- 真相源、导航和审计清单加入合约自检脚本要求。

## 2026-06-02 — 创新升级：叙事雷达/情绪惯性/生长树/发版审计

- 新增 6 个创新模块文档：叙事一致性雷达、M19 情绪惯性、世界书生长树、分支差异叙事摘要、素材吸收评分器、一键发版审计。
- 新增 `scripts/world_tree_release_audit.py`：串联合约自检、shared/writer validator 与 `_engine` JSON 解析。
- 控制台升级到 v1.3.0，体检页加入一键发版审计脚本路径和放行条件。
- 真相源新增 `innovation_modules` 与 release audit 检查项。
