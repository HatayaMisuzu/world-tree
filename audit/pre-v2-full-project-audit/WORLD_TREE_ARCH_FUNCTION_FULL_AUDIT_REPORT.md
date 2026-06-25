# WORLD_TREE_ARCH_FUNCTION_FULL_AUDIT_REPORT

## 1. Executive Summary

- Audit date: 2026-06-24 (Asia/Shanghai)
- Branch: `main`
- Head: `0ee1852feb9496755ecc27f722dbe672732c2d65`
- Existing tag: `v0.4.0-pre-v2-closure` at the audited head
- Pre-V2 Closure baseline status: **Not currently proven; required preflight fails and test isolation damages local data**
- V2 misreading risk: **High** — most docs correctly say “not full V2,” but release version truth and creation-forge activation boundaries conflict
- Functional closure risk: **High** — happy-path smoke is good, but request-boundary and test-data safety are not closed
- Architecture blocker: **Yes** — user-data root isolation and creation-mode authority must be fixed before a trustworthy seal
- Recommendation: **BLOCKED**

World Tree has a substantial and largely test-backed Pre-V2 substrate: a local HTTP runtime, eight mode contracts, kernel/proposal/workflow services, import/export, user-facing error structures and No-Gateway operation. The block is not lack of implementation volume. It is that the current closure proof is unsound: tests write into real user data, preflight fails, runtime/package version disagrees with the tag, and one deferred mode bypasses its own policy.

## 2. Architecture Map Review

| Document | Matches code? | Evidence | Issues |
|---|---|---|---|
| `docs/ARCHITECTURE_MAP.md` | Partial | Browser → `server.js` → `src/server`/`src/core` → JSON/JSONL is accurate; extracted HTTP/local boundaries exist | Test counts are stale; userData paths are not governed by the stated data-root override; monolith/duplication risk is understated |
| `docs/API_ROUTE_INVENTORY.md` | Partial | Major route groups and most handlers match `server.js` | Prose says 78 routes while the table has 83; `/api/debug/logs` is missing; header references an old head; table is declared partial but closure docs treat it as final |
| `docs/MODE_BOUNDARY_MAP.md` | Partial | Eight mode IDs, mode-specific readback files and V2 sockets match registry/factory code | creation-forge is called deferred/planned but `/api/modules/create` persists it; mode seed schema has two authorities |
| `docs/MAINTENANCE_GUIDE.md` | Mostly | Commands and asset/proposal/persistence caution are useful and source-aligned | “broad changes run preflight” is insufficient while preflight mutates real user settings; direct-main workflow should not be followed until isolation is repaired |
| `docs/DEBUGGING_GUIDE.md` | Partial | Error/request/local-access file pointers and focused triage are accurate | The “115/116 known character-project port race” explanation does not match the reproducible body-limit failure; it can steer maintainers away from a real defect |

### Actual architecture at the audited head

```text
Browser console (single 2,360-line module)
  -> local-only HTTP server (single 3,102-line route/orchestration entry)
     -> extracted request/response/local-access helpers
     -> server domain services
     -> core mode/workflow/kernel/proposal/canon substrate
     -> two persistence root families:
          WORLD_TREE_DATA_DIR-aware engine data
          repository-root userData for config/secrets/connections/plugins/debug
```

The two-root persistence model is the key unrecorded architecture fact. Tests isolate only the first family.

## 3. Functional Closure Review

