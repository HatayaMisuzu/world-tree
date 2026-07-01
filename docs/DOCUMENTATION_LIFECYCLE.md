# Documentation Lifecycle

Version: `0.4.2-v2-engineering-foundation-truth.0`
Status: CURRENT

All agent takeovers must read `docs/PROJECT_TRUTH_SOURCE.md` and `docs/CURRENT_PROJECT_STATE.md` before using historical reports, proposals, or archive files.

## Lifecycle Types

| Lifecycle | Meaning |
|---|---|
| `current_truth` | Current project truth source. Keep this set small and authoritative. |
| `active_operating` | Current operating instructions, maintenance guides, or agent procedures. |
| `active_architecture` | Current implemented architecture and route maps, not future designs. |
| `active_product_contract` | Current product/API contract documents or status vocabulary. |
| `current_evidence_report` | Current evidence reports that support present status claims. |
| `candidate_or_proposal` | Proposed, candidate, roadmap, or future work. Must not be treated as implemented. |
| `historical_archive` | Historical snapshots and old reports. They must not override current truth. |
| `deprecated` | Superseded documents. They must point to a replacement or explain why they remain. |

## Rules

- `current_truth` must stay limited to the truth-source documents that define present project status.
- `historical_archive` can preserve old state, but cannot override `current_truth`.
- `candidate_or_proposal` material is planning input only; it is not implementation evidence.
- `deprecated` documents must include a replacement or a clear reason in `docs/DOC_REGISTRY.json`.
- Active documents must state `v1.0.0` NOT READY, full product-wide V2 NOT COMPLETE, product-wide playable closure NOT COMPLETE, and live Real LLM flow BLOCKED unless explicit credentials/config evidence is recorded.
- Current evidence reports may describe PASS results only inside the recorded scope; selected API/service loop PASS is not browser/UI product closure PASS.

## Machine Check

Run:

```bash
npm run docs:lifecycle:check
```

The registry lives at `docs/DOC_REGISTRY.json` and is intentionally partial in this pass: it covers active truth, architecture, product contract, operating, and current evidence documents first.
