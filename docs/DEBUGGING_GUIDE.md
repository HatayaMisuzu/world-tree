# Debugging Guide — World Tree Pre-V2 Closure Baseline

> Goal: make failures diagnosable without guessing or rewriting unrelated systems.

## First Rule

Do not debug by broad rewriting.

Start from:

```text
What failed?
Which area failed?
Which route / mode / operation?
Can the failure be reproduced?
Which test covers it?
Which log or file changed?
```

## Common Diagnostic Commands

```bash
npm run check
npm run docs:check
npm run asset:check
npm run interface-audit
npm run test:unit
npm run test:integration
npm run test:workflows
npm run real-play:smoke
git diff --check
```

For full closure:

```bash
npm run preflight
```

## Error Contract

Current HTTP error helpers live in:

```text
src/server/http-response.js
```

Current request body parsing lives in:

```text
src/server/http-request.js
```

Current local access / rate limit helpers live in:

```text
src/server/local-access.js
```

Current error payload fields include:

```text
status
error
code
userMsg
errorMsg
detail
```

Future trace fields such as `traceId`, `area`, `mode`, `route`, `operation`, and `recoverable` are not yet fully standardized. Do not claim they exist globally until implemented.

## Area-Based Triage

| Area | First Files To Read | Tests / Checks |
|---|---|---|
| HTTP response error | `src/server/http-response.js`, `server.js` | `node --test tests/unit/http-response.test.js` |
| HTTP request body | `src/server/http-request.js`, `server.js` | `node --test tests/unit/http-request.test.js` |
| Local access / rate limit | `src/server/local-access.js`, `server.js` | `node --test tests/unit/local-access.test.js` |
| Module model | `src/server/module-service.js` | module-service tests, integration tests |
| Mode-specific readback | `src/server/module-service.js`, `src/core/modes/*` | `tests/unit/module-service-mode-specific-readback.test.js` |
| Workflow | `src/core/workflows/` | `npm run test:workflows`, `npm run workflow:check` |
| Asset inventory | `docs/WORLD_TREE_ASSET_FUNCTION_MECHANISM_INVENTORY.md` | `npm run asset:check` |
| Interface read/write drift | `scripts/interface-audit.mjs` | `npm run interface-audit` |
| Real play smoke | `scripts/real-play-scenarios.mjs` | `npm run real-play:smoke` |

## Known Non-Blocking Issue Pattern

Pre-v2 repair resolved the userData pollution issue that previously caused integration flakiness. If `npm run preflight` reports any failure, verify whether individual tests pass separately before changing code. Do not rewrite functionality only to chase a flaky issue unless the failure is reproducible and isolated.

## Debugging Report Template

```text
Failure:
Area:
Route/mode/operation:
Repro command:
Expected:
Actual:
Suspected cause:
Files read:
Minimal fix:
Tests run:
Remaining risk:
```
