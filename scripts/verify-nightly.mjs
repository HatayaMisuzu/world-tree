import { spawnSync } from "node:child_process";

function runNpm(script) {
  const result = spawnSync("npm", ["run", script], {
    cwd: process.cwd(),
    env: process.env,
    encoding: "utf8",
    shell: process.platform === "win32",
    stdio: "inherit"
  });
  if (result.status !== 0) process.exit(result.status || 1);
}

runNpm("verify:release");
runNpm("narrative:eval");

const hasCredentials = Boolean(
  process.env.WT_SMOKE_API_KEY ||
  process.env.WORLD_TREE_API_KEY ||
  process.env.DEEPSEEK_API_KEY ||
  process.env.OPENAI_API_KEY
);

if (hasCredentials) {
  runNpm("smoke:first-play");
  runNpm("smoke:user-content-real-llm");
} else {
  console.log("[verify:nightly] BLOCKED_BY_CREDENTIALS: real LLM smoke skipped; automated gates remain valid.");
}
