# Local LLM Setup — World Tree v0.4.0-pre-v2-closure.1 Repair Candidate

> No real secrets are included in this document.

## Configuration Entry

LLM settings are configured via:
- **Web UI:** Settings panel at `http://localhost:3000`
- **API:** `GET/POST /api/config` with `llmBaseUrl`, `llmModel`
- **Secrets API:** `POST /api/secrets/llm` to save API keys

## Required Fields

| Field | Example |
|---|---|
| Base URL | `http://127.0.0.1:11434/v1` (local Ollama) or `https://api.deepseek.com/v1` |
| Model | `deepseek-v4-flash` or your model name |
| API Key | Saved via Settings; never committed |

## Local Provider Example

Typical local endpoint: `http://127.0.0.1:11434/v1` (Ollama with OpenAI-compatible API).

## Remote Provider Notes

- Never commit API keys to the repository.
- API keys are stored in `userData/secrets.json`.
- `userData/secrets.json` is ignored by Git but remains plaintext; never upload or paste it into reports.
- Windows users should review the file ACL and restrict access to the intended account. A future OS-keychain integration is recommended.
- The app masks secret values in API responses.

## Error Handling

The HTTP response layer provides structured error payloads:

| Error Code | User Message | Trigger |
|---|---|---|
| `LLM_AUTH_FAILED` | "API Key 无效或没有权限" | HTTP 401/403 |
| `LLM_QUOTA_EXHAUSTED` | "AI 服务额度不足或账号欠费" | HTTP 402 |
| `LLM_RATE_LIMITED` | "AI 服务请求过于频繁" | HTTP 429 |
| `LLM_UPSTREAM_ERROR` | "AI 服务暂时没有正常响应" | HTTP 500+ |
| `LLM_HTTP_ERROR` | "AI 服务返回了无法处理的错误" | Other |

## Testing

Run `POST /api/llm/test` from the UI or API to verify connectivity. All errors produce Chinese user-facing messages.

See also `docs/DEBUGGING_GUIDE.md`.
