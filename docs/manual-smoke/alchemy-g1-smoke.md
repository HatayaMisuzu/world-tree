# Alchemy G1 Manual Smoke

Status: NOT RUN in browser yet.

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
| Browser loaded | TODO | TODO |
| Flow A plan | TODO | TODO |
| Flow A preview | TODO | TODO |
| Flow A localize | TODO | TODO |
| Flow A delivery | TODO | TODO |
| Flow A first turn | TODO | TODO |
| Flow B plan | TODO | TODO |
| Flow B preview/localize | TODO | TODO |
| Flow B delivery/readback | TODO | TODO |
