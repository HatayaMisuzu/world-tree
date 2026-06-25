/**
 * UI state helpers for Character Capsule V2-1 creation.
 * Pure functions only. The browser file can use these rules or mirror them.
 */

export function createInitialCharacterV2CreateUiState() {
  return {
    open: false,
    mode: "manual_text",
    name: "",
    text: "",
    avatar: null,
    preview: null,
    error: "",
    busy: false,
    advancedOpen: false,
    advancedTab: "summary"
  };
}

export function setCharacterV2CreateField(state, field, value) {
  return { ...state, [field]: value, error: "" };
}

export function toggleCharacterV2Advanced(state) {
  return { ...state, advancedOpen: !state.advancedOpen };
}

export function normalizeAvatarForUi(fileOrValue) {
  if (!fileOrValue) return null;
  if (typeof fileOrValue === "string") {
    return {
      label: "手动头像",
      dataUri: fileOrValue,
      uiOnly: true,
      participatesInPrompt: false,
      participatesInCognition: false,
      metadataParsed: false
    };
  }
  return {
    label: fileOrValue.name || "手动头像",
    mime: fileOrValue.type || "",
    dataUri: fileOrValue.dataUri || fileOrValue.url || "",
    uiOnly: true,
    participatesInPrompt: false,
    participatesInCognition: false,
    metadataParsed: false
  };
}

export function buildCharacterV2CreateInput(state) {
  return {
    sourceType: "manual",
    name: state.name,
    text: state.text,
    avatar: normalizeAvatarForUi(state.avatar)
  };
}

export function buildCharacterV2ConfirmPayload(draft) {
  return {
    v2Capsule: true,
    confirmed: true,
    draft
  };
}

export function normalUiSummaryOnly(summary) {
  return {
    title: summary?.title || "未命名角色",
    subtitle: summary?.subtitle || "",
    badges: Array.isArray(summary?.badges) ? summary.badges.slice(0, 6) : [],
    lines: Array.isArray(summary?.lines) ? summary.lines.slice(0, 8) : [],
    safeForNormalUi: true
  };
}
