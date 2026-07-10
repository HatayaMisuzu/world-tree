import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { collectProjectFacts, validateProjectFacts } from "./lib/project-facts.mjs";

function argument(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || fallback : fallback;
}

const root = process.cwd();
const output = resolve(root, argument("--output", process.env.WT_PROJECT_FACTS_PATH || "output/project-facts.json"));
const checkPath = argument("--check", "");
const facts = collectProjectFacts({ root });
const errors = validateProjectFacts(facts);
if (errors.length) throw new Error(`PROJECT_FACTS_INVALID\n${errors.join("\n")}`);

if (checkPath) {
  const recorded = JSON.parse(readFileSync(resolve(root, checkPath), "utf8"));
  const expected = Object.fromEntries(Object.entries(facts).filter(([key]) => key !== "generatedAt"));
  const checkErrors = validateProjectFacts(recorded, expected);
  if (checkErrors.length) throw new Error(`PROJECT_FACTS_STALE\n${checkErrors.join("\n")}`);
  console.log(`[facts:check] PASS ${resolve(root, checkPath)}`);
} else {
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(facts, null, 2)}\n`, "utf8");
  console.log(`[facts:generate] PASS ${output}`);
}

console.log(JSON.stringify(facts, null, 2));
