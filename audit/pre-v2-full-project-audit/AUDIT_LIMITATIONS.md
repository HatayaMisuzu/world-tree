# AUDIT_LIMITATIONS

## Summary

This file records what Codex could and could not inspect during the full local project audit of `D:\工作台\world-tree-desktop` at head `0ee1852feb9496755ecc27f722dbe672732c2d65`.

The audit did not modify source, tests, documentation, tracked assets, commits, tags or remotes. It wrote only under `audit/pre-v2-full-project-audit/`, except that running the repository's required integration/preflight commands caused the repository's own code to overwrite ignored `userData/config.json` and `userData/connections.json`. That unintended mutation is preserved as P0 evidence; Codex did not guess a rollback or alter those files further.

## Local Files Included

- tracked: 650 files (629 text, 21 PNG)
- untracked before audit: 0 files
- ignored before audit: 4 files
- local-only folders: `userData/`, empty `userData/plugins/`, empty `data/` runtime skeletons
- baseline local files excluding `.git/` and generated audit output: 654
- text lines streamed: 65,027
- generated audit tree: excluded from baseline counts, left untracked as required

## Coverage Method

| Area | Coverage |
|---|---|
| Text files | Every text file consumed line-by-line; path/class/size/line count/SHA-256 recorded |
| JS/MJS | 441 files individually checked with `node --check`; critical runtime paths semantically traced |
| JSON | 62 files parsed with Node; ignored user data reviewed in redacted form |
| Markdown | 114 files scanned; 69 local links checked; current-state/architecture/security docs manually reconciled |
| PNG | 21 files checked for dimensions, pixel format, size, hash and textual references; pixels were not semantically judged one-by-one |
| Git | Root, branch, head, status, ignored status, log, tracked/untracked/ignored lists and tag refs inspected |
| Runtime | No-Gateway loopback root/health/full-health/status/config probes on an ephemeral port |
| Tests | All execution-spec commands plus preflight and an isolated security-test reproduction |

Automated line consumption is not represented as equivalent to deep human semantic interpretation of every prose sentence. Manual semantic review concentrated on executable code, security boundaries, current-state docs, mode contracts, test isolation, persistence, route behavior and release truth.

## Skipped / Metadata-Only Areas

| Path | Reason | Risk |
|---|---|---|
| `.git/**` raw objects | VCS database; audited through Git commands instead | Low for source audit; historical secret scanning of every Git object was not performed |
| `design/**/*.png` pixel semantics | Binary assets; metadata/reference audit only | Medium: visual quality/content/provenance was not visually certified |
| Real external LLM providers | Avoided credential/network side effects; fake/offline paths used | Medium: provider compatibility and upstream error variations unverified |
| Browser gateway / rendered UI | Execution spec prohibited browser gateway; No-Gateway QA used | Medium: responsive/accessibility/visual interaction regressions unverified |
| Node 18 and Node 20 | Only local Node v22.22.3 available in this run | Medium: declared minimum runtime not proven here |
| `.git` historical blobs for old secrets | Not part of the local working-tree file audit | Medium for public-release security; use a dedicated history secret scanner if authorized |

No `node_modules/`, `dist/`, `build/`, `coverage/`, `.cache/`, `tmp/`, `temp/` or `logs/` directory existed.

## Commands That Failed

| Command | Failure | Impact |
|---|---|---|
| `npm run test:integration` | 115/116; body-limit security case receives `fetch failed` | Required gate failed; closure cannot be claimed |
| `node --test tests/integration/security.test.js` | Same isolated failure | Proves the issue is reproducible, not the documented port race |
| `npm run preflight` | Stops on the same integration failure | Full release gate failed |
| Markdown local-link check | 2 unresolved `docs/INDEX.md` links | Documentation is not self-consistent |

All other required commands exited 0. Raw output and exit codes are in `COMMAND_OUTPUTS/`.

## Side Effects Observed

| Path | Baseline vs post-command hash | Action taken by Codex |
|---|---|---|
| `userData/config.json` | Changed | Recorded only; not restored |
| `userData/connections.json` | Changed | Recorded only; not restored |
| `userData/secrets.json` | Unchanged in this run, but test code has a real write path | Recorded/redacted only |
| `userData/corrupt-files.jsonl` | Unchanged | Recorded/redacted only |

The audit did not capture full pre-command contents of config/connections because copying live values into audit output would have increased sensitive-data exposure. Consequently, a byte-perfect rollback cannot be safely inferred from this audit alone.

## Confidence

- Code-level audit confidence: **High** for working-tree syntax, structural/security boundaries and reported findings; **medium** for dormant business semantics across all legacy modules.
- Architecture/function audit confidence: **High** for current source/docs/test contradictions and No-Gateway behavior; **medium** for rendered UI and real-provider behavior.
- Local-only coverage confidence: **High** for files/directories present at audit start; sensitive values were intentionally redacted.
- Final decision confidence: **High**. Any one of the P0, failing preflight, version split or creation-forge authority conflict is enough to reject a clean seal claim.

## Notes for ChatGPT Review

1. Treat `INVENTORY/*` as the baseline before generated audit output.
2. Review CODE-P0-001 first; decide how to recover the intended config/connection values before asking any agent to run more integration tests.
3. Do not accept “known flaky port race” as the current explanation; the isolated security test reproduces the request-body socket failure.
4. The Git tag already exists. The requested decision is therefore whether the tagged state is trustworthy and how to supersede/correct it, not whether a tag object is absent.
5. Do not upload `userData/*`, `REPORT_INPUTS/runtime-probe-data/`, ACL output containing local path text, or any redacted-summary source that is not explicitly reviewed for sharing.
