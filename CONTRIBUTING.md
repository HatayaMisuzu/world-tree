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
- If behavior changes, keep `CHANGELOG.md`, `package.json`, `README.md`, and `AI-GUIDE.md` version references in sync.
- Do not commit `secrets.json`, `config.json`, `userData/`, `data/engine/worlds/`, `data/engine/characters/`, `data/engine/global-memory/`, or runtime logs.

## Commit Style

Use concise task-prefixed messages when following the release plan:

```text
[T0.4] Remove machine-specific paths from public docs
```
