# Alchemy G1 Manual Smoke

Status: USER-CREATED CONTENT PASS / FULL MANUAL PRODUCT SMOKE PARTIAL.

Automated browser entry smoke passed on 2026-06-29: the homepage loaded, `打开炼金台` opened the Alchemy G1 panel, the four G1 step buttons were visible, and the browser snapshot reported no console errors or warnings.

Automated user-created content smoke passed on 2026-06-30: Flow A created `world:快速创世计划`, persisted first-turn input, and read back chat/runtime state; Flow B created `world:本地化导入计划` and read back localized worldbook structure.

Bundled story examples, tutorials, and onboarding demo content remain DEFERRED.

Use this checklist after starting the local app with `npm start`.

## Preconditions

- App loads at `http://127.0.0.1:3000` or the port printed by the server.
- Local-only access policy remains active.
- LLM configuration may be real or unavailable; fallback behavior must remain usable.

## Flow A: Simple Idea To Playable World

1. Open Creation Forge / 炼金台.
2. Enter a short idea, for example: `我想玩一个赛博修仙世界，主角是被公司追杀的炼丹师。`
3. Click `1. 生成创作地图`.
4. Confirm the plan recommends `quick_create` or `mixed`.
5. Select final output targets, including `world_module`, `worldbook`, `character`, and `mechanism`.
6. Click `2. 生成内容预览`.
7. Confirm preview text does not expose API keys, local filesystem paths, `hiddenTruth`, `gm_only`, or script/style/html/js payloads.
8. Click `3. 生成本地文件夹草案`.
9. Confirm the draft includes `world.json`, `shared/`, and `runtime/` files.
10. Click `4. 确认交付` and accept the browser confirmation.
11. Confirm a local world folder is created.
12. Open/load the created world.
13. Send one play turn and confirm the app responds without a dead end.

## Flow B: Existing Setting To Localized Folder

1. Open Creation Forge / 炼金台.
2. Enter a longer setting with world, characters, factions, and rules.
3. Click `1. 生成创作地图`.
4. Confirm the plan recommends `localize_existing` or `mixed`.
5. Select the final output targets.
6. Click `2. 生成内容预览`.
7. Confirm source policy preserves user-specified core setting.
8. Click `3. 生成本地文件夹草案`.
9. Confirm the draft contains World Tree-compatible files.
10. Click `4. 确认交付` and accept the browser confirmation.
11. Confirm worldbook, characters, and mechanisms can be read from the created folder.

## Evidence To Record

| Check | Result | Notes |
|---|---|---|
| Browser loaded | PASS | Automated Playwright CLI smoke on isolated local server; homepage and G1 entry panel loaded with clean console. |
| Flow A plan | PASS | Plan type `quick_create`. |
| Flow A preview | PASS | Preview mode `quick_create`. |
| Flow A localize | PASS | Local folder draft produced required files. |
| Flow A delivery | PASS | Created `world:快速创世计划`. |
| Flow A first turn | PASS | `runtime/chat.jsonl` and `runtime/state.json` readback passed; local fallback was used because no LLM key was configured. |
| Flow B plan | PASS | Plan type `localize_existing`. |
| Flow B preview/localize | PASS | Preview mode `localize_existing`; local folder draft produced required files. |
| Flow B delivery/readback | PASS | Created `world:本地化导入计划`; worldbook readback contained entries. |
