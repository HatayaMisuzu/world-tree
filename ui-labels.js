(function initWorldTreeUiLabels(global) {
  const labels = Object.freeze({
    experimental: "抢先体验",
    thinSlice: "基础版",
    partialRules: "基础规则",
    truthLockActive: "剧透保护已开启",
    notFullDnd: "暂不包含完整 DND 规则",
    notFull4x: "暂不包含完整 4X 规则",
    fullVersionLocation: "完整版本号见设置-关于"
  });

  function label(id, fallback = "") {
    return labels[id] || fallback || id;
  }

  global.WT_UI_LABELS = Object.freeze({ labels, label });
})(typeof window !== "undefined" ? window : globalThis);
