# Character Capsule V2 UI Rules — Advanced Settings Gate

> Status: UI design rule draft. Not implemented.

## 1. Core Rule

高级设置、高级编辑、模块调用、Prompt 预览、OOC 分数、回归测试结果不得污染普通 UI。

普通用户默认只看到角色体验相关内容。

## 2. Default Character UI

默认角色页只显示：

- 角色头像（手动导入，仅展示）。
- 角色名字。
- 角色简介。
- 当前关系摘要。
- 最近记忆摘要。
- 开始互动 / 继续互动。
- 待确认变化。
- 导入 / 导出。
- "高级设置"按钮。

## 3. Advanced Settings Button

必须有一个显式按钮：

```text
高级设置
```

点击后才显示高级区域。

高级区域可包含：

- 完整 profile 字段。
- 表现指纹编辑。
- 记忆详细管理。
- 关系详细管理。
- Lore 管理。
- CHARACTER.md 预览 / 导出。
- Prompt 预览。
- 模块调用摘要。
- OOC / drift 分数。
- Dialogue regression。
- Token budget。
- 来源映射。

## 4. Visual Requirement

高级区域必须：

- 默认折叠。
- 不占据首屏主要体验位置。
- 不用红色/警告色制造压力，除非真正错误。
- 用"高级设置"或"开发/调试"语义，不使用"错误""异常""OOC 失败"作为普通用户默认提示。

## 5. User-facing Language

不要显示：

- `OOC score = 0.82`
- `token budget exceeded`
- `module hook failed`
- `prompt packet block missing`

普通提示应改为：

- "这次回复可能不太符合角色设定，要重新生成吗？"
- "发现一条可能值得保存的记忆。"
- "关系似乎有一点变化，是否保存？"

## 6. Testing Requirement

UI 测试或 interface audit 至少确认：

- 页面默认不显示高级面板。
- 页面存在高级设置按钮。
- 点击按钮后高级面板可见。
- 高级面板关闭后普通角色 UI 不受影响。
- 普通 UI 不出现 OOC / token / prompt / module 等技术文本。
