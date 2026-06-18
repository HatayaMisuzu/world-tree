# World Tree Roadmap

## Current Baseline: v0.2.2

v0.2.2 focuses on security hardening and test coverage rather than new features:

- Import paths are now rejected (not silently sanitized) for traversal, absolute, and ambiguous segments.
- Unknown overlay files are always manual-only, even when `policy:auto` is requested.
- Sensitive overlay files (characters/worldbook/scene-chain) cannot be auto-upgraded.
- Guardian overlay checks target the `runtime/overlay` whitelist instead of the old `data/engine` wording.
- Integration tests run against `WORLD_TREE_DATA_DIR` to avoid touching real local data.
- Module lifecycle and export/import roundtrip are covered by integration tests.
- `module-service.js` now provides a `createModuleService()` factory; `server.js` delegates to it.

## Next Priorities

1. **Continue Route Service Extraction**
   Continue shrinking `server.js` by moving connection profiles, world packs, plugins, and character-card APIs into focused service modules.

2. **Worldbook-Chat Persistence Integration Test**
   Add a `worldbook-chat-persistence.test.js` with mocked LLM responses to cover the full turn lifecycle.

3. **Pending Overlay Review UI**
   Surface `pending.jsonl` and `manual.jsonl` in the console so users can adopt, merge, ignore, or export proposed changes.

6. **Frontend Layout Cleanup**
   Keep the pure HTML/CSS/JS stack for now, but split large render functions into view modules before deeper UI redesign work.

7. **Plugin Sandbox Hardening**
   Expand plugin manifest validation, add per-plugin error logs, and keep remote scripts disabled.
