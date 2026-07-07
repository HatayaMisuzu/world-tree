# Status Terminology

Version: `0.4.2-v2-engineering-foundation-truth.0`  
Audience: AI agents, maintainers, reviewers.

This file defines status terms used across current-facing World Tree documentation.

## Terms

| Term | Meaning | Does not mean |
|---|---|---|
| Engineering foundation complete | Core data contracts, runtime/library skeleton, safety boundaries, tests, and integration points exist. | Product UI, service API, persistent run flow, first-run UX, or bundled content is complete. |
| Engineering/service closure complete | A feature slice has service/core/runtime namespace, import/start/export or equivalent service paths, persistence where applicable, safety boundaries, and tests. | The mode is a complete commercial gameplay system. |
| Product closure not complete | A complete user-facing first-run flow, UI editing/review path, bundled content path, browser QA, and product persistence/API loop are not all proven. | The engineering work is useless or absent. |
| First playable candidate | The codebase contains a first-run demo path and a reproducible `smoke:first-play` gate. Missing real LLM credentials, human playtest, or screen recording must remain explicitly labeled. | PLAYABLE, release-ready, or validated by real users. |
| PLAYABLE | A specific entry has all three evidence records: Tier-1 real LLM smoke PASS, at least one human playtest record, and at least one screen recording of 60 seconds or longer. This status must be `HUMAN_SIGNED` by a human maintainer. | Agent-only validation, mock-provider smoke, local fallback, or engineering closure. |
| HUMAN_SIGNED | A human maintainer explicitly signs the PLAYABLE evidence bundle after reviewing real LLM smoke, human playtest notes, and screen recording evidence. | Agent self-attestation, automated test success, or mock playback. |
| DEFERRED_AFTER_FIRST_PLAY_CANDIDATE | A follow-up content pack or product slice is intentionally left for work after the first-play candidate, with no PLAYABLE claim. | Complete, abandoned, or safe to advertise as built-in playable content. |
| Full V2 not complete | Project-wide V2 across every feature and product workflow is not complete. | Selected V2 slices cannot be complete. |
| Thin slice | A usable narrow workflow exists. | Complete gameplay/product system. |
| Producer tool | A feature creates/normalizes/reviews candidate content for other entries. | Normal play entry. |

## Required phrasing

Use:

```text
Strategy Sim V2 engineering foundation is complete; Strategy Sim V2 product closure is not complete.
Worldbook V2 engineering foundation is complete; Worldbook V2 product closure is not complete.
```

Do not use unqualified phrases such as:

```text
\"SV2 done\" — unqualified, no engineering/product split
\"WV2 done\" — unqualified, no engineering/product split
\"Full V2 done\" — unqualified
\"SV2 unfinished\" — unqualified, no engineering/product split
\"WV2 unfinished\" — unqualified, no engineering/product split
```

If a short phrase is required, use:

```text
Strategy Sim V2: engineering foundation complete / product closure incomplete.
Worldbook V2: engineering foundation complete / product closure incomplete.
```

## Evidence Labels

Use these labels when required evidence is missing:

```text
BLOCKED_BY_CREDENTIALS — real LLM key/config or external service is unavailable.
HUMAN_VALIDATION_REQUIRED — human playtest or screen recording has not been supplied.
HUMAN_SIGNED — human maintainer has reviewed and signed the full PLAYABLE evidence bundle.
```

Mock providers, local fake servers, and local fallback may validate scripts and contracts, but they do not satisfy the real LLM requirement for PLAYABLE.

Use `BLOCKED_BY_CREDENTIALS` for missing real LLM keys/config, and `HUMAN_VALIDATION_REQUIRED` for missing human playtest or screen recording evidence. Use `DEFERRED_AFTER_FIRST_PLAY_CANDIDATE` for follow-up demo content such as role-card and scriptkill packs that are not yet fully implemented.
