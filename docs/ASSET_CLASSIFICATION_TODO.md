# Asset Classification TODO — PNG Bank

## Audit Finding

The full local audit found 21 tracked PNG files containing about 19.6 MB of visual material. Twenty have zero textual references; the remaining filename only overlaps stale archived manifest text and is not served or packaged as an active runtime asset. Duplicate hashes exist.

## Rule

Do not delete, move or downgrade these assets automatically. Owner classification is required.

## Classification Needed

| Asset | Size | Current reference | Proposed classification | Owner decision |
|---|---:|---|---|---|
| `design/qa-v0.1.8-desktop.png` | 57,780 | none | QA evidence | pending |
| `design/qa-v0.1.8-desktop-final.png` | 57,780 | none; byte-identical to desktop | duplicate QA evidence | pending |
| `design/qa-v0.1.8-mobile.png` | 28,045 | none | QA evidence | pending |
| `design/qa-v0.1.8-mobile-final.png` | 28,045 | none; byte-identical to mobile | duplicate QA evidence | pending |
| `design/ui-assets-bank/archive-library-bg-image2.png` | 2,199,691 | none | design archive | pending |
| `design/ui-assets-bank/dialogue-frame.png` | 2,039,147 | none | design archive | pending |
| `design/ui-assets-bank/dialogue-paper-bg-image2.png` | 2,133,622 | none | design archive | pending |
| `design/ui-assets-bank/menu-icon-journey.png` | 17,165 | none | design source/archive | pending |
| `design/ui-assets-bank/menu-icon-memory.png` | 24,570 | none | design source/archive | pending |
| `design/ui-assets-bank/menu-icon-monitor.png` | 23,763 | none | design source/archive | pending |
| `design/ui-assets-bank/menu-icons-set-image2.png` | 1,366,952 | none | design archive | pending |
| `design/ui-assets-bank/menu-icon-world.png` | 29,346 | none | design source/archive | pending |
| `design/ui-assets-bank/monitor-terminal-bg-image2.png` | 1,757,536 | none | design archive | pending |
| `design/ui-assets-bank/page-ornaments-image2.png` | 1,231,427 | none | design archive | pending |
| `design/ui-assets-bank/page-ornaments-image2-keyed.png` | 408,872 | none | design archive | pending |
| `design/ui-assets-bank/settings-root-bg-image2.png` | 1,848,931 | none | design archive | pending |
| `design/ui-assets-bank/status-frame-image2.png` | 830,944 | none | design archive | pending |
| `design/ui-assets-bank/status-frame-image2-keyed.png` | 277,766 | none | design archive | pending |
| `design/ui-assets-bank/world-tree-emblem-image2.png` | 1,634,718 | none | design archive | pending |
| `design/ui-assets-bank/world-tree-emblem-image2-keyed.png` | 602,847 | none | design archive | pending |
| `design/ui-assets-bank/world-tree-hero.png` | 2,975,121 | stale archived filename overlap only | design archive | pending |

## Possible Outcomes

- Keep as active design source.
- Move to a documented design archive.
- Add inventory/provenance.
- Remove duplicates only after explicit owner approval.
- Do not treat unreferenced as automatically useless.
