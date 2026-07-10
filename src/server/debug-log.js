export function createDebugLogger({ enabled = false, buffer = [], max = 200 } = {}) {
  return function debugLog(category, message, data = null) {
    if (!enabled) return;
    const entry = {
      ts: new Date().toISOString(),
      category,
      message,
      ...(data ? { data: typeof data === "object" ? JSON.stringify(data).slice(0, 500) : String(data).slice(0, 500) } : {})
    };
    buffer.push(entry);
    if (buffer.length > max) buffer.shift();
    console.log(`[${category}] ${message}`);
  };
}
