const FORGE_QUESTIONS = {
  character: ["角色名是什么？", "作品风格/背景是什么？", "用户与角色的关系是什么？"],
  worldbook: ["世界名称？", "核心冲突或主题是什么？", "主要地点有哪些？"],
  tabletop: ["规则轻重？", "检定风格偏好？", "开场场景是什么？"],
  "mystery-puzzle": ["谜题答案是什么？（可选：保护答案锁）", "有哪些关键线索？", "哪些是误导线索？"],
  "strategy-sim": ["玩家阵营是什么？", "对手阵营有哪些？", "胜利目标是什么？"],
  "murder-mystery": ["谁是凶手？", "作案手法是什么？", "作案动机是什么？"],
};

export function createForgeQuestions(intake = {}, options = {}) {
  const targets = intake.detectedTargets || [];
  const questions = [];
  for (const t of targets.slice(0, 2)) {
    for (const q of (FORGE_QUESTIONS[t] || [])) {
      questions.push({ targetType: t, question: q, answered: false, source: "user" });
    }
  }
  return { questions, total: questions.length, skipped: [] };
}

export function answerForgeQuestions(intake = {}, answers = {}, options = {}) {
  const session = createForgeQuestions(intake, options);
  for (const q of session.questions) {
    const key = q.question; const a = answers[key] || answers[q.targetType] || "";
    if (a) { q.answered = true; q.answer = a; } else { session.skipped.push({ question: q.question, reason: "no_answer", source: "ai_inferred" }); }
  }
  return session;
}

export function createQuestioningSummary(session = {}, options = {}) {
  return { total: session.total || 0, answered: (session.questions||[]).filter(q => q.answered).length, skipped: (session.skipped||[]).length };
}
