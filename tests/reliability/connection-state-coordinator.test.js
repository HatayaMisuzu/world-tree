import test from "node:test";
import assert from "node:assert/strict";
import { chmod, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createConfigRuntime } from "../../src/server/config-runtime.js";
import { createConnectionRuntime } from "../../src/server/connection-runtime.js";
import { readJson, readJsonSync, updateJson, writeJson } from "../../src/shared/fs-utils.js";
import { createJsonFileTransaction } from "../../src/server/transactions/json-file-transaction.js";

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

test("config patches and connection transactions share one read-modify-write coordinator", async () => {
  const root = await mkdtemp(join(tmpdir(), "world-tree-state-coordinator-"));
  const userDataPath = (...segments) => join(root, "userData", ...segments);
  const planReached = deferred();
  const allowCommit = deferred();
  const coordinator = createJsonFileTransaction({
    journalPath: userDataPath(".transactions", "connection-state.json"),
    faultInjector: async (stage) => {
      if (stage !== "after-plan") return;
      planReached.resolve();
      await allowCommit.promise;
    }
  });
  const configRuntime = createConfigRuntime({
    ROOT: root,
    DATA_ROOT_OVERRIDE: root,
    join,
    userDataPath,
    readJson,
    writeJson,
    updateJson,
    stateCoordinator: coordinator,
    chmod,
    buildOpenAICompatibleChatBody: () => ({}),
    llmHttpError: () => ({}),
    errorPayload: () => ({})
  });
  const connectionsPath = userDataPath("connections.json");
  const connectionRuntime = createConnectionRuntime({
    readJsonSync,
    CONNECTIONS_PATH: () => connectionsPath,
    loadConfig: configRuntime.loadConfig,
    configPath: configRuntime.configPath,
    loadSecrets: configRuntime.loadSecrets,
    secretsPath: configRuntime.secretsPath,
    maskSecret: configRuntime.maskSecret,
    loadPipelineProfiles: () => [],
    errorPayload: () => ({}),
    llmProbeMessages: () => [],
    strictProbeFailure: () => null,
    LLM_CONNECTION_SENTINEL: "ok",
    mapLlmError: () => ({}),
    llmHttpError: () => ({}),
    parseChatCompletionProbe: () => ({}),
    partialProbeResult: () => ({}),
    buildOpenAICompatibleChatBody: () => ({}),
    slugName: (value) => String(value).replace(/[^\w-]/g, "-").replace(/-+/g, "-"),
    connectionStateTransaction: coordinator
  });

  try {
    await configRuntime.saveConfig({ theme: "dark", language: "zh-CN" });
    const connectionWrite = connectionRuntime.handleConnections({
      setDefault: true,
      profile: { id: "new-profile", label: "New Profile", provider: "mock", baseUrl: "mock://local", model: "mock-model" }
    }, "POST");
    let connectionError = null;
    void connectionWrite.catch((error) => { connectionError = error; planReached.resolve(); });
    await planReached.promise;
    if (connectionError) throw connectionError;
    const concurrentPatch = configRuntime.saveConfig({ theme: "light", language: "en-US" });
    allowCommit.resolve();
    await Promise.all([connectionWrite, concurrentPatch]);

    const config = await configRuntime.loadConfig();
    assert.equal(config.connectionProfileId, "new-profile");
    assert.equal(config.theme, "light");
    assert.equal(config.language, "en-US");

    await Promise.all([
      configRuntime.saveConfig({ theme: "dark" }),
      connectionRuntime.handleConnections({ action: "setDefault", id: "new-profile" }, "POST")
    ]);
    const reverseOrder = await configRuntime.loadConfig();
    assert.equal(reverseOrder.connectionProfileId, "new-profile");
    assert.equal(reverseOrder.theme, "dark");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
