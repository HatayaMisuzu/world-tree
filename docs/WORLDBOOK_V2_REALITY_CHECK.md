<!-- WORLD_TREE_TRUTH_SOURCE_SYNC:START -->
## Current status summary

Worldbook V2 engineering foundation is complete.

Completed engineering foundation: entry schema, candidate ledger, canon store, trigger engine, context compiler, visibility guard, prompt adapter, prompt-builder hook, usage/activation log, module adapters, and runtime injection helper.

Worldbook V2 product closure is not complete. Missing product closure: product UI editor, V2 server API, persistent V2 worldbook runtime service, complete review-facts/growth-tree V2 unification, product-grade import/export, and browser-proven first-run flow.
<!-- WORLD_TREE_TRUTH_SOURCE_SYNC:END -->

# Worldbook V2 Reality Check

状态：EXECUTED · Hermes 执行完成  
原则：项目资产表只作为索引，真实完成状态以目标文件、测试和调用链为准。

## 已检查真实文件

- package.json: test:worldbook-v2 added, test script unchanged
- module-manifest: lore.worldbook_trigger / lore.worldbook_growth_tree / context.engine registered
- mode-module-map: multi-entry mapped to worldbook trigger/context/growth-tree
- data/worldbook: legacy M2 matching engine (exact/semantic/vector/scene/scanDepth/probability)
- runtime/worldbook-runtime: budget/diagnostics/injectedWorldbook/dropped/misses
- worldbook-growth-tree: candidate-only growth tree
- alchemy-digest: candidate-only, multi-type candidates
- material-warehouse: source registry + candidate index + adoption ledger
- character-kernel-v2: canonProfile/expressionDNA/responseLadder/growthPhase/boundaries
- cognition-matrix: known/suspected/misunderstood/unknown/forbidden
- faction-graph: public/secret relation split
- world-rules-engine: rules/evaluate/propose changes
- narrative-consistency-radar: hidden truth leak blocker
- random-event-pool: event candidate/runtime, major proposal-only
- prompt-builder: worldbookContext → PromptBlocks hook added
- prompt visibility/sanitizer/log: layer=worldbook accepted; hidden/private/gm/system sanitizer
- real-play turn-context: referenced in trigger engine
- server review/adopt: worldbook write paths intact

## 本次新增

- WorldbookEntry schema (normalize/validate/authority/visibility)
- WorldbookCandidate ledger (append/dedupe/transition lifecycle)
- Canon WorldbookStore (confirmed/manual/approved gate)
- Trigger Engine (keyword/regex/filter/scanDepth/probability/inclusionGroup)
- Context Compiler (slot budget, audience filtering, insertion order)
- Visibility Guard (hiddenTruth/gm_only/system_only, no hidden leak)
- Prompt Adapter (context pack → PromptBlocks, worldbook layer)
- Module Adapters (module manifest + module-map integration)
- Usage Log (token budget tracking)
- Runtime prepareWorldbookV2Injection

## 测试结果

- npm run test:worldbook-v2: 17/17 PASS (schema/trigger/compiler/store/runtime/prompt/adapter)
- npm run test:prompts: PASS (0 fail)
- npm run asset:check: PASS (0 errors, 0 warnings)
- npm run docs:check: 24/24 PASS
- npm test: 160/160 PASS

## 修复记录

- visibility-guard: assertNoWorldbookHiddenLeak now scans only content slots, not omitted metadata
- entry-schema: normalizeWorldbookEntry accepts options.defaultAuthority; normalizeWorldbookCandidate passes "candidate"
- prompt-builder: worldbookBlocks logged in prompt activation log
- entry-schema: regex keys deduped from plain keys during normalization
- candidate-ledger: dedupe event writes audit log entry
