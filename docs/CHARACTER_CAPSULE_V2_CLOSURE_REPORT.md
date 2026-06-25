# Character Capsule V2 — Final Closure Report

> 状态：CLOSED / MVP COMPLETE
> 日期：2026-06-25
> 封版 commit：待定

## 当前 HEAD

见最终提交。

## 已完成阶段

| 阶段 | 描述 | 状态 |
|------|------|:--:|
| V2 Foundation | Text-first 角色基础、运行契约、认知边界、表现指纹种子、高级设置 gate | ✅ |
| V2-1 | 角色创建、预览、V2 sidecars 持久化、manual avatar UI-only | ✅ |
| V2-1.1 | CI/test 注册硬化、avatar UI 完成、capsule summary polish | ✅ |
| V2-2 | Runtime Context Bridge：只读上下文快照，不注入 LLM | ✅ |
| V2-3 | Runtime MVP：Prompt Packet Preview、First-turn Template、Candidate Hooks | ✅ |
| V2-4 | Live Runtime Turn：writer-only LLM 路径、受控回复、质量风险检查 | ✅ |
| V2-5 | Candidate Workbench、确认写入 V2 sidecars、Text-first export | ✅ |
| Closure | 最终审查、修补、测试、文档封版 | ✅ |

## 架构不变量（已核查）

1. **Text-first**：角色 V2 主体是文本角色胶囊，不做图片理解 ✅
2. **Manual avatar**：头像永远 UI-only，不参与 prompt/认知/记忆/导出语义 ✅
3. **LLM 路径**：V2 live turn 只能走 `/api/characters/v2/turn`，writer-only，不改全局 LLM 主流程 ✅
4. **写入边界**：候选确认只写 `data/engine/characters/<id>/v2/` 下的 sidecars ✅
5. **禁止污染**：不写 world canon、proposal、global memory、worldbook、kernel proposals ✅
6. **高级隐藏**：prompt packet、debug、advancedSummary、raw JSON 默认隐藏 ✅
7. **用户确认**：memory/relationship/quality candidate 必须用户确认后才落 sidecar ✅
8. **Legacy 兼容**：旧 ST v2/v3 JSON/PNG 导入、旧 character_card、世界书、Alchemy、Workflow、Kernel 不被破坏 ✅

## 已修补问题

- candidate decision 标准化（approve/approved → approved，reject/rejected → rejected）
- 高级设置面板文案更新（"未实现" → "已启用 Text-first Runtime"）
- rpCharacter toast 更新（"尚未注入 LLM" → "可在 V2 角色回复面板中进行受控 Text-first 回复"）
- 最小 candidate save + export UI 按钮

## 未完成但明确延后

- 完整 Character Engine 多角色调度
- group chat
- CHARX
- PNG/JPG metadata 语义解析
- 图片理解 / 多模态角色理解
- Live2D / voice / 表情图
- 自动写 canon/proposal/global memory
- 跨世界自动同步关系
- 完整高级编辑器

## 不再继续扩展的范围

- 不实现完整 Character Engine runtime
- 不进行 LLM prompt 注入自动调度
- 不做跨模式 live sync
- 不做关系持久化自动提案

## 验收命令结果

全部通过，见 CI 和本地验证记录。

## 剩余风险

- GitHub Actions CI 偶发 flaky test（creation-forge / character-roundtrip fetch failed），rerun 可通过
- V2 live turn 依赖用户已配置 LLM，未配置时返回友好错误
- 候选 workbench UI 为最小实现，未提供批量审批
