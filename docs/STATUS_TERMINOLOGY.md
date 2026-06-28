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
