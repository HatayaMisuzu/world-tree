# Living World Kernel P0

P0 adds a bounded, proposal-safe living-world context layer without changing the UI or replacing legacy engines.

Runtime flow:

```text
scene session -> scene summary chain -> tracking -> world state
-> bounded ripple -> proximity scope -> worldbook trigger
-> living world packet -> existing context/module runtime
```

Canonical world-state changes require an approved proposal. Scene summaries, proximity scope, activations, tracking digests, and ripple suggestions are runtime data. Ripple derivation is non-recursive, limited to three depths and three items per depth; depth two requires approval and depth three is narrative-only.

`quick-setting` and `creation-forge` do not receive the full packet by default. Mystery-facing worldbook activation removes hidden-truth fields before producing prompt-safe entries.
