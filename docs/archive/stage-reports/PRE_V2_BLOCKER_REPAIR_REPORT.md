# Pre-V2 Blocker Repair Report

> **World Tree — Hermes Repair Execution**
> Branch: `hermes/pre-v2-closure-blocker-repair`
> Date: 2026-06-24
> Result: **READY_TO_MERGE_REPAIR** ✅

## Summary

The pre-v2 audit found P0/P1 blockers that invalidated the `v0.4.0-pre-v2-closure` seal. This repair branch resolves all blockers without implementing full V2.

## P0: UserData Test Isolation

Created `WORLD_TREE_USER_DATA_DIR` env var support. Integration tests now write to temp directories. Real `userData/` files verified unchanged before and after full test suite (SHA256 hash confirmed).

See [USER_DATA_ISOLATION_REPORT.md](USER_DATA_ISOLATION_REPORT.md) for details.

## P1: Request-Body Contract

Replaced `req.destroy()` with `req.resume()` for oversized bodies. Added `INVALID_JSON_BODY` error for non-object JSON. Default `createReadBody({ requireObject: true })`.

## P1: Creation-Forge Authority

`POST /api/modules/create` with `mode=creation-forge` now returns `MODE_PROJECT_CREATION_DISABLED`. Aligned with mode-manifest PLANNED status.

## P1: Version Truth

Unified to `0.4.0-pre-v2-closure.1` across package.json, lockfile, app-manifest, README (zh/en), CHANGELOG, AI-GUIDE, and docs. Old tag preserved. No new tag created.

## P2: Truth/Gates

Fixed broken docs links, stale QA report versions, incorrect port race diagnosis. Added ASSET_CLASSIFICATION_TODO.

## Test Results

| Suite | Result |
|-------|--------|
| Unit tests | 416 pass ✅ |
| Integration tests | 119 pass ✅ |
| Workflow tests | All pass ✅ |
| Real-play smoke | 6/6 ✅ |
| Audit, check, docs, asset, interface | All pass ✅ |
| npm pack | `world-tree@0.4.0-pre-v2-closure.1` ✅ |

## Re-Audit

See `audit/hermes-post-repair-re-audit/` for full code, architecture, and limitations reports.

**Decision: READY_TO_MERGE_REPAIR**
