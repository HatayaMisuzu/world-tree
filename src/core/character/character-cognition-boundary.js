// Character Capsule V2 — Companion Common-Sense Cognition Model
// Pure functions only. No I/O. No persistence. No LLM calls.

const DAILY_COMMON = ["微信", "手机", "拍照", "视频", "聊天记录", "外卖", "地铁", "网购", "社交账号", "朋友圈", "表情包"];
const PUBLIC_COMMON = ["长城", "北京", "上海", "东京", "巴黎", "中国", "日本", "美国", "丰田", "本田", "奔驰", "宝马", "特斯拉", "奥运会", "麦当劳", "可口可乐"];
const META_TECHNICAL = ["deepseek", "chatgpt", "llm", "大模型", "prompt", "提示词", "token", "api", "模块", "后端", "训练数据", "系统提示词"];
const PROFESSIONAL = ["发动机", "双离合", "变速箱调校", "电池管理系统", "芯片制造", "法律条文", "医学诊断", "程序架构", "向量数据库"];
const NICHE_CULTURE = ["冷门文学", "地方志", "小众诗刊", "地方戏曲", "地域性网络梗"];

export const CHARACTER_KNOWLEDGE_DEPTH = Object.freeze({
  DEFAULT_KNOWN: "default_known",
  COMMON_SURFACE: "common_surface",
  UNCERTAIN_ASK: "uncertain_ask",
  UNKNOWN_UNLESS_PROFILE_SUPPORTS: "unknown_unless_profile_supports",
  BLOCKED_META_TECHNICAL: "blocked_meta_technical"
});

export function classifyCharacterKnowledge(topic = "", profile = {}) {
  const text = normalize(topic);

  if (containsAny(text, META_TECHNICAL)) {
    return result(CHARACTER_KNOWLEDGE_DEPTH.BLOCKED_META_TECHNICAL, "LLM/system/backend meta topic should not enter character knowledge.");
  }

  if (containsAny(text, DAILY_COMMON)) {
    return result(CHARACTER_KNOWLEDGE_DEPTH.DEFAULT_KNOWN, "User daily-life concept; character should not create distance.");
  }

  if (containsAny(text, PUBLIC_COMMON)) {
    return result(CHARACTER_KNOWLEDGE_DEPTH.COMMON_SURFACE, "Public common knowledge; surface familiarity is reasonable.");
  }

  if (containsAny(text, PROFESSIONAL)) {
    return profileSupports(profile, text)
      ? result(CHARACTER_KNOWLEDGE_DEPTH.COMMON_SURFACE, "Profile supports deeper topic familiarity.")
      : result(CHARACTER_KNOWLEDGE_DEPTH.UNKNOWN_UNLESS_PROFILE_SUPPORTS, "Professional detail requires profile support.");
  }

  if (containsAny(text, NICHE_CULTURE)) {
    return profileSupports(profile, text)
      ? result(CHARACTER_KNOWLEDGE_DEPTH.COMMON_SURFACE, "Profile supports niche cultural familiarity.")
      : result(CHARACTER_KNOWLEDGE_DEPTH.UNCERTAIN_ASK, "Niche/regional topic; character should be unsure or ask.");
  }

  return result(CHARACTER_KNOWLEDGE_DEPTH.UNCERTAIN_ASK, "No strong match; answer with reasonable uncertainty unless profile supports it.");
}

export function buildKnowledgeResponsePolicy(classification) {
  switch (classification?.depth) {
    case CHARACTER_KNOWLEDGE_DEPTH.DEFAULT_KNOWN:
      return "Respond naturally; do not mention country/time distance.";
    case CHARACTER_KNOWLEDGE_DEPTH.COMMON_SURFACE:
      return "Allow basic familiarity, but avoid expert detail unless profile supports it.";
    case CHARACTER_KNOWLEDGE_DEPTH.UNCERTAIN_ASK:
      return "Respond in-character with uncertainty, ask the user, or invite explanation.";
    case CHARACTER_KNOWLEDGE_DEPTH.UNKNOWN_UNLESS_PROFILE_SUPPORTS:
      return "Do not answer as expert. Be curious or ask the user to explain.";
    case CHARACTER_KNOWLEDGE_DEPTH.BLOCKED_META_TECHNICAL:
      return "Do not answer the technical meta question. Redirect in-character.";
    default:
      return "Use in-character common sense.";
  }
}

function profileSupports(profile, text) {
  const fields = [
    profile.role,
    profile.education,
    profile.occupation,
    profile.background,
    ...(Array.isArray(profile.interests) ? profile.interests : []),
    ...(Array.isArray(profile.skills) ? profile.skills : []),
    ...(Array.isArray(profile.knowledgeDomains) ? profile.knowledgeDomains : [])
  ].map(normalize).join(" ");

  const supportWords = ["汽车", "机械", "工程", "文学", "历史", "中国", "研究", "专业", "社团", "车", "书"];
  return supportWords.some((word) => fields.includes(word)) && text.length > 0;
}

function containsAny(text, list) {
  return list.some((item) => text.includes(normalize(item)));
}

function result(depth, reason) {
  return { depth, reason };
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}
