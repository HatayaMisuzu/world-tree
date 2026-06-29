# User Content Browser Smoke

Date: 2026-06-29

Status: PASS

Mode: browser entry plus API-assisted delivery/readback.

## Browser Steps Run

- PASS: homepage loaded
- PASS: blank template area visible
- PASS: Alchemy G1 panel visible
- PASS: Flow A browser plan/preview/localize/deliver clicked
- PASS: Flow B browser plan/preview/localize clicked

## API-Assisted Steps

- PASS: Flow A module id/path/readback captured through API
- PASS: Flow A first-turn persistence verified through API
- PASS: Flow B deliver/readback captured through API

## Console Status

Console error/warning count: 0

## Created Module IDs

- Flow A browser/API evidence module: `world:快速创世计划-2` at `C:\Users\Lenovo\AppData\Local\Temp\world-tree-browser-user-content-CRCWzm\engine\worlds\快速创世计划-2`
- Flow B browser/API evidence module: `world:本地化导入计划` at `C:\Users\Lenovo\AppData\Local\Temp\world-tree-browser-user-content-CRCWzm\engine\worlds\本地化导入计划`

## Readback Result

- Flow A module listed: true; module load: `ok`; turnCount: 1; localFallback: true
- Flow B module listed: true; module load: `ok`; worldbook entries: 1

## Limitations

- Flow A browser clicked the G1 delivery path, then API readback captured canonical module ids and first-turn persistence.
- Flow B browser completed through local-folder draft; final delivery/readback was API-assisted for stable evidence capture.
- No real LLM is claimed by this browser smoke.
