# Detective V2 Case Capsule Schema

> 案件胶囊的数据结构规范。Step 1 定义 schema 和规范化逻辑。

## 顶层结构

```text
DetectiveCaseCapsule
├── schemaVersion: "world-tree.detective.v2.case.1"
├── mode: "detective"
├── caseId
├── title
├── sourceType: "generated" | "imported" | "adapted"
├── difficultyProfile
├── estimatedPlayTime
├── playerBrief (公开)
├── truthLedger (隐藏)
├── locations[] (含隐藏场景)
├── characters[] (含 isCulprit 标记)
├── evidence[] (含 hiddenMeaning)
├── testimonies[] (含 deceptionReason)
├── timeline
├── notebookPolicy
├── deductionReportSchema
├── generatorBlueprint
├── assetLinks
├── runtimeIsolation
└── _extra
```

## 玩家视图 vs 隐藏视图

### 玩家视图 (`extractDetectivePlayerCaseView`)
- 移除 truthLedger
- 证据移除 hiddenMeaning、unlockConditions
- 证言移除 deceptionReason
- 角色移除 hiddenNotes、isCulprit
- 地点移除 gmNotes、discoverableEvidence，过滤 isHidden

### 隐藏视图 (`extractDetectiveHiddenCaseView`)
- 仅包含 truthLedger、隐藏场景、证据 hiddenMeaning、欺骗映射、凶手角色

## 硬性规则

1. Truth Ledger 字段永不在玩家视图中出现
2. `isCulprit` 仅在隐藏视图中可见
3. `deceptionReason` 仅在隐藏视图中可见
4. 隐藏场景不在玩家视图的地点列表中
