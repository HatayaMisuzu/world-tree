// World Telemetry data extractor.
// Pure read-only adapter: derives narrative KPI input from existing model/state objects.

export function extractTelemetryData({ model = {}, engineState = {}, directorResult = null, overlayPatch = null } = {}) {
  const moduleData = model.moduleData || {};
  const worldState = moduleData.worldState || moduleData.runtime?.worldState || {};
  const relations = collectRelations(moduleData);
  const tracking = Array.isArray(moduleData.tracking) ? moduleData.tracking : [];
  const scenes = Array.isArray(moduleData.scenes) ? moduleData.scenes : [];
  const characters = Array.isArray(moduleData.characters) ? moduleData.characters : [];
  const organizations = Array.isArray(moduleData.organizations) ? moduleData.organizations : [];
  const timeline = Array.isArray(moduleData.timeline) ? moduleData.timeline : [];
  const canon = moduleData.canon || {};
  const rules = Array.isArray(moduleData.rules) ? moduleData.rules : [];
  const emotion = directorResult?.emotion?.state || engineState.emotionState || {};

  const hostileRelations = relations.filter(isHostileRelation).length;
  const totalRelations = relations.length;
  const unresolvedForeshadowing = countTracking(tracking, ["foreshadowing", "伏笔", "clue", "mystery"]);
  const resolvedThreads = countTracking(tracking, ["resolved", "已解决", "closed"]);
  const unresolvedEvents = countUnresolvedEvents(moduleData, overlayPatch);
  const sceneSwitchRate = Number(Boolean(engineState.lastSceneChanged || overlayPatch?.sceneSummary?.changed || overlayPatch?.proximity?.sceneChanged));
  const randomEventCount = countRandomEvents(moduleData, overlayPatch);
  const activeObjectives = countTracking(tracking, ["objective", "目标", "quest", "任务"]);
  const activeThreads = countTracking(tracking, ["thread", "线索", "foreshadowing", "伏笔"]);
  const keyEvents = countTracking(tracking, ["event", "事件"]) + randomEventCount;
  const recentFacts = countFacts(canon) + countWorldbook(moduleData.worldbook);
  const expectedRules = Math.max(5, rules.length || 0, Object.keys(canon || {}).length || 0);
  const confirmedRules = countConfirmedRules(canon, rules);
  const factionTension = estimateFactionTension({ organizations, relations, hostileRelations });

  return {
    conflictIntensity: normalizeConflict(worldState, moduleData, hostileRelations, unresolvedEvents),
    unresolvedEvents,
    eventDensity: Math.min(2, (randomEventCount + unresolvedEvents) / 5),
    sceneSwitchRate,
    unresolvedForeshadowing,
    unknownClues: Math.max(0, activeThreads - resolvedThreads),
    hostileRelations,
    factionTension,
    totalRelations,
    fearAvg: scaleEmotion(emotion.fear ?? emotion.tension),
    fatigueAvg: scaleEmotion(emotion.fatigue),
    angerAvg: scaleEmotion(emotion.anger),
    sadnessAvg: scaleEmotion(emotion.sadness),
    crisisCount: countCrisis(characters, overlayPatch),
    expectedRules,
    confirmedRules,
    activeObjectives,
    openConflicts: unresolvedEvents + hostileRelations,
    unfinishedScenes: Math.max(0, scenes.length - resolvedThreads),
    recentFacts,
    activeThreads,
    keyEvents,
    memoryCapacity: 80,
    socialUnrest: countByWords(moduleData, ["unrest", "riot", "动乱", "暴乱", "抗议"]),
    crimeEvents: countByWords(moduleData, ["crime", "murder", "盗窃", "谋杀", "犯罪"]),
    relationChanges: countByWords(moduleData, ["关系变化", "relationship", "relation"]),
    emotionalEvents: countByWords(moduleData, ["情绪", "emotion", "confession", "争吵"]),
    positiveEvents: countByWords(moduleData, ["hope", "希望", "治愈", "成长", "胜利"]),
    characterGrowth: countByWords(moduleData, ["growth", "成长", "突破", "觉醒"])
  };
}

export function telemetryWorldName(model = {}) {
  return String(model.selected?.id || model.selected?.name || model.moduleKey || model.name || "_default");
}

