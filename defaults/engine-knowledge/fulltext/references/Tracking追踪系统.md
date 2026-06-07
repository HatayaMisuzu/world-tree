# 世界树引擎 — Tracking 追踪系统

> 变更追踪、伏笔管理、冲突记录、参数快照规范 v1.0
> 定位：为所有模块提供统一的变化追踪能力，减轻各模块数据文件和 memory 的压力

---

## 设计原则

### 核心思想：当前值 vs 变化史分离

```
模块数据文件（当前状态）         Tracking系统（变化历史）
─────────────────────────       ─────────────────────────
branches/<active_branch>/canon_state.json                change-log.jsonl
  "帝国状态": "战争"               "帝国状态: 繁荣→战争 (2026-05-26 14:30)"

world_state.json                parameter-snapshots.json
  当前值只有一行                  每次存档时的完整参数快照

characters.json                 foreshadowing.json
  角色当前位置/体力等              哪些伏笔埋了还没回收

无冲突记录                       conflicts.json
                                  什么时候发生了冲突、怎么解决的
```

模块数据文件只存当前状态（1行），追踪系统存历史记录（多行追加）。读取时模块文件轻量，追溯历史时查追踪文件。

### 对 memory 的减负

| 之前 | 之后 |
|------|------|
| memory 里要记"艾琳的设定改过3次" | memory 不记，查 change-log.jsonl |
| 每次存档打包全部历史 | 存档只引用 tracking 文件，增量更新 |
| 伏笔状态靠毛球脑子记 | 查 foreshadowing.json 就看清 |
| 参数调整后想回溯找不到旧值 | 查 parameter-snapshots.json |

### 存储位置

```
D:/world-tree-data/模组名/tracking/
├── change-log.jsonl              ← 变更日志（追加式）
├── foreshadowing.json            ← 伏笔追踪
├── conflicts.json                ← 冲突记录
├── parameter-snapshots.json      ← 参数快照
├── parameter-history.jsonl       ← 参数变更历史（追加式）
├── checkpoints.json              ← 检查点
└── tracking-index.json           ← 追踪索引
```

每个模组独立一个 tracking/ 目录。追踪文件不与模块数据文件交叉。

---

## 一、变更日志 (change-log.jsonl)

### 用途

记录所有模块关键数据的变更历史，每条一行 JSON。追加式写入，不覆盖。

### 记录时机

- branches/<active_branch>/canon_state.json 中任何事实被 `confirmed` 更新
- world_state.json 中状态变量值改变
- characters.json 中角色位置/体力/情绪/认知变化
- organizations.json 中组织状态/关系变化
- timeline.json 中时间推进
- 存档/读档操作
- 用户通过指令手动修改任何数据

### JSONL 格式（每行一条）

```json
{
  "id": "cl-20260526-001",
  "timestamp": "2026-05-26T14:30:00",
  "source": "user",
  "target_file": "branches/<active_branch>/canon_state.json",
  "field_path": "帝国状态",
  "old_value": "繁荣",
  "new_value": "战争",
  "reason": "用户指令: /世界状态 set 帝国状态: 战争",
  "session_id": "session-042",
  "module": "M3",
  "change_type": "state_update"
}
```

### 字段说明

| 字段 | 必填 | 说明 |
|------|------|------|
| `id` | ✅ | 唯一标识，格式 `cl-日期-序号` |
| `timestamp` | ✅ | ISO时间戳 |
| `source` | ✅ | `user` / `engine` / `subagent-W` / `subagent-C` / `subagent-S` / `random_event` |
| `target_file` | ✅ | 哪个数据文件被修改 |
| `field_path` | ✅ | 修改的具体字段路径（如 `角色/艾琳/位置`） |
| `old_value` | 可选 | 旧值（新建时为空） |
| `new_value` | ✅ | 新值 |
| `reason` | ✅ | 变更原因（指令/事件/自动推导） |
| `session_id` | 可选 | 会话ID |
| `module` | 可选 | 关联模块（M3/M8/M16等） |
| `change_type` | ✅ | `state_update` / `fact_confirm` / `character_move` / `organization_change` / `timeline_advance` / `param_adjust` / `archive_save` / `archive_load` |

### 查询方式

```
毛球查询变更日志:
  "艾琳的位置是什么时候改的？"
  → 搜索 change-log.jsonl 中 field_path 包含 "艾琳/位置" 的记录

  "帝国状态的历史变化"
  → 搜索 field_path="帝国状态"，按时间排序输出

  "最近10条变更"
  → 读取最后10行
```

