# Pre-V2 Closure Gates

> 本文件定义 Pre-V2 Closure 期间每一步必须通过的硬门槛。  
> 它不是路线图，而是防止清理/重构时丢资产、破坏边界、制造幻觉的执行规则。

## 1. Reality Check Gate

在写任何结论前，必须：

- 读取真实文件（不要根据记忆或执行文件猜测）
- 搜索真实引用（grep/find/search_files）
- 记录假设与真实不一致处
- 不得根据旧标题、旧总结推断当前结构

## 2. Asset Preservation & Integration Gate

Asset protection is not only "do not delete."

During Pre-V2 Closure, assets must not be silently disconnected, downgraded, orphaned, or detached from the architecture. A file can still exist while the asset is effectively lost if it has no entry point, no index, no tests, no migration path, or no role in the new structure.

Asset categories:
- `ACTIVE`: currently connected to product/runtime flow; must remain reachable and tested.
- `ACTIVE-PARTIAL`: partially connected; must keep entry point, index, and known limitations.
- `V2-READY-SOCKET`: not full feature yet, but has a planned/implemented socket for future V2 integration.
- `PRESERVATION-REFERENCE`: not directly active, but design semantics and reactivation path must remain indexed.
- `LEGACY-CANDIDATE`: old mechanism candidate; cannot be deleted or detached without replacement proof and owner approval.
- `ARCHIVED-HISTORICAL`: historical record; may be archived but must stay indexed as history.
- `DEPRECATION-CANDIDATE`: suspected removable; requires dedicated review and owner approval.

Rules:
- Do not delete, detach, downgrade, archive, or disconnect an asset without a dedicated plan.
- Do not remove an asset from routes, mode capsules, tests, docs index, or runtime flow unless replacement/reattachment is proven.
- Do not turn an asset into an orphan: file exists but no entry, no index, no test, no reactivation path.
- If moving an asset from ACTIVE / ACTIVE-PARTIAL / V2-READY-SOCKET to PRESERVATION / ARCHIVED / DEPRECATION, owner approval is required.
- If safety cannot be proven, defer and document.
- `npm run asset:check` must remain 0 errors, 0 warnings.

See `docs/MAINTENANCE_ENTRY.md` for the full maintenance protocol.

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
