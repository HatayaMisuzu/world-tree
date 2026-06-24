export const RHYTHM_TAGS = Object.freeze(["breath", "escalate", "reveal", "quiet", "climax", "aftermath"]);
const INSTRUCTIONS = Object.freeze({ breath: "给角色与读者留出喘息和整理信息的空间。", escalate: "提高冲突或压力，但不要替用户做重大决定。", reveal: "揭示已获准公开的信息，不得泄露 hidden truth。", quiet: "降低外部事件密度，聚焦细节与关系。", climax: "集中兑现已铺垫冲突，重大变化仍走 proposal。", aftermath: "处理后果、余波与新的开放问题。" });

export function normalizeRhythmTag(value, fallback = "breath") { return RHYTHM_TAGS.includes(value) ? value : fallback; }
export function rhythmInstruction(value) { const tag = normalizeRhythmTag(value); return { tag, instruction: INSTRUCTIONS[tag] }; }
export function inferRhythmTag({ tension = 0, sceneChanged = false, revealRequested = false } = {}) { if (revealRequested) return "reveal"; if (sceneChanged) return "aftermath"; if (Number(tension) >= 8) return "climax"; if (Number(tension) >= 5) return "escalate"; return "breath"; }