---

## 二、伏笔追踪 (foreshadowing.json)

### 用途

追踪所有已埋设的伏笔及其状态，防止遗忘和遗漏回收。

### 格式

```json
{
  "version": "1.0",
  "updated": "2026-05-26T14:30:00",
  "foreshadowing": [
    {
      "id": "fs-001",
      "content": "卡修斯在城门前拒绝回都述职",
      "type": "character_decision",
      "importance": "high",
      "planted_at": {
        "scene": "王都城门",
        "session_round": 12,
        "timestamp": "2026-05-25T10:00:00",
        "narrative_context": "艾琳抵达王都时，守门士兵提到卡修斯元帅..."
      },
      "hints_given": [
        {
          "hint": "守门士兵低声议论，提到元帅的名字时突然住口",
          "round": 12,
          "visibility": "subtle"
        },
        {
          "hint": "艾琳注意到城门岗哨数量是平时的两倍",
          "round": 12,
          "visibility": "obvious"
        }
      ],
      "planned_reveal": {
        "target_scene": "元老院对峙",
        "estimated_round": 25,
        "reveal_type": "dramatic_confrontation"
      },
      "actual_reveal": null,
      "related_to": ["M6-卡修斯与帝国关系", "M3-帝国政治状态"],
      "status": "active",
      "created_at": "2026-05-25T10:00:00"
    }
  ],
  "stats": {
    "total": 5,
    "active": 3,
    "resolved": 1,
    "abandoned": 1
  }
}
```

### 字段说明

| 字段 | 说明 |
|------|------|
| `id` | 伏笔唯一标识，格式 `fs-序号` |
| `content` | 伏笔内容描述 |
| `type` | 类型：`character_secret` / `character_decision` / `world_event` / `object_clue` / `prophecy` / `relationship_hint` / `mystery_element` |
| `importance` | `critical` / `high` / `medium` / `low` |
| `planted_at` | 埋设位置：场景名/会话轮次/时间戳/叙事上下文 |
| `hints_given` | 给出的提示线索列表（每条含：提示内容/轮次/可见度 subtle|obvious） |
| `planned_reveal` | 计划揭示信息（可选） |
| `actual_reveal` | 实际揭示记录（回收后填写） |
| `related_to` | 关联的模块数据（如 M6-关系名/M3-状态名） |
| `status` | `active` / `resolved` / `abandoned` |

### 自动提醒

当世界树模式推进到 `planned_reveal.estimated_round` 附近时（±5轮），毛球应自动提醒：
> 「提醒：伏笔 fs-001（卡修斯拒不回都）计划在第25轮左右揭示，当前第22轮。」

---

## 三、冲突记录 (conflicts.json)

### 用途

记录叙事中出现的冲突（事实矛盾、时间矛盾、角色行为不一致等），以及解决方案。避免重复排查同一冲突。

### 格式

```json
{
  "version": "1.0",
  "updated": "2026-05-26T14:30:00",
  "conflicts": [
    {
      "id": "cf-001",
      "type": "fact_contradiction",
      "severity": "critical",
      "description": "艾琳的眼睛在第3章是绿色，第8章变成了蓝色",
      "involved_entities": ["艾琳"],
      "involved_files": ["characters.json"],
      "detected_at": {
        "round": 35,
        "during": "consistency_check",
        "timestamp": "2026-05-26T11:00:00"
      },
      "resolution": {
        "decision": "确认眼睛为绿色，修正第8章",
        "resolved_by": "user",
        "resolved_at": "2026-05-26T11:05:00",
        "patches_applied": ["第8章第3段: 蓝色→绿色"]
      },
      "prevention": "将'艾琳/眼睛颜色'写入角色卡关键字段，新增眼睛颜色一致性检查规则",
      "status": "resolved"
    },
    {
      "id": "cf-002",
      "type": "timeline_conflict",
      "severity": "high",
      "description": "卡修斯在秋季大典（9月15日）当天同时出现在王都和北境前线",
      "involved_entities": ["卡修斯"],
      "involved_files": ["timeline.json", "characters.json"],
      "detected_at": {
        "round": 40,
        "during": "timeline_check",
        "timestamp": "2026-05-26T12:00:00"
      },
      "resolution": null,
      "status": "open"
    }
  ],
  "stats": {
    "total": 2,
    "open": 1,
    "resolved": 1
  }
}
```

### 冲突类型