| Flow | Evidence | Result | Issues |
|---|---|---|---|
| install | `npm pack --dry-run --json`: 377 files, exit 0; package has no external dependencies | PASS structurally | Package identifies itself as v0.3.1 while release docs/tag say v0.4.0 |
| start | No-Gateway server started on an ephemeral loopback port | PASS | Local Node v22 only; Node 18/20 unverified |
| HTTP root probe | `GET /` -> 200 HTML | PASS | No visual/browser QA by design |
| health/status/config probes | All returned 200 | PASS with warning | Health/runtime version is 0.3.1; config is the live store affected by test pollution |
| quick-setting | Unit/integration coverage and module creation path present | PASS as ACTIVE-PARTIAL | Not a complete mode engine |
| mode selection | Seven active/visible modes plus one deferred producer are represented in manifest/UI/runtime | PARTIAL | creation-forge policy is contradictory |
| one-round play/smoke | 6/6 `real-play:smoke`; workflow 66/66 | PASS | Offline thin-slice proof, not full gameplay proof |
| proposal/candidate visibility | Kernel, workflow authority, review and proposal tests pass | PASS for substrate | Full mode-specific canon systems remain deferred |
| save/reload/continue | Character/world/module roundtrip tests mostly pass within integration run | PARTIAL | Whole integration suite fails; test roots are unsafe |
| import/export | Traversal rejection, worldpack preview/roundtrip and default sensitive-runtime exclusion tests pass | PASS | Include-runtime options remain local-user trust features |
| LLM config | Config/secrets/connections APIs and fake-server diagnostics exist | **FAIL safety** | Integration diagnostic writes fake config/connection/secret data to real `userData/` |
| LLM failure/fallback | Workflow real-LLM failure/fallback tests and offline smoke pass | PASS | No real provider was contacted during this audit |

No browser gateway was used, as required by the execution package. The runtime evidence is in `COMMAND_OUTPUTS/no-gateway-runtime-probes.txt`.

## 4. Mode Review

### quick-setting

- Current implementation: **ACTIVE-PARTIAL** quick intake/bootstrap with raw text normalization and project draft persistence.
- Entry: Console quick-setting path and `/api/modules/create`.
- Code evidence: `src/core/modes/quick-setting.js`, mode manifest/capsule/module map, module service.
- Docs evidence: `README.md`, `docs/PLAY_MODE_GUIDE.md`, `docs/MODE_BOUNDARY_MAP.md`.
- Assets/readback: preset/source text, shared baseline and runtime state; no dedicated complete gameplay asset set.
- Hidden/canon risk: low; generated material remains candidate/project input.
- Tests: quick-setting, quick-project, mode project/factory and multi-mode tests; passing.
- V2-ready point: input normalizer, mode runtime packet, capsule/module graph.
- Misreading risk: low if “thin slice” wording is retained.

### character

- Current implementation: **ACTIVE-PARTIAL**, the strongest user-facing vertical slice.
- Entry: Character panel, `/api/characters`, character module creation and chat.
- Code evidence: character card data services, character mode, emotional inertia, prompt/runtime integration.
- Docs evidence: play guide and current-state docs.
- Assets/readback: character card plus `shared/characters.json`, runtime state/chat/memory.
- Hidden/canon risk: medium; character knowledge and secrets rely on visibility/guardian/prompt boundaries.
- Tests: character project/roundtrip/mode/service/integration tests pass within the suite.
- V2-ready point: character capsule, metadata/visibility/lifecycle and service adapters.
- Misreading risk: medium; it is usable but not a full editor, group chat or full Character V2.

### world-rpg

- Current implementation: **ACTIVE-PARTIAL / Grand World V1 foundation**.
- Entry: `/api/modules/create`, chat and `/api/projects/{id}/...` kernel operations.
- Code evidence: `world_rpg.json`, `world_threads.json`, grand-world services, kernel/project readback.
- Docs evidence: mode map/play guide and kernel completion reports.
- Assets/readback: two mode-specific shared files plus shared worldbook/state and runtime proposal/cache files.
- Hidden/canon risk: medium; major changes are intended to pass proposal approval.
- Tests: grand-world, multi-mode first turn, kernel and proposal tests pass.
- V2-ready point: mode-specific readback, kernel turn context, proposal bus.
- Misreading risk: medium; no full quest/combat/progression engine.

### tabletop

