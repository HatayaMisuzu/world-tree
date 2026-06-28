# Worldbook V2 设计想法方案

Worldbook V2 是 World Tree 的世界知识生命周期与上下文编译层。

它不是单纯的酒馆 lorebook 复刻，也不是依赖项目资产表本身判断完成度。它以真实模块能力为基础，吸收 SillyTavern / NovelAI 在世界书触发、插入、预算、分组、隐藏和上下文编译上的成熟设计。

## 核心链路

```text
module/material/turn output
→ candidate
→ review/confirm
→ canon entry
→ trigger
→ context pack
→ prompt block
→ usage log
```

## 第一阶段不做

- 完整 UI 编辑器
- 复杂导入导出
- 脚本自动化
- embedding 服务
- 无限递归
- 直接替换旧 M2
