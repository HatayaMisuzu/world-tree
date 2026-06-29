# API Alchemy Contract

Status: G1 engineering loop implemented; product-wide closure in progress.

## Protected G1 Routes

| Method | Path | Writes disk? | Requires selected targets? | Requires user confirmation? | Test evidence |
|---|---|---:|---:|---:|---|
| GET | `/api/alchemy/capabilities` | no | no | no | `alchemy-capabilities.test.js`, `alchemy-server-route-contract.test.js` |
| POST | `/api/alchemy/plan` | no | no | no | `alchemy-planner-service.test.js`, `alchemy-engineering-closure.test.js` |
| POST | `/api/alchemy/generate-preview` | no | yes | no | `alchemy-generation-service.test.js`, `alchemy-server-route-contract.test.js` |
| POST | `/api/alchemy/localize` | no | yes | no | `alchemy-localizer-service.test.js`, `alchemy-engineering-closure.test.js` |
| POST | `/api/alchemy/deliver` | yes | yes | yes | `alchemy-delivery-service.test.js`, `alchemy-engineering-closure.test.js` |
| GET | `/api/alchemy/deliveries` | no | no | no | `alchemy-server-route-contract.test.js`, delivery log coverage |

## `/api/alchemy/capabilities`

Request: none.

Response:

```json
{
  "status": "ok",
  "entrypoints": [],
  "targets": [],
  "policies": {}
}
```

Writes disk: no.

## `/api/alchemy/plan`

Request:

```json
{
  "text": "user idea or setting",
  "userPreference": {},
  "previousPlan": null
}
```

Response includes:

- `status`
- `planId`
- `intakeType`: `quick_create`, `localize_existing`, or `mixed`
- `summary`
- `recommendedTargets`
- `entrypointMap`
- `questions`

Writes disk: no.

Safety: LLM may recommend route and mechanisms, but user target choice remains required before generation/delivery.

## `/api/alchemy/generate-preview`

Request:

```json
{
  "text": "user idea or setting",
  "plan": {},
  "selectedTargets": ["world_module"],
  "userSupplement": ""
}
```

Response includes:

- `status`
- `mode`
- `title`
- `playableWorld`
- `worldbookEntries`
- `characters`
- `mechanismDrafts`
- `deliveryPlan`
- `warnings`

Writes disk: no.

Required error:

```text
ALCHEMY_GENERATE_TARGET_REQUIRED
```

Safety: generated preview must scrub hidden truth markers, API keys, local paths, and script payloads before player-visible use.

## `/api/alchemy/localize`

Request:

```json
{
  "preview": {},
  "selectedTargets": ["world_module", "worldbook"]
}
```

Response includes installable draft data such as:

- `status`
- `folderName`
- `files`
- `sourcePolicy`

Writes disk: no.

Safety: localize creates a draft only; it must not write the final world folder.

## `/api/alchemy/deliver`

Request:

```json
{
  "preview": {},
  "localFolderDraft": {},
  "selectedTargets": ["world_module", "worldbook"],
  "userConfirmed": true
}
```

Response includes:

- `status`
- `moduleKey`
- `targetPaths`
- `snapshotPath`
- delivery log state

Writes disk: yes.

Write targets:

- local world folder under the configured worlds directory
- selected shared/runtime files
- `runtime/snapshots`
- `runtime/alchemy-deliveries.jsonl`

Required errors:

```text
ALCHEMY_DELIVERY_CONFIRMATION_REQUIRED
ALCHEMY_DELIVERY_TARGET_REQUIRED
```

Safety: no selected target means no write; no `userConfirmed` means no write.

## `/api/alchemy/deliveries`

Request: query `moduleKey` is optional.

Response includes delivery log entries for the selected module or global delivery scope.

Writes disk: no.

## Legacy Alchemy Routes

Legacy routes remain available:

- `POST /api/alchemy/import`
- `POST /api/alchemy/preview`
- `POST /api/alchemy/refine`
- `POST /api/alchemy/commit`
- `POST /api/alchemy/digest`
- `GET /api/alchemy/review`
- `POST /api/alchemy/review`

These are compatibility surfaces until G1 fully supersedes preview/review workflows with route, UI, readback, and smoke evidence.
