# Pre-V2 Closure Report — Repair Candidate

> Current package/runtime version: `0.4.0-pre-v2-closure.1`.
> This is not full V2 and not a trusted final seal.

## Current Status

```text
PRIOR SEAL: AUDIT-INVALIDATED
REPAIR: READY_FOR_RE_AUDIT only after the repair report records all final gates PASS
```

The tag `v0.4.0-pre-v2-closure` exists at `0ee1852feb9496755ecc27f722dbe672732c2d65`. It was not moved or deleted. A full local audit found that its integration/preflight and release-truth evidence was not trustworthy.

## Audit-Found Blockers

- Integration tests wrote fake config/connection data into repository-root `userData/`.
- Oversized request bodies destroyed the socket instead of returning JSON 413; non-object JSON was not rejected consistently.
- Package/runtime remained 0.3.1 while docs/tag claimed v0.4.0.
- creation-forge was declared deferred but persisted through `/api/modules/create`.

## Repair Candidate Boundaries

- Tests use temporary `WORLD_TREE_USER_DATA_DIR` roots.
- Request body errors preserve structured HTTP responses.
- creation-forge remains a deferred alchemy/workflow producer and cannot be a normal persisted module.
- Package/runtime/current docs use `0.4.0-pre-v2-closure.1`.
- Browser QA remains NOT RUN.
- No full V2, persistence rewrite, proposal/canon rewrite, LLM adapter rewrite, tag move or new tag is included.

## Architecture Baseline

- Local browser console -> `server.js` -> `src/server/**` / `src/core/**` -> local JSON/JSONL.
- HTTP response/request/local-access and user-data-root boundaries are extracted.
- API inventory: 84 method/path rows across 76 unique path patterns.
- Eight mode contracts exist; they are thin slices or V2-ready sockets, not eight complete games.

## Validation Truth

Historical PASS tables are not current evidence. The authoritative repair results are:

- `docs/PRE_V2_BLOCKER_REPAIR_REPORT.md`
- `docs/USER_DATA_ISOLATION_REPORT.md`
- raw local output under ignored `audit/pre-v2-blocker-repair/`

## Next Decision

After all final commands pass and repository-root userData hashes remain unchanged, this branch may be submitted for a fresh independent re-audit. Re-audit, not this document, decides whether a future trusted seal is allowed.
