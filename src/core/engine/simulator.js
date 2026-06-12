// ===== 叙事模拟运行器 v1 =====
// 仅调试/测试时启用。记录每轮完整数据流：输入→情绪→记忆→节奏→评分→缓存→事件→输出→写入。
// 正常游玩时不可访问——无 slash 命令、无 UI 入口。
//
// 激活方式（仅限外部 AI agent）：
//   fs.writeFileSync('data/engine/simulate/.active', JSON.stringify({active: true}))
//   或通过 main.cjs IPC 写入配置
//   或调用 setSimulate(true/false)（编程式，仅 agent 上下文）
//
// 引擎每轮自动检查标记文件或内存状态。

const SIM_STORE = { active: false, runs: [], maxRuns: 50 };

// 🆕 v0.7.4.1 数据归家
export const SIMULATE_PATH = "data/engine/simulate";

// ---- 开关控制（仅从外部 agent 或 IPC 调用） ----

export function setSimulate(on) {
  SIM_STORE.active = !!on;
  if (on) SIM_STORE.runs = [];
  return SIM_STORE.active;
}

export function isSimulateActive() {
  return SIM_STORE.active;
}

export function getSimulateStatus() {
  return {
    active: SIM_STORE.active,
    runs: SIM_STORE.runs.length,
    maxRuns: SIM_STORE.maxRuns,
    lastRun: SIM_STORE.runs.length ? SIM_STORE.runs[SIM_STORE.runs.length - 1].timestamp : null
  };
}

export function clearSimulateRuns() {
  SIM_STORE.runs = [];
}

// ---- 每轮记录 ----

/**
 * 记录一轮的完整数据流
 * @param {Object} snap
 * @param {string} snap.input
 * @param {Object} snap.emotionBefore
 * @param {Object} snap.emotionAfter
 * @param {Object} snap.emotionProfile
 * @param {Array} snap.memories
 * @param {Object} snap.pacing
 * @param {Object} snap.eventAssessment
 * @param {Object} snap.triggerResult
 * @param {Object} snap.cacheState
 * @param {number} snap.promptTokens
 * @param {string} snap.llmResponse
 * @param {Array} snap.overlayPaths
 * @param {number} snap.round
 * @param {string} snap.scene
 * @returns {Object}
 */
export function recordSimulationRun(snap = {}) {
  if (!SIM_STORE.active) return null;

  const run = {
    id: `sim-${SIM_STORE.runs.length + 1}`,
    timestamp: new Date().toISOString(),
    round: snap.round || 0,
    scene: snap.scene || "",
    input: (snap.input || "").slice(0, 200),
    emotion: {
      before: snap.emotionBefore ? { ...snap.emotionBefore } : null,
      after: snap.emotionAfter ? { ...snap.emotionAfter } : null,
      profile: snap.emotionProfile ? {
        dominant: snap.emotionProfile.dominant,
        adviceCount: (snap.emotionProfile.advice || []).length
      } : null
    },
    memory: {
      hits: (snap.memories || []).length,
      topScore: snap.memories?.[0]?._score || 0
    },
    pacing: snap.pacing ? {
      tempo: snap.pacing.tempo,
      blockNewEvents: snap.pacing.blockNewEvents,
      adviceCount: (snap.pacing.advices || []).length
    } : null,
    event: snap.eventAssessment ? {
      method: snap.eventAssessment.method,
      type: snap.eventAssessment.type,
      score: snap.eventAssessment.score,
      coreScore: snap.eventAssessment.coreScore,
      ambientScore: snap.eventAssessment.ambientScore,
      reason: snap.eventAssessment.reason
    } : null,
    trigger: snap.triggerResult ? {
      triggered: snap.triggerResult.trigger,
      method: snap.triggerResult.method
    } : null,
    cache: snap.cacheState ? {
      pending: snap.cacheState.pending,
      total: snap.cacheState.size,
      maxSize: snap.cacheState.maxSize
    } : null,
    prompt: { estimatedTokens: snap.promptTokens || 0 },
    llm: { responsePreview: (snap.llmResponse || "").slice(0, 200) },
    overlay: { files: (snap.overlayPaths || []).slice(0, 10) }
  };

  SIM_STORE.runs.push(run);
  if (SIM_STORE.runs.length > SIM_STORE.maxRuns) {
    SIM_STORE.runs = SIM_STORE.runs.slice(-SIM_STORE.maxRuns);
  }
  return run;
}

