# 内容系统 · 架构设计 v1

> 定位：统一内容类型注册表 + LLM 提案管道，让新增内容类型无需改引擎核心。

## 一、内容注册表 (content-registry.js)

### 问题
引擎核心硬编码处理角色/组织/场景等类型——新增"地点/物品/势力/魔法体系"需改多处代码。

### 方案：声明式注册表

```
新增内容类型 = 在 CONTENT_TYPES 数组中加一条声明：
  { id, category, priority, schema, searchFields, injectionWeight, changeLevelRules }
```

### 核心设计

| 概念 | 说明 |
|------|------|
| **12 种内置类型** | character / organization / location / item / faction / scene / timeline / relation / rule / worldbook-entry / myth / technology |
| **4 级变更分级** | LIGHT(自动)→MEDIUM(自动+日志)→MAJOR(暂停提示)→CRITICAL(用户确认) |
| **变更规则** | 按类型配置：何种操作算 LIGHT、何种算 CRITICAL |
| **注入权重** | 每种类型设定 LLM 注入优先级（角色=10 最高） |
| **Schema 关联** | 可选的 JSON Schema 路径，用于数据验证 |

### 关键接口

```js
CONTENT_TYPES           // 完整类型列表
findByModule(moduleId)  // 按模块筛选
findByCategory(cat)     // 按分类筛选 (entity/system/meta)
findById(id)            // 按 ID 查找
searchableFields(type)  // 可搜索字段列表
injectableTypes(mode)   // 某模式下可注入的类型
```

## 二、提案系统 (proposal-system.js)

### 问题
LLM 的变更建议缺乏分级管控——重要变更（角色死亡）不应被自动执行，微小调整（状态更新）不应用户确认。

### 方案：确认管道

```
LLM 输出标记段
  → 解析出变更提案 { type, path, value, level }
  → level=light → 自动执行
  → level=major → 暂停，入待确认队列
  → level=critical → 止损窗口倒计时，超时自动取消
```

### 核心设计

| 概念 | 说明 |
|------|------|
| **止损窗口** | CRITICAL 提案有 N 轮期限，超时自动回收 |
| **待确认队列** | 每世界独立队列，支持批量/单条确认 |
| **回滚能力** | 已确认提案可逆操作保留回滚记录 |
| **Tick 机制** | 每轮 tick 推进老化计数，超期自动清理 |

### 关键接口

```js
proposalList({worldName, filters})        // 查询待确认
proposalAdopt(id)                         // 采纳单条
proposalCommit(ids)                       // 批量提交
proposalReject(id)                        // 拒绝单条
proposalReverse(id)                       // 回滚已采纳
proposalTick(worldName, round)            // 推进老化
```

## 三、与 Director/Guardian 的联动

```
Director 决策 → 生成 LLM 输出 → 解析标记段
  → level=light → overlay-store 自动写入
  → level=major → proposal-system 暂停 + 推送 UI
  → Guardian 校验不通过 → 标记段降级或拒绝
```

> v1.0.0 实现：content-registry + proposal-system 核心管道就位。  
> vNext：提案与 UI 的通知系统整合、CRITICAL 的止损窗口可视化。
