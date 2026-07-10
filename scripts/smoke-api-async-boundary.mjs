import { createHttpApiRouter } from "../src/server/http-api-router.js";

const responses = [];
const logs = [];
const originalConsoleError = console.error;
console.error = (...args) => logs.push(args);
const router = createHttpApiRouter({ jsonError: (...args) => responses.push(args) });
try {
  await router.handleAPI(
    { url: "/api/%", method: "GET", headers: { host: "[" } },
    { headersSent: false, writableEnded: false, destroy() {} }
  );
} finally {
  console.error = originalConsoleError;
}
if (responses.length !== 1 || responses[0][1] !== 500 || responses[0][2] !== "INTERNAL_ERROR") {
  throw new Error(`API async boundary failed: ${JSON.stringify(responses)}`);
}
if (logs.length !== 1) throw new Error(`API fatal log missing: ${logs.length}`);
console.log(JSON.stringify({ status: "PASS", responses: responses.length, logs: logs.length, code: responses[0][2] }));
