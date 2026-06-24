function safe(value, max = 240) { return String(value || "").replace(/\s+/g, " ").trim().slice(0, max); }

export function shouldCreateChapterRecap({ turn = 0, sceneChanged = false } = {}) {
  return sceneChanged === true || (Number(turn) > 0 && Number(turn) % 25 === 0);
}
export function createFallbackChapterRecap({ chapterId = "chapter-1", title = "旅程回顾", startTurn = 1, endTurn = 1, messages = [], currentSituation = "" } = {}) {
  const bounded = (Array.isArray(messages) ? messages : []).slice(-12).map(item => safe(item.content || item.text, 160)).filter(Boolean);
  return { chapterId: safe(chapterId, 80), title: safe(title, 120), startTurn: Number(startTurn || 1), endTurn: Number(endTurn || startTurn || 1), summary: bounded.length ? bounded.slice(-4).join(" / ") : "这一章尚无可回顾的公开事件。", keyEvents: bounded.slice(-5), unresolvedThreads: [], currentSituation: safe(currentSituation || bounded.at(-1) || "等待下一步行动", 240), generatedBy: "deterministic-fallback" };
}