| type | 说明 | 触发场景 |
|------|------|---------|
| `fact_contradiction` | 已确认事实之间矛盾 | 眼睛颜色不一致、设定冲突 |
| `timeline_conflict` | 时间线矛盾 | 同一人物同一时刻在不同地点 |
| `character_ooc` | 角色行为OOC | 角色做出了不符合性格/背景的行为 |
| `rule_violation` | 违反世界规则 | 普通人使用了魔法、物理规则被打破 |
| `cognitive_inconsistency` | 认知不一致 | 角色知道了不该知道的信息 |
| `organization_logic` | 组织行为逻辑矛盾 | 敌对组织和平共处、层级关系错乱 |
| `continuity_break` | 连续性断裂 | 前一场景的手铐下一场景消失了 |

### 自动检测触发

世界树模式中每轮自动执行（与一致性检查并行）：
1. 检查新叙事是否与 branches/<active_branch>/canon_state.json 冲突 → fact_contradiction
2. 检查时间线 → timeline_conflict
3. 检查角色认知范围 → cognitive_inconsistency
4. 如有冲突，自动记录到 conflicts.json 并提醒用户

---

## 四、参数快照 (parameter-snapshots.json)

### 用途

每次存档时自动保存所有模块关键参数的完整快照。支持版本间对比。

### 格式

```json
{
  "version": "1.0",
  "snapshots": [
    {
      "snapshot_id": "snap-001",
      "taken_at": "2026-05-26T14:30:00",
      "archive_ref": "第三章_王都陷落.json",
      "session_round": 45,
      "parameters": {
        "模块激活列表": ["M1","M2","M3","M4","M5","M6","M7","M8","M9","M10","M11","M12","M13","M15","M15b","M16","M17"],
        "规则严格度": "严格",
        "当前预设": "epic",
        "M17概率": { "轻松": "20-35%", "中等": "10-20%", "重大": "5-10%" },
        "M17冷却": { "轻松": "1-3轮", "中等": "3-5轮", "重大": "8-12轮" },
        "M16世界时间": "第三纪元 1274年 秋季",
        "M16个人时间": "艾琳抵达王都第3天",
        "活跃伏笔数": 5,
        "未解决冲突数": 1,
        "角色数": 12,
        "组织数": 8
      },
      "state_summary": {
        "当前场景": "王都城门",
        "在场角色": ["艾琳", "卡修斯", "守门士兵"],
        "叙事阶段": "展开",
        "主线进度": "艾琳试图进入王都但被卡修斯阻拦"
      }
    }
  ]
}
```

### 与存档的联动

存档时自动行为：
1. 创建存档 JSON（写入 branches/<active_branch>/archive/）
2. 同时创建参数快照（写入 parameter-snapshots.json）
3. 存档的 `_上下文引用` 中添加参数快照引用

读档时可以对比两个快照之间的差异。

---

## 五、参数变更历史 (parameter-history.jsonl)

### 用途

追踪世界树引擎运行期间所有动态参数的调整历史（M17概率区间/规则严格度/预设等）。追加式写入。

### JSONL 格式

```json
{
  "id": "ph-20260526-001",
  "timestamp": "2026-05-26T14:30:00",
  "parameter": "M17概率_轻松",
  "old_value": "20-35%",
  "new_value": "15-30%",
  "reason": "用户指令: /随机 prob 轻松=15-30",
  "source": "user"
}
```

---

## 六、检查点 (checkpoints.json)

### 用途

轻量级叙事节点标记，不等同于完整存档。用于快速标记关键转折点。

### 格式

```json
{
  "version": "1.0",
  "checkpoints": [
    {
      "id": "cp-001",
      "label": "艾琳进入王都",
      "scene": "王都城门",
      "round": 30,
      "timestamp": "2026-05-26T10:30:00",
      "significance": "主线第一个主要转折点",
      "characters_present": ["艾琳", "卡修斯"],
      "quick_note": "卡修斯被迫放行，但警告艾琳不要多管闲事"
    }
  ]
}
```

---

## 七、追踪索引 (tracking-index.json)

### 用途

所有追踪文件的中央索引，方便快速查询当前追踪状态。

### 格式

