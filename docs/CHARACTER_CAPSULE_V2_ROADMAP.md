# Character Capsule V2 Roadmap — Text-first Execution Slices

> Status: **CLOSED / MVP COMPLETE** — Character Capsule V2 Text-first Runtime 已完成封版。

## Slice 1 — Design Seal

Docs only.

- Add Character Capsule V2 Product Spec.
- Add Character Capsule V2 UI Rules.
- Add this roadmap.
- Update docs/INDEX.md.
- Optionally update docs/ROADMAP_CANDIDATES.md.

No code changes.

## Slice 2 — Text-first Core Contracts

Pure functions only.

- Character runtime contract.
- Companion common-sense cognition model.
- Character performance fingerprint.
- Character V2 profile draft validator.
- Unit tests.

No persistence changes. No server route changes. No UI changes.

## Slice 3 — Advanced UI Gate

Minimal UI integration.

- Add advanced settings toggle.
- Keep advanced panels hidden by default.
- Add UI helper tests or interface audit check.
- Do not implement full advanced editor.

## Slice 4 — Runtime Context Bridge (COMPLETED, v2-2)

- Runtime context snapshot from V2 sidecars.
- Read-only, no LLM injection.
- Server load returns v2RuntimeContext.
- UI shows "运行上下文已就绪" badge.

## Slice 5 — Runtime MVP (COMPLETED, v2-3)

- Prompt packet preview generation.
- First-turn draft template.
- Memory / relationship / quality candidate hooks (candidate-only, no writes).
- Advanced details hidden behind toggle.
- V2 raw JSON hidden by default in preview.

## Deferred

- Full Character Engine.
- Persistent long-term memory.
- Relationship persistence.
- Group chat.
- Cross-mode character asset reuse.
- creation-forge production flow.
- PNG/JPG metadata and multimodal ecosystem.
