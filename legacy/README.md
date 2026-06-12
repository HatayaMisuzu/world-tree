# Legacy Code

This directory stores code that is intentionally kept out of the active runtime path.

- `adapters/hermes.js`: previous Hermes local-server adapter. World Tree currently uses direct OpenAI-compatible LLM calls through `src/adapters/llm.js`.

Legacy code is kept for reference and possible future integration work, but new features should not import it from active application code.
