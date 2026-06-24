# Release Seal Audit Invalidation Note

> **World Tree — v0.4.0-pre-v2-closure tag audit status**

## Current State

| Item | Status |
|------|--------|
| Tag `v0.4.0-pre-v2-closure` | EXISTS at commit `0ee1852` |
| Tag moved or deleted? | **NO** — tag is untouched |
| Tag trusted as final seal? | **NO** — audit-invalidated |
| Audit evidence | See `audit/pre-v2-full-project-audit/` |

## Why the Old Seal Is Not Trusted

The pre-v2 project audit (ChatGPT GitHub review + Codex local full audit) found:

1. **P0 userData pollution**: integration suite wrote into real `userData/` (`config.json`, `connections.json`).
2. **P1 request-body contract broken**: oversized body caused `fetch failed` instead of structured 413 JSON.
3. **P1 version truth conflict**: package/runtime reported `0.3.1` while README/docs/tag claimed `v0.4.0`.
4. **P1 creation-forge boundary contradiction**: marked `planned/deferred` in mode policy but server API allowed persistent creation.
5. **P2 documentation drift**: broken links, stale counts, incorrect port race diagnosis, route inventory mismatch.

These findings mean the audited head does not satisfy its stated closure contract. The tag exists as a historical marker, not as a trusted release seal.

## What Changed

The `hermes/pre-v2-closure-blocker-repair` branch addresses all P0/P1/P2 blockers. After repair:

- All tests pass without polluting real `userData/`.
- Request body errors return structured JSON.
- Version truth is unified across all metadata.
- Creation-forge is properly gated at the server API level.

## What Has NOT Changed

- The old tag was **not** moved, deleted, or force-pushed.
- Full V2 was **not** implemented.
- `userData/` was **not** committed or uploaded.

## Resolution

The repair branch `hermes/pre-v2-closure-blocker-repair` was merged to `main` and a new trusted tag was created:

| Item | Value |
|------|-------|
| **Superseded by** | `v0.4.0-pre-v2-closure.1` at `5cb48da` (trusted repaired baseline) |
| **Preflight** | PASS (all 19 sub-commands) |
| **Old tag** | `v0.4.0-pre-v2-closure` remains audit-invalidated historical marker at `0ee1852` |

The old tag should be documented as superseded, not deleted.

---

*Created: 2026-06-24. Updated: 2026-06-24 (superseded status).*
