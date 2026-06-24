# No-Gateway Runtime QA Report — Stage 7

> Browser gateway QA was intentionally not used because it is unstable in the current environment.  
> All checks below are no-gateway: HTTP probes, smoke tests, integration tests, file inspection.

## Environment

| Item | Value |
|---|---|
| OS | Windows 10 |
| Node | v22.22.3 |
| Port | 3000 |
| Version | 0.3.1 (package.json) |

## HTTP Probes

| Target | Method | Status | Result |
|---|---|---|---|
| `GET /` | GET | 200 | Static console served |
| `GET /api/health` | GET | 200 | `{"status":"ok","version":"0.3.0",...}` |
| `GET /api/health?detail=full` | GET | 200 | Full health with LLM status, data root, worlds count |
| `GET /api/status` | GET | 200 | `{"version":"0.3.0","uptime":...,"profiles":1}` |
| `GET /api/config` | GET | 200 | Returns current config |
| `POST /api/config` | POST | 200 | Accepts config update |
| `GET /api/status` (evil Origin) | GET | 403 | Non-local origin rejected |

## Static Resources

| File | Status |
|---|---|
| `world-tree-console.js` | Exists |
| `world-tree-console.html` | Exists |
| `world-tree-console.css` | Exists |
| `index.html` | Exists |

## Automated Tests

| Command | Result |
|---|---|
| `npm run test:unit` | PASS (437 tests) |
| `npm run test:integration` | PASS (116 tests) |
| `npm run test:workflows` | PASS (66 tests) |
| `npm run real-play:smoke` | PASS (6/6) |
| `npm run asset:check` | PASS (0 errors, 0 warnings) |
| `npm run interface-audit` | PASS (149/0/0) |
| `npm run docs:check` | PASS (24/24) |
| `npm run check` | PASS |

## LLM Fallback / Error

| Check | Evidence |
|---|---|
| Error codes documented | `src/server/http-response.js`: LLM_AUTH_FAILED, LLM_QUOTA_EXHAUSTED, LLM_RATE_LIMITED, LLM_UPSTREAM_ERROR, LLM_HTTP_ERROR |
| User-facing Chinese messages | Present in all error paths |
| Local-only protection | Verified: non-local Origin → 403 |

## Blocking Issues

None. Server starts, all HTTP probes return expected statuses, all 598+ tests pass.

## Non-Blocking Issues

- LLM connection test fails with `fetch failed` (expected — no real LLM service configured)
- Some modes are V2-ready thin slices, not complete game engines (by design)

## Conclusion

✅ **Stage 7 No-Gateway Runtime QA PASSED.** Project is usable as v0.4.0 Pre-V2 Closure baseline.
