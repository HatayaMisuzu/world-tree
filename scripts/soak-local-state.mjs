import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { appendJsonl, readJsonSync, readJsonlTail, updateJson, writeJson } from "../src/shared/fs-utils.js";

const root = await mkdtemp(join(tmpdir(), "world-tree-soak-"));
const statePath = join(root, "runtime", "state.json");
const historyPath = join(root, "runtime", "history.jsonl");
const proposalPath = join(root, "runtime", "proposal.json");
const modes = ["world-rpg", "tabletop", "mystery-puzzle", "strategy-sim", "murder-mystery"];
const milestones = new Set([100, 500, 1000]);
const startedHeap = process.memoryUsage().heapUsed;

try {
  await writeJson(statePath, { turnCount: 0, mode: modes[0] });
  for (let turn = 1; turn <= 1000; turn += 1) {
    const mode = modes[(turn - 1) % modes.length];
    await updateJson(statePath, { turnCount: 0 }, (state) => ({ ...state, turnCount: turn, mode, updatedAt: new Date().toISOString() }));
    await appendJsonl(historyPath, { turn, mode, input: `turn-${turn}`, status: "complete" });
    if (turn % 25 === 0) await writeJson(proposalPath, { id: `proposal-${turn}`, status: turn % 50 === 0 ? "confirmed" : "pending", turn });

    if (milestones.has(turn)) {
      const restoreStarted = performance.now();
      const state = readJsonSync(statePath, null);
      const tail = await readJsonlTail(historyPath, 20);
      const restoreMs = performance.now() - restoreStarted;
      if (state?.turnCount !== turn || tail.at(-1)?.turn !== turn) throw new Error(`restore mismatch at turn ${turn}`);
      if (restoreMs > 2000) throw new Error(`restore exceeded 2s at turn ${turn}: ${restoreMs.toFixed(1)}ms`);
      console.log(`[persistence-soak] ${turn} iterations: restore=${restoreMs.toFixed(1)}ms history=${(await stat(historyPath)).size}B`);
    }
  }

  const heapGrowth = process.memoryUsage().heapUsed - startedHeap;
  if (heapGrowth > 128 * 1024 * 1024) throw new Error(`heap growth exceeded 128 MiB: ${heapGrowth}`);
  console.log(`[persistence-soak] PASS: 100/500/1000 local persistence iterations, heap growth ${(heapGrowth / 1024 / 1024).toFixed(1)} MiB`);
} finally {
  await rm(root, { recursive: true, force: true });
}
