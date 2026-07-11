# World Tree release readiness

Current version: `0.5.0-product-experience-rebuild.1`

World Tree is a local-first Web application in strong Beta. The World RPG golden path and selected slices of the other seven entries are playable; this release does not claim full product-wide V2 closure or v1.0 readiness.

## Required verification

- `npm run verify:fast`
- `npm run test:unit`
- `npm run test:integration`
- `npm run verify:browser`
- `npm run release:verify`
- `npm audit`

`npm run smoke:first-play` requires real provider credentials. A `BLOCKED_BY_CREDENTIALS` result must remain visible and must not be reported as a real-LLM pass.

See `docs/PROJECT_TRUTH_SOURCE.md`, `docs/CURRENT_PROJECT_STATE.md`, and `docs/RELEASE_READINESS.md` for the maintained status and evidence boundaries.