```json
{
  "version": "1.0",
  "updated": "2026-05-26T14:30:00",
  "files": {
    "change-log": {
      "path": "change-log.jsonl",
      "total_entries": 147,
      "last_entry_at": "2026-05-26T14:30:00"
    },
    "foreshadowing": {
      "path": "foreshadowing.json",
      "total": 5,
      "active": 3,
      "resolved": 1,
      "abandoned": 1
    },
    "conflicts": {
      "path": "conflicts.json",
      "total": 2,
      "open": 1,
      "resolved": 1
    },
    "parameter-snapshots": {
      "path": "parameter-snapshots.json",
      "total_snapshots": 3,
      "last_snapshot_at": "2026-05-26T14:30:00"
    },
    "parameter-history": {
      "path": "parameter-history.jsonl",
      "total_entries": 22
    },
    "checkpoints": {
      "path": "checkpoints.json",
      "total": 4
    }
  },
  "alerts": {
    "active_high_importance_foreshadowing": 2,
    "open_critical_conflicts": 0,
    "foreshadowing_near_reveal": ["fs-001"]
  }
}
```

---

## 八、追踪指令

| 指令 | 功能 | 示例 |
|------|------|------|
| `/追踪 status` | 查看追踪状态概览（活跃伏笔/未解决冲突/最近变更） | `/追踪 status` |
| `/追踪 changelog [N]` | 查看最近N条变更记录 | `/追踪 changelog 20` |
| `/追踪 伏笔 list` | 列出所有伏笔 | `/追踪 伏笔 list` |
| `/追踪 伏笔 add 内容` | 手动添加伏笔 | `/追踪 伏笔 add 卡修斯似乎认识艾琳的母亲` |
| `/追踪 伏笔 resolve ID` | 标记伏笔已回收 | `/追踪 伏笔 resolve fs-001` |
| `/追踪 冲突 list` | 列出冲突 | `/追踪 冲突 list` |
| `/追踪 冲突 open` | 列出未解决冲突 | `/追踪 冲突 open` |
| `/追踪 快照 compare ID1 ID2` | 对比两个参数快照 | `/追踪 快照 compare snap-001 snap-003` |
| `/追踪 检查点 add 标签` | 添加检查点 | `/追踪 检查点 add 艾琳与卡修斯对峙` |

---

## 九、与各模块的协作

### 各模块写入追踪的时机

| 模块 | 写入目标 | 触发条件 |
|------|---------|---------|
| 引擎核心 | change-log / parameter-history | 任何数据变更 |
| M3 世界状态 | change-log | 状态变量值变化 |
| M4-M7 组织 | change-log | 组织创建/删除/关系变更 |
| M8 角色 | change-log | 角色状态变化（位置/体力/情绪/认知） |
| M11 场景 | checkpoints | 场景转换时可选标记 |
| M15 规则 | change-log | 规则严格度调整 |
| M16 时间 | change-log | 时间推进 |
| M17 随机 | parameter-history | 概率/冷却调整 |
| 存档系统 | parameter-snapshots | 每次存档 |
| 一致性检查 | conflicts | 检测到矛盾时 |
| 叙事引擎 | foreshadowing | 检测或用户标记伏笔时 |

### 与存档系统的桥接

存档文件的 `_上下文引用` 中添加追踪引用：

```json
{
  "_上下文引用": {
    "压缩归档": "context/history/session_003.json.gz",
    "快照文件": "context/snapshot.json",
    "参数快照": "tracking/parameter-snapshots.json#snap-003",
    "伏笔状态": "tracking/foreshadowing.json",
    "变更截止": "tracking/change-log.jsonl#cl-20260526-147"
  }
}
```

读档时，追踪文件附带的快照可以用于恢复参数，但 change-log 只读不恢复（那是历史记录）。

---

## 十、性能考虑

### 追加式 vs 覆盖式

| 文件 | 写入方式 | 原因 |
|------|---------|------|
| change-log.jsonl | 追加（append） | 历史记录，永远不覆盖 |
| foreshadowing.json | 覆盖（overwrite） | 需要更新状态字段 |
| conflicts.json | 覆盖 | 需要更新 resolution |
| parameter-snapshots.json | 追加到数组 | 历史快照 |
| parameter-history.jsonl | 追加 | 历史记录 |
| checkpoints.json | 覆盖 | 添加新检查点 |
| tracking-index.json | 覆盖 | 每次有变更时更新统计 |

### 文件体积管理

- change-log.jsonl 和 parameter-history.jsonl 每条约 200 字节
- 1000 条记录约 200KB，10000 条约 2MB
- 超过 1000 条时可触发压缩（合并连续的同字段变更）
- 压缩后旧记录写入 `tracking/archive/change-log-2026-05.jsonl.gz`

---

## 版本

- 版本: v1.0
- 对应: world-tree v12.2
- 设计参考: novel-writer-skills tracking 系统 + 世界树现有数据结构
