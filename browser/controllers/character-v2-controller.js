"use strict";

// Character V2 preview, live turn, review, and export controls.
async function characterV2Preview() {
  const name = (U.qs("#v2CreateName")?.value || "").trim();
  const text = (U.qs("#v2CreateText")?.value || "").trim();
  AS.characterV2Create.name = name;
  AS.characterV2Create.text = text;
  if (!name && !text) { AS.characterV2Create.error = "请先输入角色名或角色设定。"; return render(); }
  AS.characterV2Create.error = "";
  AS.characterV2Create.busy = true;
  render();
  try {
    const res = await API.importCharacter({ v2Capsule: true, confirmed: false, input: { name, text, sourceType: "manual", avatar: AS.characterV2Create.avatar } });
    if (res.status === "preview" && res.summary) {
      AS.characterV2Create.preview = res.summary;
      AS.characterV2Create.draft = res.draft;
    } else {
      AS.characterV2Create.error = res.errorMsg || "预览失败，请重试。";
    }
  } catch (err) {
    AS.characterV2Create.error = "角色草案预览失败，请查看控制台或稍后重试。";
  }
  AS.characterV2Create.busy = false;
  render();
}

async function characterV2Confirm() {
  if (!AS.characterV2Create.draft) { AS.characterV2Create.error = "请先预览角色草案。"; return render(); }
  AS.characterV2Create.busy = true;
  render();
  try {
    const res = await API.importCharacter({ v2Capsule: true, confirmed: true, draft: AS.characterV2Create.draft });
    if (res.status === "ok") {
      AS.characters = await API.loadCharacters();
      AS.characterV2Create = { open: false, name: "", text: "", avatar: null, preview: null, error: "", busy: false, advancedOpen: false };
      createToast("角色创建成功！", "ok");
    } else {
      AS.characterV2Create.error = res.errorMsg || "角色草案保存失败，请查看控制台或稍后重试。";
    }
  } catch (err) {
    AS.characterV2Create.error = "角色草案保存失败，请查看控制台或稍后重试。";
  }
  AS.characterV2Create.busy = false;
  render();
}

async function sendCharacterV2LiveTurn(dryRun = false) {
  const characterId = AS.currentV2RuntimeMvp?.characterId || AS.currentV2Capsule?.characterId || "";
  const userInput = (U.qs("#characterV2LiveInput")?.value || "").trim();
  if (!characterId) return createToast("请先预览一个 V2 角色。", "warn");
  if (!userInput && !dryRun) return createToast("请先输入一句话。", "warn");
  AS.characterV2Live.busy = true;
  AS.characterV2Live.error = "";
  render();
  try {
    const res = await API.post("/api/characters/v2/turn", { characterId, userInput: userInput || "你好。", history: AS.characterV2Live.history || [], dryRun });
    if (res.status !== "ok") throw new Error(res.errorMsg || "角色回复失败");
    AS.characterV2Live.reply = res.reply || "";
    AS.characterV2Live.candidates = { memory: res.candidates?.memoryCandidates?.length || 0, relationship: res.candidates?.relationshipCandidates?.length || 0, quality: res.candidates?.qualityCandidates?.length || 0 };
    AS.characterV2Live.candidateEnvelope = res.candidates || null;
    AS.characterV2Live.packetSummary = res.packetSummary || null;
    AS.characterV2Live.quality = res.quality || null;
    if (res.reply) AS.characterV2Live.history = [...AS.characterV2Live.history, { role: "user", content: userInput }, { role: "assistant", content: res.reply }].slice(-24);
    AS.characterV2Live.input = "";
  } catch (err) {
    AS.characterV2Live.error = err.message || String(err);
  }
  AS.characterV2Live.busy = false;
  render();
}

async function saveCharacterV2Candidates() {
  const characterId = AS.currentV2RuntimeMvp?.characterId || AS.currentV2Capsule?.characterId || "";
  const envelope = AS.characterV2Live.candidateEnvelope;
  if (!characterId) return createToast("请先预览一个 V2 角色。", "warn");
  if (!envelope) return createToast("当前没有可保存的候选。", "warn");
  try {
    const res = await API.post("/api/characters/v2/candidates/save", { characterId, candidates: envelope });
    createToast(res.saved > 0 ? `已保存 ${res.saved} 条候选到审核队列。` : "无可保存的候选。", "ok");
  } catch (err) {
    createToast("保存候选失败。", "warn");
  }
}

async function exportCharacterV2File(format) {
  const characterId = AS.currentV2RuntimeMvp?.characterId || AS.currentV2Capsule?.characterId || AS.currentCharacterCard?.id || "";
  if (!characterId) return createToast("请先预览一个角色。", "warn");
  try {
    const res = await API.post("/api/characters/v2/export", { characterId, format });
    if (res.status !== "ok") return createToast(res.errorMsg || "导出失败", "warn");
    const ext = { character_md: "md", wt_profile_json: "json", runtime_summary_json: "json", export_bundle_json: "json" }[format] || "json";
    const blob = new Blob([res.content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${characterId}.${format === "character_md" ? "CHARACTER.md" : format === "export_bundle_json" ? "world-tree-character-v2.bundle.json" : `${format}.${ext}`}`;
    a.click();
    URL.revokeObjectURL(url);
    createToast("导出完成", "ok");
  } catch (err) {
    createToast("导出失败：" + (err.message || ""), "warn");
  }
}