- Current implementation: **V2-READY-SOCKET with bounded play helpers**.
- Entry: Module factory and mode play surface.
- Code evidence: tabletop capsule/state/adapters; seed explicitly says dice system is deferred, while lightweight play commands exist elsewhere.
- Docs evidence: play guide marks socket-only.
- Assets/readback: `shared/tabletop.json`, proposal log/cache.
- Hidden/canon risk: medium; rules/results should remain proposals where state-changing.
- Tests: tabletop v1, mode/capsule/project and prompt tests pass.
- V2-ready point: capsule, state schema, prompt profile and lightweight dice substrate.
- Misreading risk: high if simple dice/play helpers are described as a complete tabletop system.

### mystery-puzzle

- Current implementation: **V2-READY-SOCKET / minimal playable workflow**.
- Entry: Mode project + workflow/play path.
- Code evidence: mystery services, hidden-truth filters, `shared/mystery.json`.
- Docs evidence: mode map/play guide.
- Assets/readback: clue/known-fact seed with solution-lock placeholder, proposal log/cache.
- Hidden/canon risk: high; runtime guards/tests exist, but seed says full truth lock is deferred.
- Tests: workflow hidden-truth and mystery minimal loop pass.
- V2-ready point: visibility policy, prompt profile, mystery workflow service.
- Misreading risk: high; protection substrate is not a full authored puzzle/answer system.

### strategy-sim

- Current implementation: **V2-READY-SOCKET / lightweight resource-direction substrate**.
- Entry: Mode project + workflow/play path.
- Code evidence: strategy numeric/probability modules, workflow service and `shared/strategy.json`.
- Docs evidence: mode map/play guide.
- Assets/readback: strategy seed, resource state, proposal log/cache.
- Hidden/canon risk: medium/high for resource/state changes; workflow emits pending proposals.
- Tests: strategy smoke, numeric/probability, workflow and mode tests pass.
- V2-ready point: typed resource/probability foundation and proposal routing.
- Misreading risk: high; seed explicitly disables a full numeric simulation model.

### murder-mystery

- Current implementation: **V2-READY-SOCKET / minimal host shell**.
- Entry: Mode project + workflow/play path.
- Code evidence: murder-mystery engine/adapters, visibility policy, `shared/murder_mystery.json`.
- Docs evidence: mode map/play guide and world profile.
- Assets/readback: suspects/clues/case seed, proposal log/cache.
- Hidden/canon risk: very high; seed truth lock is explicitly deferred even though generic hidden-field guards exist.
- Tests: murder mode, prompt and hidden-visibility tests pass.
- V2-ready point: case/phase/clue/truth-lock contracts and prompt boundary.
- Misreading risk: high; no complete authored case, clue distribution or scoring loop is proven.

### creation-forge

- Current implementation: **Deferred producer plus implemented forge/alchemy substrate**.
- Entry: Documentation says `/api/alchemy/*`; workflows and code include forge creation/instantiation helpers.
- Code evidence: `src/core/creation-forge/**`, alchemy/workflow services, mode capsule and module service.
- Docs evidence: play guide says deferred producer, manifest says `PLANNED`/not visible.
- Assets/readback: forge seed/blueprint files, but the canonical factory and server module service disagree on the exact file set/schema.
- Hidden/canon risk: medium; outputs should remain candidates/blueprints pending confirmation.
- Tests: forge engine/workflow tests pass, but one integration test intentionally persists a forge project through `/api/modules/create` while unit tests assert persistence must be rejected.
- V2-ready point: producer contracts, intake, questioning, blueprint and instantiation plan.
- Misreading risk: **critical** until the activation/persistence policy is unified.

## 5. Documentation Truth Review

