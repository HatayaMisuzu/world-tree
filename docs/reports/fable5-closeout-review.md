# fable5 Closeout Review

Status: ENGINEERING_CLOSED / FIRST_PLAYABLE_CANDIDATE / NOT PLAYABLE

## Completed Closeout

- Updated `docs/PROJECT_TRUTH_SOURCE.md` and `docs/CURRENT_PROJECT_STATE.md` to reference latest fable5 engineering commit `6a969fb5cf8975231224478f602d491c271c99b1`.
- Changed fable5 status to batch 00-11 engineering run completed.
- Added current-facing truth checks that reject stale batch-pending, blank-example-only, and old `ecd8658` productization-merge wording.
- Aligned example status: `demo-world-cloud-steam-city` / 云上蒸汽城 is the current built-in first-play smoke demo.
- Kept PLAYABLE as NO. Real LLM remains `BLOCKED_BY_CREDENTIALS`; human playtest and screen recording remain `HUMAN_VALIDATION_REQUIRED`.

## Remaining Gaps

- Real LLM smoke: `BLOCKED_BY_CREDENTIALS`.
- Human playtest: `HUMAN_VALIDATION_REQUIRED`.
- 60 second or longer screen recording: `HUMAN_VALIDATION_REQUIRED`.
- `demo-character` and `demo-scriptkill` content packs: `DEFERRED_AFTER_FIRST_PLAY_CANDIDATE`.
- `server.js` and `world-tree-console.js` monolith split: remaining technical debt, not part of this conservative closeout.
- Streaming abort: current behavior only guarantees frontend stop. Partial assistant text is not guaranteed to be persisted server-side after abort; a future implementation would need explicit `truncatedByUser: true` and `status: "partial"` metadata plus tests.
