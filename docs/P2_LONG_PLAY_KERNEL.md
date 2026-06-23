# P2 Long Play Kernel

P2 adds long-play adapters above P0/P1 without replacing the fixed mode map, proposal bus, save system, or legacy engines.

- World profiles compose registered modules as `base + profile + user enabled - disabled`.
- Branch save trees copy and isolate `shared/` and `runtime/` under one active `branches/<id>/` root. No merge API is exposed.
- World Telemetry reads branch-local P0/P1 records and writes only its own enum digest.
- Auto-light recognizes continue intent, advances at most one beat, and stops for choices, critical proposals, critical telemetry, hidden truth, or disallowed modes.
- Processing preserves material source metadata and delivers candidates only to the Growth Tree or proposal queue. Conflicts enter P0 tracking and never overwrite canon.

Callers resolve the active branch root first, then pass that root to P0/P1/P2 services. This keeps shared state, runtime, proposals, tracking, scene summaries, telemetry, and processing data isolated by branch.

## Runtime integration status

The server uses the active branch root for persisted chat/state and Kernel hooks once a branch tree exists. The console exposes branch create/switch (and the API additionally exposes archive/diff), enum-only telemetry refresh, one-request Auto-light preview, and candidate-only material processing. There is deliberately no merge endpoint or repeated autonomous advance loop.
