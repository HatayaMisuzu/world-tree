# World Tree V2 Entry Completion Status

> 当前 V2 入口闭环真相表。本文只描述现有功能入口深化，不代表新增顶层产品入口。
> **This document records engineering/service entry closure. It does not claim Full V2, complete mode gameplay engines, or product-wide playable closure.**
> Product-facing bundled content and first-run user paths are outside this status unless separately documented.

审计基准：`main@9b35bbfd009c1e9acd90a7854cf877ead7d89450`  
状态：`V2_ENTRY_CLOSURE_SOURCE_VERIFIED`  
远端 CI：`UNKNOWN`（没有可引用 workflow run）

## Summary

| Entry | Status | Evidence Gate |
|---|---:|---|
| Tabletop V2 | PASS | `npm run test:tabletop-v2-full` |
| Detective V2 | PASS | `npm run test:detective-v2-full` |
| Character V2 Long-term | PASS | `npm run test:character-v2-long-term` |
| Single Player ScriptKill V2 | PASS | `npm run test:single-player-scriptkill-v2` + `npm run test:single-player-scriptkill-v2-audit` |

## Boundary

- V2 是现有入口深化，不新增重复顶层导航。
- `src/core/modules/*` 是可复用模块层，不是产品入口。
- 功能入口拥有自己的 service/core/runtime namespace。
- 隐藏真相、DM 手册、fullTruth、其他角色私本不得进入玩家可见输出。

## Entry Details

### Tabletop V2

- Import preview / commit
- GM loop
- save / branch / restore / export
- hidden GM state isolation
- `data/engine/tabletop-v2/` runtime namespace

### Detective V2

- Case import / generator / validator
- evidence / testimony / contradiction / timeline / truth ledger
- player notebook / deduction report
- GM/player export separation
- `data/engine/detective-v2/` runtime namespace

### Character V2

- Text-first capsule creation
- runtime context bridge
- long-term confirmed memory / canon / relationship read-only consumption
- candidate review and export services
- normal UI hides raw audit detail

### Single Player ScriptKill V2

- Existing “单人剧本杀” entry V2 deepening
- user-owned script import with legal-use gate
- real solo player + AI stranger player proxies
- role-name-first chat display
- phase / knowledge / spoiler guard separation
- service e2e: import → start → phase → talk → search → reveal → vote → debrief → export → load
- `data/engine/single-player-scriptkill-v2/` runtime namespace

## Must-run Gates

```bash
npm run test:tabletop-v2-full
npm run test:detective-v2-full
npm run test:character-v2-long-term
npm run test:single-player-scriptkill-v2
npm run test:single-player-scriptkill-v2-audit
npm run test:world-tree-v2-entries
npm run test:project-complete-audit
```
