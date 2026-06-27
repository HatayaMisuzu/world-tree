# test:unit Coverage Reality Check

## Summary

`npm run test:unit` currently uses: **explicit** (48 files manually listed).

- listed files: 48
- actual `tests/unit/*.test.js`: 130
- missing from script: 130 (all 130 unit test files were missing from the explicit list, but the explicit list actually runs only 48)
- nonexistent listed files: 0

## Gloob Trial

```
node --test tests/unit/*.test.js
```

Result: **1049 tests, 0 failures**, 27 suites, 130 files.

## Decision

Glob run passed. Update `package.json` `test:unit` to:

```json
"test:unit": "node --test tests/unit/*.test.js"
```

Do not change `npm test`.
Do not delete `scripts/test.mjs`.
