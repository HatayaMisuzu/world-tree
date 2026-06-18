# World Tree

![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)
![Version](https://img.shields.io/badge/version-v0.2.0-blue.svg)

World Tree is a local-first AI narrative engine with a browser-based web console. It runs as a plain Node.js HTTP server: no Electron, no build step, and no external runtime service beyond the LLM endpoint you configure.

Current version: `v0.2.0`.

Chinese documentation: [README.md](README.md)

## Quickstart

Requirements: Node.js 18 or newer.

```bash
npm install
node server.js
# open http://localhost:3000
```

After npm publication, the intended one-command path is:

```bash
npx world-tree
```

Default LLM settings:

- Base URL: `https://api.deepseek.com/v1`
- Model: `deepseek-v4-flash`
- Any OpenAI-compatible endpoint can be used, including local Ollama at `http://localhost:11434/v1`.

## What It Does

- Runs long-form interactive fiction and roleplay locally.
- Stores worlds, chat logs, runtime state, and overlays in local JSON/JSONL files.
- Supports worldbook mode, character-card mode, and lightweight preset mode.
- Includes a content alchemy pipeline for turning pasted material into structured worlds or character cards.
- Adds a creator workbench for batch ST character import, character tags, worldbook editing/testing/import/export, connection profiles with generation parameters, chat message actions and candidate branches, narrative trace inspection, an alchemy review queue, selectable `.worldtree` import/export, and local importer/reviewer plugin manifests with JSON dry-run.
- Does not bundle story, case, or character-card material by default. `defaults/examples/manifest.json` is an empty entry point for future maintainer-provided material with recorded provenance.
- Keeps API keys in local `userData/secrets.json`; see [SECURITY.md](SECURITY.md) for the threat model.

## Project Layout

```text
world-tree-console.html   Web UI shell
world-tree-console.css    Web UI styles
world-tree-console.js     Web UI behavior
server.js                 HTTP server and REST API
src/adapters/llm.js       OpenAI-compatible LLM adapter
src/core/world-engine.js  Narrative packet builder
src/core/engine/          Engine modules
src/core/data/            Data import and card/world helpers
defaults/engine-profile/  Runtime module cards
defaults/world-profiles/  Built-in mode profiles
defaults/examples/manifest.json  Empty example-material manifest
tests/unit/               Node test-runner unit tests
scripts/                  Audit and integration test scripts
```

## Validation

```bash
npm test
npm run test:unit
npm run audit
npm run interface-audit
npm run preflight
```

`npm run preflight` is the release gate.

## Security and Diagnostics

- World Tree is intended for localhost use only. See [SECURITY.md](SECURITY.md).
- `/api/health` reports version, LLM configuration status, API-key presence, data-directory writability, and local data summary.
- Error responses include `userMsg` for the UI and `detail` for console-level troubleshooting.

## License

MIT. See [LICENSE](LICENSE).
