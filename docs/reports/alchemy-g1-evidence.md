# Alchemy G1 Evidence

Date: 2026-06-29

## Status

Alchemy G1 engineering evidence is PASS. Browser manual smoke is still NOT RUN.

This report is not a Productization Closure claim. It records P1 evidence for the Creation Forge / Alchemy G1 slice.

## Automated Evidence

| Command | Result | Evidence |
|---|---|---|
| `node --check server.js` | PASS | R0 syntax gate |
| `node --check world-tree-console.js` | PASS | R0 syntax gate |
| `npm run test:alchemy-closure` | PASS | 26/26 tests |

## Covered Behaviors

| Area | Evidence |
|---|---|
| Protected G1 routes exist | `tests/unit/alchemy-server-route-contract.test.js` checks capabilities, plan, generate-preview, localize, deliver, and deliveries routes. |
| LLM preview wiring | `tests/unit/alchemy-generation-service.test.js` verifies quick-create LLM JSON generation and fallback behavior. |
| User decides final targets | `tests/unit/alchemy-generation-service.test.js` rejects preview generation without selected targets. |
| Delivery requires confirmation | `tests/unit/alchemy-delivery-service.test.js` rejects delivery without `userConfirmed`. |
| Delivery requires selected targets | `tests/unit/alchemy-delivery-service.test.js` rejects delivery without targets. |
| Old `name-2` regression | `tests/unit/alchemy-delivery-service.test.js` asserts `cyber-xianxia` is created without a `-2` suffix and that the snapshot is under `cyber-xianxia/runtime/snapshots`. |
| Simple idea flow | `tests/integration/alchemy-engineering-closure.test.js` plans, localizes, and delivers a playable module from a short idea. |
| Existing setting flow | `tests/integration/alchemy-engineering-closure.test.js` classifies longer input as localization and preserves source policy. |
| Safety scrubbing | `tests/unit/alchemy-generation-service.test.js` and `tests/unit/alchemy-localizer-service.test.js` cover hidden markers, secrets, paths, and script tags. |
| G1 console UI | `tests/unit/alchemy-console-g1-ui.test.js` verifies G1 API methods, UI controls, and action wiring. |

## Manual Smoke

Manual smoke checklist:

```text
docs/manual-smoke/alchemy-g1-smoke.md
```

Current manual smoke status: NOT RUN.

## Limitations

- This evidence proves the G1 engineering slice and automated contract coverage, not the full product-wide closure.
- Browser smoke still needs to prove loading a created world and playing at least one turn.
- First-run examples remain incomplete until `defaults/examples/manifest.json` is populated and tested.
