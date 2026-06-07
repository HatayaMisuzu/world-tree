# World Tree Desktop Delivery

This delivery contains the first implementation of the Electron-based World Tree Desktop control panel.

## Important paths

- Development project: `C:\Users\Lenovo\Documents\Codex\2026-06-04\skill\work\world-tree-desktop`
- Output copy: `C:\Users\Lenovo\Documents\Codex\2026-06-04\skill\outputs\world-tree-desktop`
- Source skill used read-only: `C:\Users\Lenovo\AppData\Local\hermes\skills\creative\world-tree`
- Portable pack used read-only: `D:\world-tree-skill`
- Data root used read-only for validation: `D:\world-tree-data`

## Safety

The app does not modify the installed skill and does not write world-tree JSON. It only reads data and exports reports or text artifacts through the save dialog.

## Implemented modules

- `src/main.cjs`: Electron shell, folder picker, recursive read-only data loading, config, separate secrets storage, card import, worldbook state, exports. It now starts with no loaded data root.
- `src/preload.cjs`: small IPC bridge exposed as `window.worldTreeDesktop`.
- `src/core/data-store.js`: builds a world-tree model from directory records.
- `src/core/normalizers.js`: normalizes modules, archives, characters, scenes, and tracking.
- `src/core/commands.js`: command preview, startup packet, proposed patch.
- `src/core/diagnostics.js`: local health report.
- `src/core/cards.js`: SillyTavern / World Tree card parsing, worldbook entry normalization, keyword injection preview.
- `src/adapters/hermes.js`: optional Hermes health, sessions, chat.
- `src/adapters/llm.js`: OpenAI-compatible direct LLM game adapter.
- `src/adapters/local.js`: export text builders.
- `src/ui`: app shell, views, and styles.
- `src/ui/i18n.js`: Chinese/English UI text dictionary with persisted language selection.
- Cards tab: imports character cards, DM cards, and worldbook cards into the app-local library.
- Worldbook tab: enable/disable entries, keyword trigger preview, direct-LLM injection preview without editing world-tree JSON.
- `paths/world-tree-paths.json`: packaged path catalog for data roots, module roots, skill roots, engine roots, and app package paths.
- `personas\hermes-writer-soul.md` and `personas\dm-manual.md`: copied Hermes Writer / DM persona files for direct game mode.
