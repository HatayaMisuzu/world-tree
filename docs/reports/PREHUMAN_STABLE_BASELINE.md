# Pre-human Stable Baseline Report

Status: `PREHUMAN_STABLE_BASELINE = NOT ACHIEVED`

This report describes the current candidate. Remote status is dynamic and must be queried; a committed document does not permanently confer a CI or provider PASS.

## Baseline

- Starting SHA: `2e52c987383b1fb6a2666b40322feee5f17ce3e9`
- Candidate version: `0.5.0-prehuman.1`
- Final main SHA: not fixed
- Immutable tag: not created

## Completed product loops

- Character V2: structured advanced editing of identity, relationship, runtime, cognition, and performance fields; validation prevents invalid overwrites; save, reload, and runtime-context consumption are covered.
- Worldbook V2: structured create, edit, search, enable/disable, safe delete, priority/context-slot controls, persistence, injection preview, and runtime-inclusion coverage.
- Strategy Sim V2: default quick start, repeated actions, explained resource/probability outcomes, public history, automatic persistence, save/resume, ending/restart, export, and recoverable errors without hidden-state leakage.
- Onboarding: first-run explanation, model/offline setup choices, bundled demo guidance, content setup, first interaction, autosave/continue guidance, and a persisted skip action.
- Product entries and demo: the eight-entry registry is preserved and the advertised Cloud Steam City demo is installed through the real example path.

## Engineering improvements

- CI evidence schema v2 separates `testedSha`, PR `headSha`, and `baseSha`; artifacts are keyed by the exact tested commit and locally validated before a remote PASS is reported.
- Current truth-source documents distinguish historical, current exact-SHA, and dynamic remote evidence.
- CodeQL and Dependabot workflows were added; dependency audit currently reports no known vulnerabilities.
- The package version is aligned to the pre-human candidate identity. Release packaging and secret/user-data exclusion remain release gates.

## Validation performed so far

- Targeted Character V2, Worldbook V2, Strategy Sim V2, product-playable, console-boundary, CI-evidence, truth, and project checks passed during implementation.
- In-app browser QA covered first-run onboarding/skip persistence, Character advanced edit/save/reload, Worldbook create/edit/disable/reload/injection preview, and Strategy multi-turn/history/save/reload-resume behavior with no observed application console errors.
- The complete two-pass local, release-package, Windows, and exact-main-SHA remote validation results must be recorded after the candidate commits are fixed.

## Real LLM

- Current real-provider matrix status: `BLOCKED_BY_CREDENTIALS`.
- The environment exposed an Anthropic gateway configuration, but model discovery and a minimal real `/v1/messages` call both returned HTTP 401 using the standard x-api-key and bearer forms.
- The application normal configuration contained only a deliberately fake local credential. No mock or fallback result is counted as real-provider evidence, and no key or provider response was recorded.

## Remote CI

No final candidate SHA has been pushed and verified yet. When available, record the workflow run ID and schema-v2 artifact name. Future status must always be queried from GitHub using the tag SHA as the evidence identity.

## Remaining

- A valid environment-only provider credential and a current-SHA representative real-LLM matrix PASS.
- Exact final-main-SHA GitHub Actions PASS and validated CI evidence artifact.
- Immutable tag creation and verified main protection after all tag gates pass.
- Human first-time and long-session playtests, subjective UX feedback, 60s+ recording, and per-entry `HUMAN_SIGNED` decisions.

Because non-human gates remain, this candidate is not yet the pre-human stable baseline.
