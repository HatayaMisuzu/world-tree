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
