# Document Retention Policy

## Lifecycle statuses

- `current-truth-source`: Authoritative current truth, cannot be deleted.
- `current-agent-guide`: Current agent operating instructions.
- `current-user-guide`: Current user-facing documentation.
- `current-reference`: Current reference documentation.
- `current-status-report`: Current status or reality check report.
- `historical-report`: Historical but preserved for context.
- `archived-snapshot`: Moved to archive, not current, preserved for history.
- `superseded-reference`: Replaced by a newer document; should point to replacement.
- `compatibility-reference`: Retained for legacy compatibility understanding.
- `archive-candidate`: Can be moved to archive after reference update.
- `deletion-candidate`: Proposed for deletion; requires owner approval.

## Rules

- `current-truth-source` documents cannot be deleted.
- Historical reports may be moved to archive but not rewritten as current truth.
- Superseded references should point to replacement.
- Archive candidates require index/reference updates before moving.
- Deletion candidates require owner approval and reference search (no dangling links).
- Execution packages should be archived if preserved in repo, otherwise not committed.
- Stage reports and completion reports are historical unless promoted by a current truth source.

## Current truth-source documents (2026-06-28)

The following are protected from deletion:

- `docs/PROJECT_TRUTH_SOURCE.md`
- `docs/CURRENT_PROJECT_STATE.md`
- `docs/V2_ENGINEERING_CLOSURE_STATUS.md`
- `docs/V2_ENTRY_COMPLETION_STATUS.md`
- `docs/STATUS_TERMINOLOGY.md`
- `docs/AGENT_STATUS_HANDOFF.md`
