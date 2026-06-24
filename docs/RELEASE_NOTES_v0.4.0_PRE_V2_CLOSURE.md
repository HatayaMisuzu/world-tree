# Release Notes — Prior Pre-V2 Closure Attempt (Audit-Invalidated)

## Version and Tag Facts

- Existing tag: `v0.4.0-pre-v2-closure`
- Tagged commit: `0ee1852feb9496755ecc27f722dbe672732c2d65`
- Tag moved or deleted: **no**
- Trusted final-seal status: **AUDIT-INVALIDATED**
- Repair candidate package/runtime version: `0.4.0-pre-v2-closure.1`
- New tag created by blocker repair: **no**

## Why the Seal Claim Was Invalidated

- Integration/preflight did not have a clean pass.
- Integration tests could mutate real ignored config, connection and secret stores.
- Package/runtime and release documentation used conflicting versions.
- creation-forge persistence contradicted the declared deferred-producer policy.
- Documentation and release gates contained stale counts, broken links and an incorrect flaky-test explanation.

## What the Historical Attempt Did Establish

- Stage 5 asset/debt/maintenance foundations.
- Stage 6 HTTP/local-access extraction and architecture documentation.
- Stage 7 No-Gateway workflows and user guides.
- V2-ready contracts, mode capsules, workflow authority and proposal/candidate boundaries.

These are useful foundations, but they do not make the old tag trusted release proof and do not mean full V2 is implemented.

## Repair Candidate

`0.4.0-pre-v2-closure.1` repairs the audited P0/P1 blockers on `codex/pre-v2-closure-blocker-repair`. Its exact validation results are recorded in `docs/PRE_V2_BLOCKER_REPAIR_REPORT.md` and must be independently re-audited before any future seal decision.

## Correct Language

Do not say the existing tag is a trustworthy final seal. Say:

> The prior seal tag exists but is audit-invalidated as trusted final-seal evidence. A repaired trusted seal is pending re-audit.
