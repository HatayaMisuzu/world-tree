# M-子agent协作 — 多agent并行叙事架构

> 版本: v12.2  
> 层级: 引擎基础架构（高于模块）  
> 配置: `D:/world-tree-data/_engine/agent_profiles.json`

---

## 一、定位

子 agent 协作是世界树模式下的增强分析层，不是强制依赖的唯一执行路径。

原则：
- 能并行时并行
- 超时或不可用时主 agent 接管
- 只传精简事实视图
- 只返回候选、冲突检查与来源引用

---

## 二、统一参数

```
默认数据目录: D:/world-tree-data（可由宿主环境配置项覆盖）
超时: 90s
result 大小限制: 2KB
路径格式: 全部使用正斜杠 /
```

---

## 三、职责划分

### 主 agent

- 确认当前模式和世界类型
- 决定是否派发子 agent
- 准备 task 输入
- 读取和融合 result
- 负责统一清理 `_temp/` 下的 task.json 和 result.json
- 核对 `branches/<active_branch>/canon_state.json` 后提交 confirmed 变化至正式状态文件
- 负责所有降级处理

### 子 agent

- 读取任务指定的事实视图与模块状态
- 输出精简候选、冲突检查、来源引用和待决问题
- 将待提交变化标记为 `proposed`
- 将临时结果写入 `_temp/` result 文件

---

## 四、统一隔离规则

1. 子 agent 的输入集合由 task 中的指定文件定义
2. 子 agent 的输出集合限定为候选、冲突检查、来源引用与待决问题
3. 子 agent 的写入目标限定为 `_temp/` 下的 result 文件
4. 正式状态文件的提交角色固定为主 agent
5. 主 agent 以 `branches/<active_branch>/canon_state.json` 为依据完成 confirmed 提交

---

## 五、调度规则

### 正常调度

```
0. 主agent确认当前处于世界树模式
1. 判断世界类型与是否需要子agent
2. 为各层准备包含 `branches/<active_branch>/canon_state.json` 的精简 task
3. 并行派发 W/C/S
4. 等待结果，单个超时阈值为 90s
5. 主agent读取 result 并统一清理临时文件
6. 主agent将 result 作为 proposed 候选并核对事实台账
7. 主agent生成最终叙事并提交 confirmed 状态
```

### 跳过调度

以下情况默认不派发子 agent：

- 日常对话模式
- 世界树模式中的日常插话
- 用户仅发极短续写指令且场景未发生实质变化
- 只需做轻量状态回显
- erotic-writing 已接管当前段落

---

## 六、降级规则

### 单个子 agent 超时

- 超时阈值：90s
- 处理方式：跳过该层，由主 agent 补足
- 不阻塞其他层结果融合

### 并行派发能力不可用

- 直接降级为单 agent 模式
- 主 agent 自行完成 W/C/S 三层分析

### result 非法或为空

- 丢弃该结果
- 主 agent 自行补足对应层

---

## 七、路径规则

所有示例路径统一使用正斜杠：

```
D:/world-tree-data/奇幻大陆/world_state.json
D:/world-tree-data/_temp/奇幻大陆_W_result.json
```

JSON 示例和运行路径统一采用 `/`。

---

## 八、task.json 格式

```json
{
  "agent_id": "W",
  "模组名": "奇幻大陆",
  "轮次": 42,
  "任务": "基于已确认事实分析世界氛围，输出候选动态、冲突检查与来源引用",
  "读取文件": [
    "D:/world-tree-data/奇幻大陆/branches/<active_branch>/canon_state.json",
    "D:/world-tree-data/奇幻大陆/world_state.json",
    "D:/world-tree-data/奇幻大陆/organizations.json",
    "D:/world-tree-data/奇幻大陆/timeline.json"
  ],
  "上下文摘要": "艾琳刚抵达王都，发现城门戒备森严。上一轮卡修斯元帅拒绝了回都述职的命令。",
  "输出格式": "json",
  "输出路径": "D:/world-tree-data/_temp/奇幻大陆_W_result.json"
}
```

---

## 九、result.json 格式

```json
{
  "agent_id": "W",
  "轮次": 42,
  "候选组织动态": ["会议线索可作为后续事件候选"],
  "冲突检查": [],
  "来源引用": ["canon_state.json", "shared/organizations.json"],
  "待决问题": ["该会议是否在本轮正式发生？"]
}
```

result 中的内容默认归入 `proposed`；主 agent 核对后将成立的变化提交为 `confirmed`。

---

## 十、世界树模式中的日常插话

明确规定：

- 不派发子 agent
- 不包裹世界树标记
- 不写回叙事运行时
- 可正常作为真实对话处理（进入 memory）
- 回复完成后保留当前模组加载状态

---

## 十一、维护备注

如果将来继续升级子 agent 协议，优先只改三处：

1. 统一参数区
2. 调度规则
3. JSON 示例

超时、路径、降级策略与事实权限均以规范真相源为同步依据。
