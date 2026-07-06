# Security Policy

World Tree is a local-first, single-user tool. It is designed to listen on localhost and store user data on the same machine.

## Threat Model

- Run the server only on your own machine.
- Do not bind it to `0.0.0.0`.
- Do not expose it through a public reverse proxy.
- Do not run it on a shared host where other users should not read your files.

The API enforces local-only access through multi-layer checks:

1. **Remote address**: Only loopback addresses (127.0.0.1, ::1, ::ffff:127.0.0.1) are accepted.
2. **Host header**: Must be localhost, 127.0.0.1, ::1, or [::1].
3. **Origin/Referer**: Non-local origins receive 403 Forbidden with no CORS headers set — the server never reflects an attacker's origin.
4. **OPTIONS preflight**: Also passes through the same local-only check before responding.
5. **Rate limiting**: Separate limits for static files and API endpoints.
6. **Request body limits**: Default 20MB, with Content-Length pre-check and JSON validation errors (400 INVALID_JSON instead of silent empty objects).
7. **LLM timeout**: All outbound LLM requests have configurable timeout (default 60s) via AbortSignal, preventing hung connections from locking the frontend.

These protections are defense-in-depth for a local-first tool, but they are not a substitute for network isolation.

## Secrets

LLM keys are stored in `userData/secrets.json` as local plaintext. This is intentional and honest: local encryption would still need a local decryption key, so it would not protect against malware or another process running as the same OS user.

Do not sync `userData/` with cloud drives, public backups, Git repositories, or shared folders. Treat `userData/secrets.json` as a local-only credential file.

**ACL risk**: On multi-user systems, any process running as the same OS user can read `userData/secrets.json`. Protect the project directory with OS-level access controls:
- **Windows**: Store the project under your user profile directory; avoid shared directories. The app skips POSIX mode changes on Windows.
- **Unix-like systems**: The app attempts to set `userData/secrets.json` to `0o600` after writing. You can also verify or repair it manually:
  ```bash
  chmod 600 userData/secrets.json
  ```

Future work may integrate OS keychains such as macOS Keychain or Windows Credential Manager.

## Reporting

For now, report vulnerabilities privately through the repository owner before public disclosure. Once the project is on GitHub, prefer GitHub Security Advisories.
