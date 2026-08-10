import { readFileSync } from "node:fs";

const COMMIT_EVENTS = new Set(["push", "schedule", "workflow_dispatch"]);

export function readGithubEvent(path) {
  if (!path) return {};
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return {};
  }
}

export function resolveCiIdentity(env = process.env, event = {}) {
  const eventName = String(env.GITHUB_EVENT_NAME || event.action || "unknown");
  const testedSha = String(env.GITHUB_SHA || "").trim();
  if (!testedSha) throw new Error("GITHUB_SHA is required to identify the tested commit");

  if (eventName === "pull_request") {
    const headSha = String(event.pull_request?.head?.sha || "").trim();
    const baseSha = String(event.pull_request?.base?.sha || "").trim();
    if (!headSha || !baseSha) throw new Error("pull_request evidence requires head and base SHA values from GITHUB_EVENT_PATH");
    return { eventName, testedSha, headSha, baseSha, testSubject: "PR_MERGE_COMMIT" };
  }

  if (!COMMIT_EVENTS.has(eventName)) {
    throw new Error(`unsupported GitHub Actions event for exact-SHA evidence: ${eventName}`);
  }
  return { eventName, testedSha, headSha: testedSha, baseSha: "", testSubject: "COMMIT" };
}

export function buildCiEvidence({ env = process.env, event = {}, jobs = {}, commands = [] } = {}) {
  const identity = resolveCiIdentity(env, event);
  return {
    schemaVersion: 2,
    ...identity,
    workflowRunId: String(env.GITHUB_RUN_ID || ""),
    workflowRunAttempt: String(env.GITHUB_RUN_ATTEMPT || ""),
    workflow: String(env.GITHUB_WORKFLOW || ""),
    jobs,
    commands,
    result: "PASS_REMOTE_EXACT_TESTED_SHA",
    generatedAt: new Date().toISOString()
  };
}

export function ciEvidenceArtifactName(evidence) {
  const headSuffix = evidence.testSubject === "PR_MERGE_COMMIT" ? `-head-${evidence.headSha}` : "";
  return `world-tree-ci-evidence-tested-${evidence.testedSha}${headSuffix}`;
}
