# User Content Real LLM Smoke

Date: 2026-07-08

Status: PASS

## Provider Profile

- baseUrl: `https://api.deepseek.com/v1`
- model: `deepseek-v4-flash`
- secret: not recorded

## Flow A Evidence

- intakeType: `quick_create`; preview.mode: `quick_create`; moduleKey: `world:cyber_xian_dan_escape`; localFallback: false

## Flow B Evidence

- intakeType: `localize_existing`; preview.mode: `localize_existing`; moduleKey: `world:浮空城邦与灵能潮汐`; worldbook entries: 1

## Safety Scan

- PASS: no hidden/system/secret/local-path payload detected in smoke evidence.

## Usage

- observed provider calls with usage: 1
- prompt tokens: 3653
- completion tokens: 540
- total tokens: 4193
- cache hit tokens: 2944
- reasoning tokens: 0
- completeness: complete_for_exposed_chat_turn_usage; alchemy plan/preview usage not exposed by endpoint

## Commands Run

- `WORLD_TREE_RUN_REAL_LLM_SMOKE=1 npm run smoke:user-content-real-llm`

## Notes
