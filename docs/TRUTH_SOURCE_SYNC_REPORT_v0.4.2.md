# Truth Source Sync Report v0.4.2

Version: `0.4.2-v2-engineering-foundation-truth.0`
Status: EXECUTED
Audience: maintainers, AI agents

## Purpose

Record documentation and truth-source alignment after Strategy Sim V2 and Worldbook V2 engineering foundations.

## Files changed

- README.en.md: entry table statuses + truth-source block
- app-manifest.json: _note updated to current phase, _updated date
- README.md: version line, doc table, V2 status section
- AI-GUIDE.md: read order, directory map, tests section, legacy references
- AI_AGENT_OPERATING_GUIDE.md: rewritten with new read order, status rules, docs protocol
- MAINTENANCE_ENTRY.md: read order updated with PROJECT_TRUTH_SOURCE
- docs/INDEX.md: truth-source priority, baseline commit reference
- DOCUMENTATION_STATUS.md: rewritten as lifecycle index, no hardcoded test numbers
- DOCS_INVENTORY.md: archived superseded snapshot
- STRATEGY_SIM_V2_REALITY_CHECK.md: filled with executed status
- WORLDBOOK_V2_REALITY_CHECK.md: module adapters wording corrected
- CHANGELOG.md: merged duplicate v0.4.2 sections
- check-truth-source-sync.mjs: enhanced with additional checks

New files:
- CURRENT_DOCUMENTATION_INVENTORY.md
- DOCUMENT_RETENTION_POLICY.md
- TRUTH_SOURCE_SYNC_REPORT_v0.4.2.md (this file)

## Current status confirmed

- Full product-wide V2: NOT COMPLETE
- Product-wide playable closure: NOT COMPLETE
- Strategy Sim V2: engineering foundation complete / product closure incomplete
- Worldbook V2: engineering foundation complete / product closure incomplete

## Known non-product closures

- Tabletop V2: engineering/service closure complete; product/gameplay closure partial
- Detective V2: engineering/service closure complete; product/gameplay closure partial
- Character V2 long-term: engineering/service closure complete; product closure partial
- Single Player ScriptKill V2: engineering/service closure complete; product closure partial

## Validation

Fill in after running:

- npm run truth:check: PASS (0.4.2-v2-engineering-foundation-truth.0)
- npm run docs:check: 24/24 PASS
- npm run asset:check: 0 errors, 0 warnings PASS
- npm run test:worldbook-v2: 17/17 PASS
- npm run test:strategy-sim-v2: 39/39 PASS
- npm run test:world-tree-v2-entries: 30/30 PASS

## Remaining known documentation risks

- Historical archive may contain old language.
- Current docs must defer to PROJECT_TRUTH_SOURCE.