| Claim | Source | True? | Issue |
|---|---|---|---|
| “v0.4.0 Pre-V2 Closure baseline” | Chinese README/current-state/release docs/tag | Partial | Runtime/package/app manifest/English README/changelog say v0.3.1 |
| “sealed on main and tagged” | `CURRENT_PROJECT_STATE.md` | Factually yes | Tag exists, but current audit shows the seal criteria were not met |
| “Full test suite passes” | closure/QA/release reports | No | Integration 115/116 and preflight fail reproducibly |
| “115/116 is known character-project port race” | current-state/debug/release docs | No for current run | Actual isolated failure is request socket destruction on body limit |
| “Documentation is self-consistent” | closure report | No | Version split, stale counts, missing route and two broken links |
| “creation-forge is deferred/not persistable” | manifest, factory tests, play guide | No as global behavior | Server API persists it and integration tests require success |
| “not full V2” | current docs | Yes | This boundary is generally repeated clearly |
| “mode-specific readback exists” | architecture/mode docs | Yes | `moduleData.modeSpecific` dynamically reads declared seed files |
| “browser QA passed” | current closure docs | No claim made | Docs correctly say browser gateway QA was not used |

## 6. Asset and User Data Review

| Asset/Data area | Evidence | Risk | Recommendation |
|---|---|---|---|
| Tracked PNG bank | 21 files, 19.6 MB; metadata/hashes in inventory | 20 have zero references; duplicates exist; not packaged/served | Owner classify, inventory and preserve/archive deliberately |
| Code/module assets | `asset:check` 76 assets, 0/0 | Registry check passes | Keep dynamic validation, expand to binaries |
| `userData/config.json` | Ignored; hash changed during audit commands | Live settings polluted | Recover/verify after user decision; isolate tests first |
| `userData/connections.json` | Ignored; hash changed | Live profile pollution | Same as above |
| `userData/secrets.json` | Ignored; one nonempty key; broad inherited ACL | Confidentiality and test-write risk | Do not upload; tighten ACL with consent; isolate tests |
| `userData/corrupt-files.jsonl` | Ignored local path/error record | Local path disclosure if shared | Keep local or redact/archive |
| Runtime `data/` | Empty directory skeleton at audit time | No unuploaded worlds/saves found | Keep local-only runtime boundary |
| Pre-audit untracked files | None | None | Generated `audit/` is the only final untracked tree |

No local unuploaded asset directory beyond ignored userData/runtime skeletons was found. All 21 PNG assets are tracked, not local-only.

## 7. V2 Readiness Review

### True V2 connection points

- `src/core/v2-ready/**` metadata, lifecycle, visibility and capability contracts.
- Eight mode capsules, mode/module maps, state schemas and prompt profiles.
- `moduleData.modeSpecific` seed readback.
- Kernel context, telemetry, branch and proposal/stop-loss services.
- Workflow authority gate and candidate-only output routes.
- Import/export and local JSON/JSONL persistence adapters.

### Not ready for V2 yet

- Full mode-specific gameplay engines and authored content loops.
- Unified mode/project creation authority.
- Fully isolated app-data/test-data architecture.
- Route/UI decomposition and generated API contract.
- Versioned persistence migration strategy and multi-version compatibility matrix.
- Browser/visual regression automation.

### Must fix before V2

1. P0 userData test isolation and local-data recovery decision.
2. Shared HTTP request-body contract.
3. Release/version truth and seal process.
4. creation-forge activation/persistence/schema authority.

### Safe to defer

- Full server/UI modularization after the release blockers are closed.
- OS keychain integration if the single-user plaintext threat model is explicitly accepted in the interim.
- Deep mode engines, authored case/quest/rules content and plugin ecosystem.
- PNG integration/removal after owner classification; do not delete as a cleanup shortcut.

## 8. Final Architecture/Function Decision

**BLOCKED**

The project has enough real substrate to resume Pre-V2 closure work, but not enough trustworthy closure evidence to validate the existing seal. Fix the four must-fix areas, verify local user-data hashes remain unchanged across the complete suite, align the release version, and then perform a fresh audit before deciding whether to retain, supersede or otherwise handle the existing tag.
