import { spawn } from "node:child_process";

const requestedPort = process.env.PORT || "3000";
const probeOnly = process.env.WORLD_TREE_LAUNCHER_PROBE_ONLY === "1";
const child = spawn(process.execPath, ["server.js"], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: requestedPort },
  stdio: ["inherit", "pipe", "pipe"]
});

let browserStarted = false;
let probeFinished = false;

function finishProbe(url) {
  if (!probeOnly || probeFinished) return;
  probeFinished = true;
  console.log(`WORLD_TREE_LAUNCHER_PROBE_URL=${url}`);
  if (child.exitCode === null) child.kill("SIGTERM");
}

async function waitForHealth(baseUrl, attempts = 40) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return true;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

function openBrowser(url) {
  if (process.env.WORLD_TREE_NO_BROWSER === "1") return;
  const command = process.platform === "win32" ? "powershell.exe" : process.platform === "darwin" ? "open" : "xdg-open";
  const args = process.platform === "win32"
    ? ["-NoProfile", "-NonInteractive", "-Command", `Start-Process '${url.replaceAll("'", "''")}'`]
    : [url];
  const opener = spawn(command, args, { detached: true, stdio: "ignore" });
  opener.on("error", (error) => console.warn(`[launcher] 无法自动打开浏览器：${error.message}`));
  opener.unref();
}

child.stdout.on("data", (chunk) => {
  const text = chunk.toString("utf8");
  process.stdout.write(text);
  const existing = text.match(/WORLD_TREE_EXISTING_INSTANCE_URL=(http:\/\/[^\s]+)/);
  if (existing) {
    if (probeOnly) finishProbe(existing[1]);
    else openBrowser(existing[1]);
  }
  const match = text.match(/URL:\s+(http:\/\/[^\s]+)/);
  if (!browserStarted && match) {
    browserStarted = true;
    void waitForHealth(match[1]).then((healthy) => {
      if (healthy && probeOnly) finishProbe(match[1]);
      else if (healthy) openBrowser(match[1]);
      else console.warn(`[launcher] 服务未在预期时间内通过健康检查：${match[1]}`);
    });
  }
});
child.stderr.pipe(process.stderr);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    if (child.exitCode === null) child.kill(signal);
  });
}

child.on("exit", (code, signal) => {
  if (signal) process.exitCode = probeFinished ? 0 : 1;
  else process.exitCode = code ?? 1;
});
