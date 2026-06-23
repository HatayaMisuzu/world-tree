# P2 Long Play Kernel Audit

## Actual Structure

1. Modes are registered in `src/core/modes/mode-manifest.js`.
2. Fixed base mappings live in `src/core/modes/mode-module-map.js` and will not be replaced.
3. Modules are registered in `src/core/modules/module-manifest.js` and resolved through the registry/loader.
4. Proposal approval is in `src/core/system/proposal-bus.js`.
5. Save adapters are in `src/core/system/world-tree-save-system.js`.
6. Project files are created by `src/core/modes/mode-project-factory.js` using project-local `shared/` and `runtime/`.
7. `src/core/engine/branch-system.js` already contains a legacy world-engine branch model, including merge APIs. P2 will add a separate project save-tree adapter and will expose no merge operation.
8. `src/core/engine/world-telemetry.js` is an older numeric/in-memory telemetry engine. P2 will add a branch-local enum digest that is read-only with respect to canon and proposals.
9. `src/core/data/processing-engine.js` is a simple material scoring package. Creation Forge has no controlled source-preserving candidate delivery pipeline.
10. Existing P0 tracking/scene/world-state and P1 impact/growth/context/director services will be reused rather than duplicated.

## Extension Strategy

- Add a registered-module-only overlay above the fixed mode map.
- Add project-local branch path resolution under `branches/<branch-id>/` and pass the resolved branch root to P0/P1/P2 services.
- Add read-only telemetry, one-beat auto-light, and candidate-only processing.
- Keep legacy branch/telemetry/processing APIs intact for compatibility.

## Explicit Exclusions

- No UI, plugin, visual asset, branch merge, automatic canon write, or external service.
