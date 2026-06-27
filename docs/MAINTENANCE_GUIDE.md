# Maintenance Guide — World Tree Pre-V2 Closure Baseline

> This guide is for AI agents and human maintainers. It explains how to safely modify the current Pre-V2 baseline.

## First Read

Before making changes, read these files in order:

```text
AI-GUIDE.md
docs/MAINTENANCE_ENTRY.md
docs/CURRENT_PROJECT_STATE.md
docs/archive/stage-reports/PRE_V2_CLOSURE_GATES.md
docs/ARCHITECTURE_MAP.md
docs/API_ROUTE_INVENTORY.md
docs/SCRIPTS_AND_CHECKS.md
```

## Default Workflow

For small safe changes:

```bash
git checkout main
git pull --ff-only origin main
# edit
npm run check
npm run docs:check
git diff --check
git commit -m "<type(scope): summary>"
git push origin main
```

For code changes touching server/runtime boundaries, also run:

```bash
npm run test:unit
npm run test:integration
npm run real-play:smoke
npm run asset:check
npm run interface-audit
```

For broad changes, run:

```bash
npm run preflight
```

## Asset Preservation & Integration

Never treat assets as "safe to ignore" just because files still exist.

A change is unsafe if it causes any of the following without explicit approval:

```text
asset deleted
asset detached from current architecture
asset no longer indexed
asset no longer reachable
asset downgraded from active/useful to historical-only
asset left as orphaned file with no entry/test/reactivation path
```

Before asset-impacting changes, answer:

```text
Which assets are affected?
Where are they inventoried?
Are they still reachable?
Are they still indexed?
Are they tested or explicitly marked untested?
Is there a reactivation path?
Does this require owner approval?
```

## Safe Change Categories

| Change | Default Handling |
|---|---|
| Docs truth fix | Direct main commit + push |
| Test count update | Direct main commit + push |
| Small helper extraction | Direct main commit + push after tests |
| Route behavior change | Requires focused plan and integration tests |
| Persistence format change | Requires explicit user approval |
| Proposal/canon change | Requires explicit user approval |
| LLM adapter behavior change | Requires focused diagnostics and fallback tests |
| Asset delete/downgrade/detach | Requires explicit owner approval |

## Current Server Boundary Rules

`server.js` is still the route dispatch and orchestration entry.

Already extracted:

```text
src/server/http-response.js
src/server/http-request.js
src/server/local-access.js
```

Do not re-inline these helpers into `server.js`.

Do not split routes just to make the file look smaller. Only split route code when there is a clear route inventory, tests, and no behavior change.

## Documentation Truth Rules

Current-state documents may only describe implemented behavior.

Future plans belong in:

```text
docs/ROADMAP_CANDIDATES.md
docs/*BACKLOG*
docs/*IDEAS*
docs/*EXECUTION_PLAN*
```

Current facts belong in:

```text
README.md
docs/CURRENT_PROJECT_STATE.md
docs/PROJECT_OVERVIEW.md
docs/FEATURES.md
docs/API_REFERENCE.md
docs/API_ROUTE_INVENTORY.md
```

## Required Final Report Format

When finishing a task, report:

```text
Branch:
Head:
Pushed:
Files changed:
Behavior changed? yes/no
Assets deleted/detached/downgraded? yes/no
Tests run:
Known failures:
Next safe step:
```
