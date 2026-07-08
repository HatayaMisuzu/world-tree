# First Play Real LLM Smoke

Generated: 2026-07-08T06:36:38.408Z

Status: PASS

## Provider

- baseUrl: `https://api.deepseek.com/v1`
- model: `deepseek-v4-flash`
- key: not recorded

## Demo

- exampleId: `demo-world-cloud-steam-city`
- moduleKey: `demo-world-cloud-steam-city`

## Assertions

- PASS install_demo_world: install status ok
- PASS turn_1_status_ok: status=ok; code=
- PASS turn_1_not_local_fallback: local fallback is not real LLM evidence
- PASS turn_1_narrative_length: narrative length 671
- PASS turn_2_status_ok: status=ok; code=
- PASS turn_2_not_local_fallback: local fallback is not real LLM evidence
- PASS turn_2_narrative_length: narrative length 655
- PASS turn_3_status_ok: status=ok; code=
- PASS turn_3_not_local_fallback: local fallback is not real LLM evidence
- PASS turn_3_narrative_length: narrative length 1022
- PASS third_turn_context_memory_minimum: messages before turn 3 include 雾铃塔
- PASS chat_jsonl_six_records: chat.jsonl record count 6
- PASS no_hidden_truth_or_secret_leak: no forbidden evidence markers

## Turns

- Turn 1: status=ok; narrativeChars=671; persistedTurnId=turn-1
- Turn 2: status=ok; narrativeChars=655; persistedTurnId=turn-2
- Turn 3: status=ok; narrativeChars=1022; persistedTurnId=turn-3

## Usage

- observed provider calls with usage: 3
- prompt tokens: 13055
- completion tokens: 2667
- total tokens: 15722
- cache hit tokens: 7296
- reasoning tokens: 0

## Notes

PASS requires a real provider key supplied through environment variables. Human playtest and screen recording are still HUMAN_VALIDATION_REQUIRED.
