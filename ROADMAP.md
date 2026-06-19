# World Tree Roadmap

## Current Baseline: v0.3.0

v0.3.0 is the local-first workbench baseline: model connection diagnostics, draft worlds, review queues, and `.worldtree` import/export.

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
