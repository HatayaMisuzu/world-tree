// Character Capsule V2 — Advanced UI Gate Helper
// Pure DOM helper. No persistence. No server calls.

export function initCharacterV2AdvancedGate(root = document) {
  const buttons = Array.from(root.querySelectorAll("[data-character-v2-advanced-toggle]"));
  for (const button of buttons) {
    const targetId = button.getAttribute("data-character-v2-advanced-toggle");
    const panel = targetId ? root.querySelector(`[data-character-v2-advanced-panel="${targetId}"]`) : null;
    if (!panel) continue;

    panel.hidden = true;
    button.setAttribute("aria-expanded", "false");

    button.addEventListener("click", () => {
      const nextVisible = panel.hidden;
      panel.hidden = !nextVisible;
      button.setAttribute("aria-expanded", String(nextVisible));
      button.textContent = nextVisible ? "隐藏高级设置" : "高级设置";
    });
  }
}

export function containsForbiddenNormalUiText(text = "") {
  const normalized = String(text || "").toLowerCase();
  return ["ooc", "token", "prompt packet", "module", "debug", "api", "hook failed", "drift score"].some((word) => normalized.includes(word));
}