// ---- 格式化输出 ----

export function formatLastRun(index = 0) {
  if (!SIM_STORE.runs.length) return "尚无模拟记录。";
  const run = SIM_STORE.runs[SIM_STORE.runs.length - 1 - index];
  if (!run) return `无第 ${index + 1} 条记录。共 ${SIM_STORE.runs.length} 条。`;

  return [
    `═══ 模拟运行 #${run.id} ═══`,
    `轮次: ${run.round} | 场景: ${run.scene} | ${run.timestamp}`,
    `输入: ${run.input}`,
    "",
    "── 情绪状态 ──",
    run.emotion.before ? `  更新前: e=${run.emotion.before.engagement} t=${run.emotion.before.tension} f=${run.emotion.before.fatigue} c=${run.emotion.before.curiosity}` : "",
    run.emotion.after ? `  更新后: e=${run.emotion.after.engagement} t=${run.emotion.after.tension} f=${run.emotion.after.fatigue} c=${run.emotion.after.curiosity}` : "",
    run.emotion.profile ? `  画像: [${run.emotion.profile.dominant.join(", ") || "中性"}] ${run.emotion.profile.adviceCount}条建议` : "",
    "",
    "── 全局记忆 ──",
    `  检索命中: ${run.memory.hits} 条, 最高分: ${run.memory.topScore}`,
    "",
    "── 节奏分析 ──",
    `  节奏: ${run.pacing?.tempo} | 阻止新事件: ${run.pacing?.blockNewEvents} | 建议: ${run.pacing?.adviceCount}条`,
    "",
    "── 事件评分 ──",
    `  方法: ${run.event?.method} | 类型: ${run.event?.type} | 总分: ${run.event?.score}`,
    `  核心分: ${run.event?.coreScore} | 环境分: ${run.event?.ambientScore}`,
    run.event?.reason ? `  原因: ${run.event.reason}` : "",
    "",
    "── 触发决策 ──",
    `  触发: ${run.trigger?.triggered ? "✅" : "❌"} | 方式: ${run.trigger?.method}`,
    "",
    "── 事件缓存 ──",
    `  待触发: ${run.cache?.pending || 0}/${run.cache?.total || 0} (上限${run.cache?.maxSize || 5})`,
    "",
    "── prompt / LLM ──",
    `  估算tokens: ${run.prompt.estimatedTokens}`,
    `  LLM回复预览: ${run.llm.responsePreview}`,
    "",
    "── overlay 写入 ──",
    `  文件数: ${run.overlay.files.length}`,
    ...run.overlay.files.map(f => `  ${f}`),
    "",
    "═══ 结束 ═══"
  ].filter(Boolean).join("\n");
}

export function formatSimulateSummary(n = 5) {
  if (!SIM_STORE.runs.length) return "尚无模拟记录。";
  const recent = SIM_STORE.runs.slice(-n);
  const lines = [`最近 ${recent.length} 轮模拟概要:`];
  for (const run of recent) {
    const e = run.emotion?.after;
    const emoji = run.trigger?.triggered ? "⚡" : "·";
    lines.push(
      `  ${emoji} #${run.round} [${run.scene}] ` +
      `情绪(e=${e?.engagement} t=${e?.tension} f=${e?.fatigue} c=${e?.curiosity}) ` +
      `事件(${run.event?.method}/${run.event?.type}/${run.event?.score}) ` +
      `触发=${run.trigger?.triggered ? "✅" : "❌"} ` +
      `缓存=${run.cache?.pending || 0}`
    );
  }
  return lines.join("\n");
}

// ---- 序列化 ----

export function serializeSimulateRuns() {
  return { runs: SIM_STORE.runs.slice(-20), version: 1 };
}
