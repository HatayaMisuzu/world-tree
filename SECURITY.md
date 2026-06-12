# Security Policy

World Tree is a local-first, single-user tool. It is designed to listen on localhost and store user data on the same machine.

## Threat Model

- Run the server only on your own machine.
- Do not bind it to `0.0.0.0`.
- Do not expose it through a public reverse proxy.
- Do not run it on a shared host where other users should not read your files.

The API rejects non-local browser origins and rate-limits local requests, but those protections are not a substitute for network isolation.

## Secrets

LLM keys are stored in `userData/secrets.json` as local plaintext. This is intentional and honest: local encryption would still need a local decryption key, so it would not protect against malware or another process running as the same OS user.

Use normal filesystem permissions to protect the project folder. On Unix-like systems, you can restrict the secrets file after it is created:

```bash
chmod 600 userData/secrets.json
```

Future work may integrate OS keychains such as macOS Keychain or Windows Credential Manager.

## Reporting

For now, report vulnerabilities privately through the repository owner before public disclosure. Once the project is on GitHub, prefer GitHub Security Advisories.
