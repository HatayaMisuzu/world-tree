# Implementation Notes

## What is implemented

- Independent Electron project under `work/world-tree-desktop`.
- No live skill files are modified.
- File access is moved into the Electron main process.
- Renderer logic is split into `core`, `adapters`, and `ui`.
- Hermes is optional and isolated in `src/adapters/hermes.js`.
- Local browsing, diagnostics, startup packet generation, command preview, and export bundle generation work without Hermes.
- The safety model is read-only plus export.
- The app now starts with an empty module list and does not auto-scan `D:\world-tree-data`.
- Packaged path hints live in `paths\world-tree-paths.json` and `src/core/path-catalog.js`.
- Direct LLM game mode is implemented through `src/adapters/llm.js`.
- LLM API keys are stored in a separate Electron user-data `secrets.json`, not in normal config and not in the package.
- The package includes copied persona text in `personas\`, but it does not include any API key.
- Chinese/English UI switching is persisted through the Electron config file.
- Cards can be imported from SillyTavern-style JSON/PNG metadata, World Tree DM cards, Markdown/TXT, and worldbook-card JSON.
- Worldbook entries support enable/disable state, keyword trigger matching, and injection preview for direct-LLM game turns.

## Verification performed

```powershell
C:\Users\Lenovo\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe scripts\check.mjs
C:\Users\Lenovo\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe --check src\main.cjs
C:\Users\Lenovo\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe --check src\preload.cjs
```

Result:

```text
WORLD_TREE_DESKTOP_CHECK PASS
```

Data compatibility probe against `D:\world-tree-data`:

```json
{
  "loaded": true,
  "fileCount": 26,
  "modules": ["万界"],
  "selected": "万界",
  "warnings": 0,
  "engine": true
}
```

## Not performed

- `npm install` was not run because normal `node.exe` is blocked and `npm` is not available in PATH in this sandboxed shell.
- Electron GUI launch and packaged `.exe` build were not performed because Electron is not installed locally.

## Next commands when dependency installation is available

```powershell
cd C:\Users\Lenovo\Documents\Codex\2026-06-04\skill\work\world-tree-desktop
npm install
npm start
```

To build a portable Windows artifact:

```powershell
npm run dist
```
