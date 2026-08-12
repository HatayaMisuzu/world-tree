# Pre-human Stable Baseline Report

Status: HISTORICAL — superseded by `docs/PREHUMAN_STABLE_BASELINE.md`.

Status: `PREHUMAN_STABLE_BASELINE = ACHIEVED`

This is an automated pre-human baseline, not a human-signed product release. Remote status remains dynamic; the immutable tag SHA is the evidence identity and current GitHub state must be queried.

## Baseline

- Starting SHA: `2e52c987383b1fb6a2666b40322feee5f17ce3e9`
- Final identity: the commit targeted by annotated tag `v0.5.0-prehuman.1` (`git rev-list -n 1 v0.5.0-prehuman.1`)
- Package version: `0.5.0-prehuman.1`
- Release state: automated/product/real-provider closure complete; human validation pending
- No GitHub Release is created for this candidate.

## Completed product loops

- Character V2 provides structured advanced editing for identity, relationship, runtime, cognition, and performance fields, guarded persistence/reload, runtime-context use, real-provider live turns, safe candidate queues, and no automatic canon/memory/relationship writes.
- Worldbook V2 provides structured create/edit/search/toggle/delete, priority and context-slot controls, persistence, injection preview, and verified real-provider runtime influence.
- Strategy Sim V2 provides quick start, continuous turns, explained outcomes, public history, save/resume, ending/restart/export, recovery, and hidden-state isolation. Its runtime is deliberately deterministic and does not require an LLM.
- Onboarding covers model/offline choice, bundled demo guidance, content setup, first interaction, autosave/continue guidance, and persisted skip.
- All eight advertised product entries remain registered, and Cloud Steam City installs through the real example path.
- Creation Forge covers quick creation and localization of user-supplied content, delivery into installable world modules, and a real-provider first turn on generated content.

## Engineering improvements

- CI evidence schema v2 separates `testedSha`, PR `headSha`, and `baseSha`; exact-SHA artifacts are named with the tested commit and locally validated.
- Truth-source documents distinguish historical evidence, current exact-SHA evidence, and dynamic remote state.
- CodeQL and Dependabot workflows are present. The verified dependency audit reported zero known vulnerabilities.
- Real-provider smoke commands accept credentials only through process environment variables and can write sanitized evidence to a temporary report directory. Keys and provider response text are not recorded.
- Release packing and safe-snapshot gates exclude secrets and user data.
- At closure, `main` protection is configured with strict `exact-sha-evidence`, force pushes disabled, and deletion disabled; the effective configuration must be re-read from GitHub for current state.

## Validation

- Two unchanged-code local rounds passed: `npm test` 180/180, unit 1250/1250, integration 141/141, reliability 28/28, persistence soak at 100/500/1000 iterations, and coverage thresholds of 70% lines/functions and 60% branches.
- Browser verification passed twice for all eight entries, the three-turn golden path, interaction regressions, accessibility, and 1440/1024/768/390 layouts without horizontal overflow or observed application console errors.
- Release packaging passed with 606 files and 793,034 packed bytes; safe snapshot generation and Windows launcher checks passed.
- The final provider-smoke harness change passed `npm test` 180/180 and syntax/diff validation before the complete final-SHA gate rerun.

## Real LLM

- Provider/model: DeepSeek / `deepseek-v4-flash`, OpenAI-compatible endpoint.
- Built-in first play: PASS, three persisted real-provider turns, no local fallback, context memory assertion passed, 13,732 observed tokens across exposed turn usage.
- Normal world/character chat and long context: PASS, five consecutive real-provider turns (10 conversation messages), no fallback; Worldbook marker was observed in the first and last turn.
- Character V2 live turn: PASS, configured endpoint used, safe non-empty reply, candidate-only writes (`canon`, `proposal`, `longTermMemory`, and `relationship` all false).
- User-created content and Creation Forge: PASS for quick-create and localization flows, delivered world modules, real-provider first interaction, and safety scan; 4,495 exposed chat tokens were observed.
- Worldbook V2: PASS, one entry activated in injection preview and materially influenced real-provider output.
- Provider connection test: PASS after transient retries; `/models`, model existence, chat completion, and non-empty content checks passed.
- Failure/retry: PASS, an intentional unreachable endpoint produced `LLM_UNREACHABLE`, then restored configuration completed a real-provider recovery turn without fallback.
- Strategy Sim V2: `NOT_APPLICABLE_DETERMINISTIC_ARCHITECTURE`; a deterministic turn passed and secret state was absent from the public view.
- Latency and usage are captured when exposed by the endpoint. Provider response text, prompts, and credentials are deliberately absent from committed evidence.

The real-provider runs are distinct from mock playback and local fallback. Their reproducible commands are `npm run smoke:first-play`, `npm run smoke:user-content-real-llm`, and `npm run smoke:prehuman-real-llm-matrix` with environment-only configuration and a temporary report directory.

## Remote CI

Before final tagging, the tag target is verified by GitHub Actions and the downloaded schema-v2 artifact is locally checked against the same tested SHA. The tag SHA, not this prose, is the durable identity. Future status must be queried from GitHub; historical run IDs and artifact names are not permanent status claims.

The immediately preceding exact-SHA evidence run was CI `31451765827`, CodeQL `31451765812`, artifact `world-tree-ci-evidence-tested-b061a7ef48d204ab52166ee9a116afc451d8db86`. The final tag target receives a new exact-SHA run before tag creation.

## Remaining

`HUMAN_VALIDATION_PENDING`

- First-time human playtest
- Long-session human playtest
- Subjective UX feedback
- A 60-second-or-longer screen recording
- Per-entry `HUMAN_SIGNED` playable decisions

The candidate must not be described as `HUMAN_SIGNED`, `PLAYABLE_FINAL`, or `FULL_PRODUCT_RELEASE_READY` until those human gates are completed.
