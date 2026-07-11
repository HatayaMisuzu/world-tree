import { createSingleInstanceRuntime } from "./single-instance-runtime.js";
import { ensureDir } from "../shared/fs-utils.js";

export { createSingleInstanceRuntime };

/** Listen on the requested port and advance to the next available local port. */
export async function listenOnAvailablePort(server, {
  host = "127.0.0.1",
  port = 3000,
  maxAttempts = 25
} = {}) {
  const firstPort = Number(port);
  if (!Number.isInteger(firstPort) || firstPort < 0 || firstPort > 65535) {
    throw new RangeError(`Invalid port: ${port}`);
  }

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candidate = firstPort === 0 ? 0 : firstPort + attempt;
    if (candidate > 65535) break;
    try {
      const boundPort = await new Promise((resolve, reject) => {
        const onError = (error) => {
          server.off("listening", onListening);
          reject(error);
        };
        const onListening = () => {
          server.off("error", onError);
          resolve(server.address().port);
        };
        server.once("error", onError);
        server.once("listening", onListening);
        server.listen(candidate, host);
      });
      return { port: boundPort, requestedPort: firstPort, usedFallback: firstPort !== 0 && boundPort !== firstPort };
    } catch (error) {
      if (error?.code !== "EADDRINUSE") throw error;
    }
  }
  throw new Error(`No available port found from ${firstPort} after ${maxAttempts} attempts`);
}

/** Acquire the data-root lease, recover state, then start the local HTTP server. */
export async function startSingleInstanceServer({
  server,
  singleInstanceRuntime,
  recoverState,
  directories = [],
  port,
  host,
  listen = listenOnAvailablePort
} = {}) {
  const acquisition = await singleInstanceRuntime.acquire();
  if (acquisition.status !== "acquired") return { acquisition };
  try {
    await recoverState();
    for (const directory of directories) ensureDir(directory);
    const listening = await listen(server, { port, host });
    await singleInstanceRuntime.publish({ port: listening.port });
    let shuttingDown = false;
    const gracefulShutdown = async (exitCode = 0) => {
      if (shuttingDown) return;
      shuttingDown = true;
      const forceExit = setTimeout(() => process.exit(exitCode || 1), 5000);
      forceExit.unref();
      const finish = async () => {
        await singleInstanceRuntime.release().catch(() => {});
        clearTimeout(forceExit);
        process.exit(exitCode);
      };
      if (server.listening) server.close(() => { void finish(); });
      else await finish();
    };
    for (const signal of ["SIGINT", "SIGTERM"]) {
      process.once(signal, () => { void gracefulShutdown(0); });
    }
    return { status: "started", ...listening };
  } catch (error) {
    await singleInstanceRuntime.release().catch(() => {});
    throw error;
  }
}
