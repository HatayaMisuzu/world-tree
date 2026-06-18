# World Tree Roadmap

## Current Baseline: v0.2.1

v0.2.1 focuses on maintainability and stability rather than new user-facing features:

- Version display now reads the backend `/api/health` version.
- Runtime overlay writes are restricted to `{world}/runtime/overlay/` whitelist files.
- Confirm-required writes are queued in `pending.jsonl`; manual/unknown writes are recorded in `manual.jsonl`.
- Legacy data import validates every JSON/JSONL file before writing anything.
- Guardian has stronger tests for required content, forbidden content, user-question response, and empty/short output.
- Integration tests cover import validation and overlay persistence.

## Next Priorities

1. **Route Service Extraction**
   Continue shrinking `server.js` by moving connection profiles, world packs, plugins, and character-card APIs into focused service modules.

2. **Pending Overlay Review UI**
   Surface `pending.jsonl` and `manual.jsonl` in the console so users can adopt, merge, ignore, or export proposed changes.

3. **End-to-End Runtime Tests**
   Add a test harness that boots the HTTP server on a random local port with a temporary data root and mocked LLM responses.

4. **World Pack Contract Tests**
   Verify `.worldtree` exports exclude secrets, private runtime data, and unconfirmed overlay/manual queue entries by default.

5. **Import Recovery UX**
   Show precise file and line errors in the frontend import dialog, with a preview of valid files and rejected files.

6. **Frontend Layout Cleanup**
   Keep the pure HTML/CSS/JS stack for now, but split large render functions into view modules before deeper UI redesign work.

7. **Plugin Sandbox Hardening**
   Expand plugin manifest validation, add per-plugin error logs, and keep remote scripts disabled.
