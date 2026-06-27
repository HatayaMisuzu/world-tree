import { once } from "node:events";
import { mkdtemp, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";

export async function createTempDataDir(prefix = "world-tree-data-") {
  return await mkdtemp(join(tmpdir(), prefix));
}

export async function removeTempDir(dir) {
  if (dir) await rm(dir, { recursive: true, force: true });
}

export function randomPort() {
  return 3100 + Math.floor(Math.random() * 20000);
}

export async function startWorldTreeServer({ port = randomPort(), dataDir, userDataDir = join(dataDir, ".userData"), env = {} } = {}) {
  const root = resolve(".");
  // Isolate userData: when dataDir is provided (test mode), auto-create a temp userData dir
  let userDataDir = undefined;
  if (dataDir) {
    userDataDir = join(dataDir, "..", ".userData");
    await mkdir(userDataDir, { recursive: true });
  }
  const child = spawn(process.execPath, ["server.js"], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port),
      WORLD_TREE_HOST: "127.0.0.1",
      WORLD_TREE_DATA_DIR: dataDir,
      WORLD_TREE_USER_DATA_DIR: userDataDir,
      WORLD_TREE_DISABLE_UPDATE_CHECK: "1",
      NODE_ENV: "test",
      ...env
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  let stdout = "";
  let stderr = "";

  child.stdout.on("data", (chunk) => {
    stdout += chunk.toString("utf8");
  });

  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString("utf8");
  });

  const ready = new Promise((resolveReady, rejectReady) => {
    const timer = setTimeout(() => {
      rejectReady(new Error(`server did not start in time\nstdout:\n${stdout}\nstderr:\n${stderr}`));
    }, 8000);

    child.stdout.on("data", () => {
      if (stdout.includes("World Tree Web 服务启动")) {
        clearTimeout(timer);
        resolveReady();
      }
    });

    child.once("exit", (code) => {
      clearTimeout(timer);
      rejectReady(new Error(`server exited before ready: ${code}\nstdout:\n${stdout}\nstderr:\n${stderr}`));
    });
  });

  await ready;

  return {
    port,
    baseUrl: `http://127.0.0.1:${port}`,
    dataDir,
    userDataDir,
    child,
    stdout: () => stdout,
    stderr: () => stderr,
    async stop() {
      if (child.exitCode !== null) return;
      child.kill("SIGTERM");
      try {
        await Promise.race([
          once(child, "exit"),
          new Promise((resolve) => setTimeout(resolve, 1500))
        ]);
      } finally {
        if (child.exitCode === null) child.kill("SIGKILL");
      }
    }
  };
}

export async function api(server, path, options = {}) {
  const url = `${server.baseUrl}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }

  return {
    response,
    status: response.status,
    ok: response.ok,
    body
  };
}
