# Tests Inventory

> Stage 5A: 当前测试体系真实盘点。从 `package.json` 和实际 `tests/` 目录生成。

## Package Scripts (测试相关)

| Script | Command | Purpose |
|---|---|---|
| `test` | `node scripts/test.mjs` | 主测试入口（usage unclear） |
| `test:unit` | `node --test tests/unit/*.test.js` (35 files) | 全量单元测试 |
| `test:integration` | `node --test tests/integration/*.test.js` | 全量集成测试 |
| `test:p0` | `tests/unit/living-world-kernel-p0.test.js` | P0 活世界 Kernel (7 tests) |
| `test:p1` | `tests/unit/experience-stability-kernel-p1.test.js` | P1 体验稳定 Kernel (8 tests) |
| `test:p2` | `tests/unit/long-play-kernel-p2.test.js` | P2 长期游玩 Kernel (40 tests) |
| `test:kernel` | kernel-turn-context + kernel-completion | Kernel 集成 |
| `test:prompts` | prompt-*.test.js + prompt-runtime-integration | 提示词 (42 tests) |
| `test:legacy-mechanisms` | creation-wizard + legacy-mechanism-expansion | P3 M1-M11 (22 tests) |
| `test:assets` | `tests/unit/asset-status-matrix.test.js` | 资产状态矩阵 |
| `test:authority` | `tests/unit/authority-policy.test.js` | Authority 策略 |
| `test:legacy-modernization` | `tests/unit/legacy-modernization.test.js` | Legacy 现代化 |
| `test:workflow-readiness` | `tests/unit/workflow-context-envelope.test.js` | Workflow 就绪 |
| `test:workflows` | workflow-*.test.js (unit + integration) | 工作流 (63 tests) |
| `test:workflow-e2e` | `tests/integration/workflow-e2e.test.js` | 工作流 E2E |
| `workflow:check` | `scripts/validate-workflow-integration.mjs` | 工作流结构验证 |
| `real-play:smoke` | `scripts/real-play-scenarios.mjs` | 6 个离线 scenario |
| `asset:check` | `scripts/validate-asset-inventory.mjs` | 资产清单验证 |

## Preflight Chain

`npm run preflight` 实际执行顺序（从 `package.json`）：

```
audit → check → docs:check → asset:check → test:p0 → test:p1 → test:p2
→ test:kernel → test:prompts → test:legacy-mechanisms → test:assets
→ test:authority → test:legacy-modernization → test:workflow-readiness
→ workflow:check → test:workflows → test:unit → test:integration
→ interface-audit
```

16 个子命令。Stage 5A 未执行完整 preflight（等效覆盖已通过单独命令验证）。

## Unit Tests

| Category | Files | Tests (Stage 5A run) |
|---|---|---|
| Core engine | direction-packet, emotion-state, output-parser, guardian, worldbook, worldbook-runtime, alchemy, alchemy-preview-service, mechanism-status, overlay-store, guardian-overlay | ~80 |
| Infrastructure | llm, path-security, fs-utils, module-service, module-registry | ~30 |
| Modes | mode-module-map, quick-setting-mode, legacy-module-wrappers, mode-runtime, module-runtime-orchestrator, mode-state-schema, mode-project-factory, character-mode, multi-mode-entry, mode-artifact-contract, mode-capsule-registry | ~80 |
| Character | character-v1-services, character-module-integration | ~15 |
| World | worldbook-foundation, grand-world-v1 | ~20 |
| System | system-closure | ~15 |
| Real Play | real-play-productization, proposal-persistence-audit | ~15 |
| **V2-ready** | universal-metadata, visibility, lifecycle, capability, character-v2-ready, worldbook-v2-ready, tabletop-v2-ready, mystery-v2-ready, strategy-v2-ready, strategy-numeric-system, strategy-probability-system, creation-v2-ready, murder-v2-ready, quick-setting-raw-setting-intake | 67 |
| Workflows | workflow-console-summary, workflow-creation-alchemy, workflow-play-turn-postcheck, workflow-character-mystery, workflow-strategy-direction, workflow-spine, workflow-authority-gate, workflow-context-envelope | ~35 |
| Legacy | legacy-modernization, authority-policy, asset-status-matrix, creation-wizard | ~30 |
| Prompts | prompt-mode-profiles, prompt-orchestration, prompt-activation-log, prompt-output-schemas, prompt-task-contracts | ~42 |
| Kernel | kernel-turn-context, long-play-kernel-p2, living-world-kernel-p0, experience-stability-kernel-p1 | ~55 |

**Total unit tests: 416 (all PASS)**

V2-ready tests: 67 items covering 8 mode normalizers + universal metadata/visibility/lifecycle/capability + strategy numeric/probability substrate.

## Integration Tests

116 tests (all PASS). Major coverage areas:

| Area | Tests |
|---|---|
| Alchemy (preview/refine/commit/export) | 3 |
| Character (create/import/roundtrip) | 3 |
| Creation Forge (intake/blueprint/instantiate) | 11 |
| Data (dashboard/import-export) | 5 |
| Kernel (P0/P2/living-world) | 5 |
| Multi-mode (first-turn/projects) | 6 |
| Individual modes (tabletop/mystery/strategy/murder-mystery) | 10 |
| Module lifecycle | 1 |
| M1-M11 Legacy mechanisms (cross-chain) | 10 |
| Overlay persistence | 2 |
| Prompts (orchestrator/runner/compat) | 4 |
| Real Play scenarios | 2 |
| Review facts | 1 |
| Security (origin/rate-limit/body/traversal/path/plugin/export/status) | 8 |
| Workflow (E2E/LLM adapter/server API) | 8 |
| Worldbook (foundation/roundtrip) | 3 |
| Worldpack (preview/import/security) | 3 |

## Smoke / Audit / Interface / Docs Checks

| Command | Stage 5A Result | Details |
|---|---|---|
| `npm run check` | ✅ PASS | WORLD_TREE_DESKTOP_CHECK PASS |
| `npm run docs:check` | ✅ PASS | 24/24 checks |
| `npm run asset:check` | ✅ PASS | 0 errors, 11 warnings |
| `npm run workflow:check` | ✅ PASS | 0 errors, 0 warnings |
| `npm run real-play:smoke` | ✅ PASS | 6/6 scenarios |
| `npm run interface-audit` | ✅ PASS | 141 passes, 8 warnings |
| `git diff --check` | ✅ PASS | Clean |

## Coverage Gaps

| Gap | Severity | Notes |
|---|---|---|
| UI browser QA not scripted | Medium | 仅手动 browser QA（desktop 1280×720, mobile 390×844） |
| Prompt builder v2-ready context integration not tested | Low | V2-ready foundation 的数据未接入 prompt builder |
| Raw setting safety flag downstream consumption not tested | Low | `preserveOriginal` 保存了但无测试验证下游正确消费 |
| Strategy complete game not tested | Low | 仅 substrate 层面测试，非完整策略游戏 |
| Preflight not run (equivalent coverage verified individually) | Low | 16 个子命令已全部分别通过 |

## Test File Count

- `tests/unit/`: 59 test files
- `tests/integration/`: 23 test files + `helpers/server-process.js`
- `tests/fixtures/v2-ready/`: 8 fixture files (one per mode)
- `scripts/`: 10 script files (5 core + 5 auxiliary)
