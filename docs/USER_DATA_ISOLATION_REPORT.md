# USER_DATA_ISOLATION_REPORT

## Purpose

Prove that test/integration/preflight commands no longer mutate real repo-root `userData/`.

## Safety

No secret values or machine-specific hashes are committed in this report. Exact hashes are retained only in ignored local audit files under `audit/pre-v2-blocker-repair/`.

## Files Checked

| File | Before hash | After hash | Changed? |
|---|---|---|---|
| `userData/config.json` | local audit record | local audit record | no after full sequence |
| `userData/connections.json` | local audit record | local audit record | no after full sequence |
| `userData/secrets.json` | local audit record | local audit record | no after full sequence |
| `userData/corrupt-files.jsonl` | local audit record | local audit record | no after full sequence |

## Test UserData Root

- `WORLD_TREE_USER_DATA_DIR`: implemented by `src/server/user-data-root.js`.
- Temporary root: each integration server uses `<temporary dataDir>/.userData`.
- Created files: config, connection and secret test writes are verified inside the temporary root.

## Commands Run

| Command | Result |
|---|---|
| `node --test tests/integration/user-data-isolation.test.js` | PASS |
| `node --test tests/integration/connection-diagnostics.test.js` | PASS |
| `npm run test:integration` | PASS — 117/117 |
| `npm run preflight` | PASS |

## Previous Mutation Notice

The full audit already observed that `userData/config.json` and `userData/connections.json` changed during audit commands. This report does not guess rollback values. A timestamped external backup of the current pre-repair state was created before further tests.

## User Decision Needed

- Restore older values from a user-selected backup, reconfigure manually, or accept the current local values.
- The repair does not choose among those recovery options.

## Conclusion

The complete mandated validation sequence left all four real repository-root `userData/` files byte-for-byte unchanged from the timestamped pre-test backup. Test servers now isolate mutable state under their temporary data directories.
