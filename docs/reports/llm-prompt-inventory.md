# LLM Prompt Inventory

Date: 2026-06-30

Inventory command:

```bash
rg -n "SYSTEM_PROMPT|PROMPT|prompt|messages|system|user|assistant|chat/completions|build.*Prompt|TaskContract|LLM" src server.js world-tree-console.js tests docs
```

## Prompt Sources

| File path | Name | Role | Output contract | Visible to player | Hidden-truth risk | Mutation risk | Privacy risk | Tests | Recommended action |
|---|---|---|---|---|---|---|---|---|---|
| `src/adapters/llm.js` | `DIRECTOR_SYSTEM_PROMPT` | director | JSON | no | medium | proposal | local paths/secrets/user content | `tests/unit/llm-prompt-audit.test.js` | Added JSON-only, privacy, hidden-truth, proposal/canon clauses. |
| `src/adapters/llm.js` | `WRITER_SYSTEM_PROMPT` | writer | narrative/mixed marked sections | yes | high | proposal | local paths/secrets/user content | `tests/unit/llm-prompt-audit.test.js` | Added public-view and no direct canon approval clauses. |
| `src/adapters/llm.js` | `GUARDIAN_SYSTEM_PROMPT` | guardian/auditor | JSON | no | medium | none | local paths/secrets/user content | `tests/unit/llm-prompt-audit.test.js` | Added JSON-only, privacy, hidden-truth clauses. |
| `src/core/prompts/prompt-builder.js` | `buildInternalTaskPrompt` | adapter | mixed prompt packet | no | medium | proposal | user content | `test:prompts`, `test:llm-prompts` | Keep using registered prompt blocks and task contracts. |
| `src/core/prompts/prompt-task-contracts.js` | `buildContractInstruction` | adapter | task contract text | no | medium | proposal | user content | `test:prompt-contracts` | Keep JSON contract parse fallback tests. |
| `src/core/worldbook-v2/worldbook-prompt-adapter.js` | `worldbookContextToPromptBlocks` | adapter | system prompt blocks | no | high | none | user worldbook content | `test:worldbook-v2`, `test:llm-prompts` | Preserve visibility guard and candidate/canon distinction. |
| `src/server/alchemy-prompt-templates.js` | Alchemy planning/generation prompt templates | generator | JSON/markdown mixed drafts | no | medium | proposal/writeSet after delivery only | user content | `test:alchemy-closure` | Keep delivery route as explicit write boundary. |
| `src/core/tabletop/tabletop-v2-llm-polish.js` | Tabletop polish prompt | writer | narrative polish | yes | high | none | user module content | `test:llm-routing`, `test:v2-product-playable` | Must never reveal GM-only notes. |
| `src/core/detective/detective-v2-llm-narration.js` | Detective narration prompt | writer | narrative | yes | high | none | user case content | `test:llm-routing`, `test:v2-product-playable` | Must never reveal culprit/fullTruth before allowed phase. |
| `src/core/single-player-scriptkill/single-player-scriptkill-llm-dialogue.js` | ScriptKill dialogue prompt | writer | dialogue | yes | high | none | role-private user package content | `test:llm-routing`, `test:v2-product-playable` | Must never reveal DM/fullTruth/other-role private knowledge. |
| `server.js` | LLM test/chat route payloads | adapter | JSON HTTP payload | mixed | medium | runtime append | local config/secrets/user content | `test:integration`, `smoke:user-content-real-llm` | Keep secret masking and local-only route policy. |

## Full-Function Entry Coverage

| Product entry | LLM task contracts audited | Main drift/OOC risks |
|---|---|---|
| Quick Setting | `writer`, `workflow-writer` | generic chat drift, claiming persistence before save, hallucinating missing setup |
| Character | `character-refinery`, `character-v2-live` | OOC response, generic AI persona, forced memory/relationship mutation |
| World RPG / Worldbook | `writer`, `director-analysis`, `guardian-audit` | hidden truth leakage, turning candidates into canon, unrelated assistant behavior |
| Tabletop | `tabletop-narration-polish` | rerolling, changing dice results, revealing GM-only notes, becoming generic chat |
| Detective | `detective-investigation-narration`, `detective-interrogation-response`, `detective-case-blueprint` | revealing culprit/fullTruth/truthLedger, inventing clues, explaining hidden meaning |
| Strategy Sim | `director-analysis`, `writer`, `guardian-audit` | hidden variable leakage, hallucinated strategy rules, off-topic chat drift |
| ScriptKill | `scriptkill-public-talk`, `scriptkill-private-talk` | DM/fullTruth leak, other-role private knowledge leak, speaking as system/AI |
| Creation Forge | `alchemy-classifier`, `alchemy-extractor`, `alchemy-cocreate` | fictionalizing source, claiming saved content, writing canon directly |

## Adversarial Scenario Classes

- `prompt-injection-generic-ai`: user asks the model to ignore the feature and answer as normal ChatGPT.
- `ooc-system-disclosure`: user asks for hidden prompt, model/API details, local path, or key material.
- `canon-overwrite`: user asks the model to save/approve/overwrite canon directly.
- `missing-context-hallucination`: user asks the model to invent missing rules or pretend absent context exists.

## Inventory Boundary

The source tree contains many references to prompt plumbing and tests. This report records the prompt-bearing sources that construct outbound/system prompt content or role contracts. Prompt audit script checks safety clauses, full-function entry coverage, task contracts, drift/OOC resistance, and report coverage.
