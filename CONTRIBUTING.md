# Contributing

Thanks for helping improve World Tree.

## Setup

Use Node.js 18 or newer.

```bash
npm install
npm run preflight
```

See [README.md](README.md) for the quickstart and [AI-GUIDE.md](AI-GUIDE.md) for the architecture map.

## Before Submitting

- Follow the modification rules in [AI-GUIDE.md](AI-GUIDE.md#修改规则). That file is the single source of truth.
- Run `node --check <file>` for each changed JavaScript file.
- Run `npm run preflight`.
- For product/playability changes, run the relevant targeted tests plus `npm run narrative:eval` when narrative quality is affected.
- For release-readiness changes, run `npm run release:verify` and record whether real LLM smoke is PASS or `BLOCKED_BY_CREDENTIALS`.
- If behavior changes, keep `CHANGELOG.md`, `package.json`, `README.md`, and `AI-GUIDE.md` version references in sync.
- Do not commit `secrets.json`, `config.json`, `userData/`, `data/engine/worlds/`, `data/engine/characters/`, `data/engine/global-memory/`, or runtime logs.

## Issue Labels

Recommended labels for GitHub issues:

- `bug`: reproducible defect.
- `enhancement`: product or developer improvement.
- `good first issue`: small, well-scoped task with clear acceptance checks.
- `needs-repro`: report needs a minimal reproduction or logs.
- `blocked-by-credentials`: real LLM key/service is required to validate.
- `human-validation-required`: human playtest or screen recording is required.
- `docs`: documentation-only or documentation-led work.

Good First Issues should include the file path, expected behavior, targeted test command, and whether `npm run preflight` is required.

## Commit Style

Use concise task-prefixed messages when following the release plan:

```text
[T0.4] Remove machine-specific paths from public docs
```
