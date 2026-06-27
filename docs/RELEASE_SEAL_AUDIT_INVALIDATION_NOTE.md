# RELEASE_SEAL_AUDIT_INVALIDATION_NOTE

## Status

The tag `v0.4.0-pre-v2-closure` exists at `0ee1852feb9496755ecc27f722dbe672732c2d65`, but the full local audit found that the tagged state does not satisfy the closure contract.

## What Was Found

- Integration/preflight failed.
- Integration tests mutated real ignored `userData/config.json` and `userData/connections.json` and had a write path to the real secret store.
- Runtime/package version did not match release/tag docs.
- creation-forge persistence policy was contradictory.
- Documentation/gate drift existed.

## Tag Handling

- Old tag moved? No.
- Old tag deleted? No.
- New tag created in this repair? No.

## Required Before Trusted Seal

- P0/P1 repair complete.
- Full tests pass.
- Repository-root userData hashes stay unchanged across tests.
- Release version truth aligned.
- Independent re-audit completed.

## Correct Language

The prior seal tag exists but is audit-invalidated as a trusted final seal. A repaired trusted seal is pending re-audit. Full V2 is not completed.
