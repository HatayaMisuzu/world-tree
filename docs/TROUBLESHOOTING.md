# Troubleshooting

## Server Does Not Start

Run:

```bash
node --check server.js
npm start
```

If the port is busy, start with another `PORT` value.

## Browser Cannot Load App

Check that the printed URL is local, such as:

```text
http://127.0.0.1:3000
```

World Tree is local-first and should reject non-local origins.

## Creation Forge Delivery Fails

Check the required G1 conditions:

- A plan exists.
- At least one final target is selected.
- Preview has been generated.
- Local folder draft has been generated.
- The browser confirmation was accepted.

Relevant test:

```bash
npm run test:alchemy-closure
```

## Product Closure Looks Incomplete

That is expected in this closure pass. Built-in first-run example content is deferred, and browser/manual smoke is not recorded yet. Use `docs/reports/productization-closure-report.md` for current closure status.
