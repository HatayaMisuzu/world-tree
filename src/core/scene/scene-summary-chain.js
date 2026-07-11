import { join } from "node:path";
import { appendJsonl, readJsonlTail, readJson, writeJson } from "../../shared/fs-utils.js";

const currentScenePath = (root) => join(root, "runtime", "current-scene.json");
const summariesPath = (root) => join(root, "runtime", "scene-summaries.jsonl");

export function createDeterministicSceneSummary(scene = {}, context = {}) {
  const events = (context.events || []).slice(0, 3).map((item) => item.summary || item.text || item.reason).filter(Boolean);
  const changes = (context.changes || []).slice(0, 3).map((item) => ({ type: item.changeType || item.type || "event", text: item.reason || item.summary || "状态发生变化", trackingRef: item.id || null }));
  const summary = events.length ? events.join("；") : `${scene.title || "本场景"}告一段落。`;
  return {
    id: context.id || `ss_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    modeId: scene.modeId || context.modeId || "",
    sceneId: scene.sceneId || scene.id || "",
    title: scene.title || "未命名场景",
    startedAt: scene.startedAt || null,
    endedAt: context.endedAt || new Date().toISOString(),
    locationId: scene.locationId || "",
    participants: Array.isArray(scene.participants) ? scene.participants : [],
    summary: String(context.summary || summary).slice(0, 800),
    keyChanges: changes,
    unresolvedHooks: Array.isArray(context.unresolvedHooks) ? context.unresolvedHooks.slice(0, 5) : [],
    carryToNextScene: Array.isArray(context.carryToNextScene) ? context.carryToNextScene.slice(0, 5) : []
  };
}

export async function readCurrentScene(projectRoot) {
  return readJson(currentScenePath(projectRoot), null);
}

export async function readRecentSceneSummaries(projectRoot, limit = 3) {
  return readJsonlTail(summariesPath(projectRoot), Math.max(1, Math.min(20, limit)));
}

export async function transitionScene(projectRoot, nextScene = {}, context = {}) {
  const current = await readCurrentScene(projectRoot);
  let summary = null;
  if (current && (current.sceneId || current.id) !== (nextScene.sceneId || nextScene.id)) {
    summary = createDeterministicSceneSummary(current, context);
    await appendJsonl(summariesPath(projectRoot), summary);
  }
  const normalized = { version: 1, ...nextScene, sceneId: nextScene.sceneId || nextScene.id || `scene_${Date.now()}`, startedAt: nextScene.startedAt || new Date().toISOString() };
  await writeJson(currentScenePath(projectRoot), normalized);
  return { currentScene: normalized, summary };
}
