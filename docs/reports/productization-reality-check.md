# Productization Reality Check

Date: 2026-06-29

## Scope

This report records the fresh R0 reality check for Productization Closure. It reflects the current repository state at the start of the closure branch and is not a final closure claim.

## Repository

| Item | Current value |
|---|---|
| Repository | `HatayaMisuzu/world-tree` |
| Local root | `D:/工作台/world-tree-desktop` |
| Branch | `codex/productization-closure` |
| Baseline commit | `3672076` |
| Package version | `0.4.2-v2-engineering-foundation-truth.0` |

## Alchemy / Creation Forge Routes

The current `server.js` exposes the protected G1 routes:

| Method | Path | Status |
|---|---|---|
| GET | `/api/alchemy/capabilities` | PRESENT |
| POST | `/api/alchemy/plan` | PRESENT |
| POST | `/api/alchemy/generate-preview` | PRESENT |
| POST | `/api/alchemy/localize` | PRESENT |
| POST | `/api/alchemy/deliver` | PRESENT |
| GET | `/api/alchemy/deliveries` | PRESENT |

Legacy alchemy routes also remain present: `/api/alchemy/import`, `/api/alchemy/preview`, `/api/alchemy/refine`, `/api/alchemy/commit`, `/api/alchemy/digest`, and `/api/alchemy/review`.

## G1 UI

The current `world-tree-console.js` contains the G1 Creation Forge panel and the four user-visible steps:

1. `生成创作地图`
2. `生成内容预览`
3. `生成本地文件夹草案`
4. `确认交付`

The UI calls `/api/alchemy/plan`, `/api/alchemy/generate-preview`, `/api/alchemy/localize`, `/api/alchemy/deliver`, and `/api/alchemy/deliveries`.

## Services And Tests

Current alchemy server service files:

- `src/server/alchemy-capabilities.js`
- `src/server/alchemy-planner-service.js`
- `src/server/alchemy-generation-service.js`
- `src/server/alchemy-localizer-service.js`
- `src/server/alchemy-delivery-service.js`
- `src/server/alchemy-preview-service.js`
- `src/server/alchemy-prompt-templates.js`

Current alchemy closure test script:

```bash
npm run test:alchemy-closure
```

The script is present and covers alchemy unit tests plus `tests/integration/alchemy-engineering-closure.test.js`.

## Examples Manifest

`defaults/examples/manifest.json` currently contains an empty examples list:

```json
{
  "version": 1,
  "examples": []
}
```

This is a Productization Closure blocker because first-run experience is still blank.

## CI

`.github/workflows/ci.yml` currently runs:

- `npm ci`
- `npm run check`
- `npm test`
- `npm run test:unit`
- `npm run test:integration`
- `npm run audit`
- `npm run interface-audit`

It does not yet include the specific product closure gates required by the goal, including `test:alchemy-closure`, `test:worldbook-v2`, `test:strategy-sim-v2`, `test:project-complete-audit`, or `truth:check`.

## Current Truth Alignment

`docs/CURRENT_PROJECT_STATE.md` already states that:

- Product-wide playable closure is not complete.
- Product-wide V2 is not complete.
- Creation Forge is active but not a normal play entry.
- Worldbook V2 and Strategy Sim V2 remain product-incomplete.

This matches the beginning-of-goal status: G1 engineering exists, but Productization Closure is still in progress.

## Known Blockers

- First-run examples are empty.
- CI lacks explicit product closure gates.
- Product-wide manual smoke and browser evidence are not recorded yet.
- Product entry closure matrix does not exist yet.
- Final closure report does not exist yet.

## R0 Gate Results

Passed commands:

```bash
node --check server.js # PASS
node --check world-tree-console.js # PASS
npm run test:alchemy-closure # PASS, 25/25 tests
```

`npm run test:alchemy-closure` includes delivery confirmation/target guards, G1 UI route wiring, LLM generation fallback behavior, secret/path/script scrubbing, and the old folder suffix regression: `world_module delivery does not pre-create folder and rename to suffix`.
