# Pre-human Stable Baseline

Version: `0.5.0-prehuman.2`

## v0.5.0-prehuman.2 status model

- `ENGINEERING_CLOSED = YES`
- `PREHUMAN_STABLE_BASELINE = ACHIEVED` within the bounded `v0.5.0-prehuman.2` scope.
- `HUMAN_VALIDATION_PENDING = YES`
- `PLAYABLE_FINAL = NO`
- `FULL_PRODUCT_RELEASE_READY = NO`
- `V1.0_READY = NO`
- Representative real-provider evidence is exact-SHA and dynamic; workflow green or `BLOCKED_BY_CREDENTIALS` is not a provider PASS.
- Exhaustive provider coverage and future product expansion are `OUT_OF_SCOPE_FOR_PREHUMAN_BASELINE`.

> Within the bounded `v0.5.0-prehuman.2` baseline scope, automated and representative real-provider gates are closed. Human validation remains pending.

This status is bounded to the current v0.5 product, its eight registered entries, minimum product loops, automated browser/reliability/release checks, and the representative exact-SHA real-provider matrix. It does not claim human playability, full 4X depth, exhaustive provider coverage, full product-wide V2, or v1.0 readiness.

Current evidence is not stored as a mutable claim in this document. A valid release candidate requires a clean final commit, remote CI and CodeQL for that exact commit, a schema-v2 real-provider artifact whose `testedSha` equals the commit, and `npm run verify:prehuman` PASS against that artifact. Historical runs never transfer PASS to a newer SHA.
