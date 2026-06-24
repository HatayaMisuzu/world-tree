# Pre-V2 Closure Gates

> 本文件定义 Pre-V2 Closure 期间每一步必须通过的硬门槛。  
> 它不是路线图，而是防止清理/重构时丢资产、破坏边界、制造幻觉的执行规则。

## 1. Reality Check Gate

在写任何结论前，必须：

- 读取真实文件（不要根据记忆或执行文件猜测）
- 搜索真实引用（grep/find/search_files）
- 记录假设与真实不一致处
- 不得根据旧标题、旧总结推断当前结构

## 2. Asset Preservation Gate

Before any cleanup, deletion, archive, migration, or refactor, inspect:

- `docs/WORLD_TREE_ASSET_FUNCTION_MECHANISM_INVENTORY.md`
- `docs/ASSET_STATUS_MATRIX.md`
- `docs/LEGACY_REDUNDANCY_AUDIT.md`
- `docs/LEGACY_COMPATIBILITY_AND_UPGRADE_PLAN.md`
- `scripts/validate-asset-inventory.mjs`

Rules:

- Do not delete assets listed as ACTIVE / ACTIVE-PARTIAL / KERNEL-COMPLETE / LEGACY-CANDIDATE / PRESERVE / WATCH without a dedicated plan.
- Archive historical documents instead of deleting them.
- Deletion requires: reference proof, asset inventory check, replacement path, tests, and rollback plan.
- If safety cannot be proven, defer and document.
- `npm run asset:check` must remain 0 errors, 0 warnings.

## 3. Boundary Gate

Do not casually modify these layers without a dedicated execution file:

- `server.js` — monolithic HTTP server, 3209 lines, all API routes
- Persistence / save format — `.worldtree` export/import, engineState snapshots
- Proposal / canon gate — `workflow-authority-gate.js` + `proposal-bus.js`
- LLM adapter — real/offline/test three-mode switching
- Path-security — `path-security.js` + `persistence-service.js`
- V2-ready visibility / lifecycle — `visibility-policy.js` + `lifecycle-state.js`
- Creation-forge mode contract — producer mode, not consumer entry

## 4. Documentation Truth Gate

Truth docs must describe current implementation only:

- `docs/CURRENT_PROJECT_STATE.md` — current state, not roadmap
- `docs/INDEX.md` — index current docs, not planned ones
- `docs/PROJECT_OVERVIEW.md` — current architecture
- Future plans belong in `docs/ROADMAP_CANDIDATES.md` or separate execution files

## 5. Test Gate

Every stage must:

- List target test commands before execution
- Record actual test results (PASS/FAIL/NOT RUN) with details
- Code changes require: targeted tests + workflow tests + broader tests
- `npm run docs:check` and `npm run check` must pass after any doc changes

## 6. Warning Debt Gate

- asset:check → must be 0 errors, 0 warnings (maintained since Stage 5E)
- interface-audit → 8 warnings are COMPATIBILITY-SEED (see Stage 5F report)
- Do not mark warnings RESOLVED without evidence
- Do not modify audit scripts to silence warnings

---

*Created: Stage 5F. Last updated: 2026-06-24.*
