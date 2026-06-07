# worldbook.json 条目 JSON 格式参考

## 用途

当直接用 `write_file` 创建或编辑世界书时（而非用 `/世界书 add` 指令），遵循此 JSON 格式。

## 文件位置

`<模组名>/shared/worldbook.json`

## 文件结构

```json
{
  "_说明": "可选的说明文本",
  "version": "1.0",
  "module": "模组名（可选）",
  "entries": []
}
```

## 条目字段映射表（M2 YAML → JSON）

| M2 字段（YAML 描述） | JSON 字段名 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| 触发词 | `trigger` | string[] | ✅ | 1-5个关键词或正则(`/pattern/`) |
| 内容 | `content` | string | ✅ | 50-500字结构化描述 |
| 模式 | `mode` | string | ✅ | `"触发"` / `"常驻"` / `"禁用"` |
| 注入层级 | `layer` | string | 默认context | `"base"` / `"context"` / `"instant"` |
| 优先级 | `priority` | number | ✅ | 1-100，数值越小优先级越高 |
| 扫描深度 | `scan_depth` | string | 默认中距 | `"近距"` / `"中距"` / `"远程"` / `"全局"` |
| 触发方式 | `trigger_event` | string | 可选 | `"关键词"` / `"场景变化"` / `"两者"` |
| 关键词匹配 | `match` | string | 默认任一 | `"任一"` / `"全部"` |
| 匹配模式 | `match_mode` | string | 默认精确 | `"精确"` / `"语义"` / `"精确+语义"` / `"两者"` |
| 允许概念延伸 | `allow_extend` | boolean | 默认false | `true` / `false` |
| 作用范围 | `scope` | string | 默认全局 | `"全局"` / `"当前场景"` |
| 首次触发后保持 | `keep_on_first_trigger` | boolean | 可选 | `true` / `false` |
| 条目类型 | `type` | string | ✅ | `"人物"` / `"地点"` / `"事件"` / `"物品"` / `"规则"` / `"概念"` / `"组织"` / `"未分类"` |

## 完整条目示例

```json
{
  "trigger": ["武侠江湖", "武侠", "江湖"],
  "content": "九大门派，恩怨情仇。一剑能断江，一诺能赴死。可攻略角色4人：正道大弟子、魔教圣女、隐退的杀手、总在客栈角落独自饮酒的浪客。主线碎片50，支线碎片20。",
  "mode": "触发",
  "layer": "context",
  "priority": 30,
  "scan_depth": "远程",
  "match": "任一",
  "match_mode": "精确+语义",
  "scope": "全局",
  "type": "地点",
  "allow_extend": true
}
```

## 常驻条目示例

```json
{
  "trigger": ["行者", "旅行者"],
  "content": "行者——穿梭于万千世界之间的旅人。不属于任何一个世界，但能进入每一个世界。",
  "mode": "常驻",
  "layer": "base",
  "priority": 1,
  "scan_depth": "全局",
  "match_mode": "精确+语义",
  "scope": "全局",
  "type": "规则"
}
```

## 规则

1. 常驻条目(`mode: "常駐"`)不依赖关键词匹配，自动注入 base 层。`trigger` 字段在常驻模式下仅供语义匹配参考。
2. 禁用条目(`mode: "禁用"`)完全跳过关键词扫描。
3. 优先级越小越先注入，建议：核心规则1-5，地点20-60，事件/物品60-100。
4. 注入层级：base=叙事开头（世界法则），context=情境区（角色/地点），instant=输入前（最新状态）。
5. 扫描深度控制关键词出现在多少条历史消息内才激活：近距=最近3条，中距=最近5条，远程=最近10条，全局=不限。
6. `match_mode: "精确+语义"` 时先做精确词/正则匹配，未命中回退到LLM语义判断。

## 文件创建步骤

1. 从 `_engine/templates/branch/shared/worldbook.json` 复制模板
2. 在 `entries` 数组中添加条目，严格按上述字段映射表
3. 确认所有必填字段完整
4. 确认常驻条目不超过3条且注入 base 层
5. 确认条目内容为结构化简要描述，非小说语言