function collectRelations(moduleData = {}) {
  const direct = moduleData.relations || moduleData.relationships || moduleData.factions?.relations || [];
  const fromOrgs = (moduleData.organizations || []).flatMap((org) => org.relations || org.relationships || []);
  return [...asArray(direct), ...asArray(fromOrgs)];
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function isHostileRelation(rel = {}) {
  const text = JSON.stringify(rel).toLowerCase();
  return /hostile|enemy|war|rival|敌对|敌人|战争|冲突|仇恨/.test(text);
}

function countTracking(tracking = [], names = []) {
  let total = 0;
  for (const item of tracking) {
    const label = String(item.name || item.type || item.title || "").toLowerCase();
    if (names.some((n) => label.includes(String(n).toLowerCase()))) {
      if (Array.isArray(item.items)) total += item.items.length;
      else if (typeof item.count === "number") total += item.count;
      else total += 1;
    }
  }
  return total;
}

function countUnresolvedEvents(moduleData = {}, overlayPatch = null) {
  const tracking = countTracking(moduleData.tracking || [], ["unresolved", "open", "未解决", "冲突", "conflict"]);
  const predictions = Array.isArray(moduleData.predictions) ? moduleData.predictions.length : 0;
  const activeConflict = moduleData.plotState?.conflict || moduleData.worldState?.conflict ? 1 : 0;
  const overlayEvent = overlayPatch?.randomEvent ? 1 : 0;
  return tracking + predictions + activeConflict + overlayEvent;
}

function countRandomEvents(moduleData = {}, overlayPatch = null) {
  const dataEvents = asArray(moduleData.randomEvents).length + asArray(moduleData.recentEvents).length;
  return dataEvents + (overlayPatch?.randomEvent ? 1 : 0);
}

function countFacts(canon = {}) {
  if (!canon || typeof canon !== "object") return 0;
  let total = 0;
  for (const value of Object.values(canon)) {
    if (Array.isArray(value)) total += value.length;
    else if (value && typeof value === "object") total += Object.keys(value).length;
    else if (value) total += 1;
  }
  return total;
}

function countWorldbook(worldbook = {}) {
  return asArray(worldbook.entries).length;
}

function countConfirmedRules(canon = {}, rules = []) {
  const canonRules = countByWords(canon, ["rule", "规则", "canon", "confirmed"]);
  return Math.max(canonRules, rules.length || 0, countFacts(canon));
}

function estimateFactionTension({ organizations = [], relations = [], hostileRelations = 0 }) {
  const orgTension = organizations.reduce((sum, org) => {
    const raw = org.tension ?? org.internalStability ?? org.stability ?? 0;
    const value = Number(raw);
    if (!Number.isFinite(value)) return sum;
    return sum + (value <= 10 ? value : value / 10);
  }, 0);
  return Math.min(6, hostileRelations * 0.5 + orgTension / Math.max(1, organizations.length || relations.length || 1));
}

function normalizeConflict(worldState = {}, moduleData = {}, hostileRelations = 0, unresolvedEvents = 0) {
  const raw = worldState.conflictIntensity ?? worldState.conflict ?? moduleData.plotState?.conflictIntensity;
  if (typeof raw === "number") return raw <= 10 ? raw : raw / 10;
  if (raw) return 2;
  return Math.min(4, hostileRelations * 0.3 + unresolvedEvents * 0.4);
}

function scaleEmotion(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return 0;
  return n <= 10 ? n * 10 : Math.min(100, n);
}

function countCrisis(characters = [], overlayPatch = null) {
  const charCrisis = characters.filter((c) => /injured|危机|受伤|昏迷|濒死|panic|fear/.test(JSON.stringify(c).toLowerCase())).length;
  return charCrisis + (overlayPatch?.randomEvent?.level === "major" ? 1 : 0);
}

function countByWords(value, words = []) {
  const text = JSON.stringify(value || {}).toLowerCase();
  return words.reduce((sum, word) => {
    const escaped = String(word).toLowerCase().replace(/[.*+?^\x24{}()|[\]\\]/g, "\\$&");
    return sum + (text.match(new RegExp(escaped, "g")) || []).length;
  }, 0);
}
