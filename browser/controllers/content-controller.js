"use strict";

// Character, worldbook, alchemy, review, and content-library actions.
function showCreateDialog(dataMode, label) {
  const name = prompt(`输入${label}名称`);
  if (!name?.trim()) return;
  API.createModule({ name: name.trim(), displayName: name.trim(), dataMode, subType: dataMode === "worldbook" ? "classic" : "default", preset: dataMode === "worldbook" ? "epic" : "minimal" })
    .then(async res => {
      if (res.status !== "ok") throw new Error(res.errorMsg || "创建失败");
      await refreshModules();
      AS.selectedModule = AS.modules.find(m => m.id === res.module.id) || AS.selectedModule;
      createToast("已创建");
      render();
    })
    .catch(err => createToast(err.message, "bad"));
}

async function deleteModule(id) {
  if (!id) return;
  const mod = AS.modules.find(m => m.id === id);
  if (!confirm(`确定删除「${mod?.displayName || mod?.name || id}」？此操作不可恢复。`)) return;
  if (mod?.dataMode === "character_card") await API.post("/api/characters/delete", { id: mod._characterId || id.replace("char:", "") });
  else await API.deleteModule(id);
  if (AS.selectedModule?.id === id) AS.selectedModule = null;
  await refreshModules();
  render();
}

async function importCharacterFile() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json,.png";
  input.multiple = true;
  input.onchange = async () => {
    const files = Array.from(input.files || []);
    if (!files.length) return;
    let ok = 0;
    const failed = [];
    for (const file of files) {
      try {
        let content;
        let encoding = "text";
        if (file.name.toLowerCase().endsWith(".png")) {
          const bytes = new Uint8Array(await file.arrayBuffer());
          let binary = "";
          for (const b of bytes) binary += String.fromCharCode(b);
          content = btoa(binary);
          encoding = "base64";
        } else {
          content = await file.text();
        }
        const res = await API.importCharacter({ filename: file.name, content, encoding });
        if (res.status !== "ok") throw new Error(res.errorMsg || "导入失败");
        ok += 1;
      } catch (err) {
        failed.push(`${file.name}: ${err.message || err}`);
      }
    }
    AS.characters = await API.loadCharacters();
    await refreshModules();
    createToast(`角色卡导入 ${ok}/${files.length}${failed.length ? "，有失败项" : ""}`, failed.length ? "warn" : "");
    if (failed.length) console.warn("角色导入失败", failed);
    render();
  };
  input.click();
}

async function editCharacterMeta(id) {
  if (!id) return;
  const current = AS.characters.find(c => c.id === id) || {};
  const name = prompt("角色显示名", current.name || id);
  if (name == null) return;
  const tags = prompt("标签，用逗号分隔", (current.tags || []).join(", "));
  if (tags == null) return;
  const description = prompt("短说明", current.description || "");
  if (description == null) return;
  const res = await API.updateCharacter({ id, name, tags, description });
  if (res.status !== "ok") throw new Error(res.errorMsg || "更新失败");
  AS.characters = await API.loadCharacters();
  await refreshModules();
  createToast("角色信息已更新");
  render();
}

async function previewCharacter(id) {
  if (!id) return;
  const res = await API.loadCharacter(id);
  if (res.status === "ok") { AS.currentCharacterCard = res.card; AS.currentV2Capsule = res.v2Capsule || null; AS.currentV2RuntimeContext = res.v2RuntimeContext || null; AS.currentV2RuntimeMvp = res.v2RuntimeMvp || null; }
  else { AS.currentV2Capsule = null; AS.currentV2RuntimeContext = null; AS.currentV2RuntimeMvp = null; }
  render();
}

async function rpCharacter(id) {
  if (!id) return;
  try {
    const res = await API.loadCharacter(id);
    if (res.status === "ok") {
      AS.currentV2Capsule = res.v2Capsule || null;
      AS.currentV2RuntimeMvp = res.v2RuntimeMvp || null;
      if (AS.currentV2RuntimeMvp?.available) {
        createToast("V2 Runtime 已就绪：可在 V2 角色回复面板中进行受控 Text-first 回复。", "ok");
      } else if (AS.currentV2RuntimeContext?.available) {
        createToast("V2 角色运行上下文已就绪（尚未注入 LLM）", "ok");
      }
    }
  } catch { /* non-blocking */ }
  let mod = AS.modules.find(m => m.id === `char:${id}`);
  if (!mod) {
    const c = AS.characters.find(x => x.id === id);
    mod = { id: `char:${id}`, displayName: c?.name || id, dataMode: "character_card", _characterId: id };
    AS.modules.push(mod);
  }
  await selectModule(mod.id, "chat");
  render();
}

async function backupCharacter(id) {
  if (!id) return;
  await API.post("/api/characters/backup", { id });
  createToast("角色卡已备份");
}

async function deleteCharacter(id) {
  if (!id || !confirm("确定删除这张角色卡？")) return;
  await API.post("/api/characters/delete", { id });
  AS.characters = await API.loadCharacters();
  await refreshModules();
  render();
}

async function editWorldbookEntry(id) {
  if (!AS.selectedModule) return createToast("请先选择世界", "warn");
  const entry = AS.worldbookEntries.find(e => (e.id || "") === id) || {};
  const title = prompt("条目标题", entry.title || entry.keys?.[0] || "");
  if (!title) return;
  const keys = prompt("关键词，用逗号分隔", Array.isArray(entry.keys) ? entry.keys.join(", ") : title) || title;
  const group = prompt("分组", entry.group || "默认") || "默认";
  const content = prompt("条目内容", entry.content || "") || "";
  const priority = Number(prompt("优先级", entry.priority ?? 100) || entry.priority || 100);
  const res = await API.saveWorldbook({ moduleKey: AS.selectedModule.id, action: "upsert", entry: { ...entry, title, keys, group, content, priority, enabled: entry.enabled !== false } });
  if (res.status !== "ok") throw new Error(res.errorMsg || "保存失败");
  AS.worldbookEntries = res.entries || [];
  render();
}

function exportWorldbookJson() {
  if (!AS.selectedModule) return createToast("请先选择世界", "warn");
  downloadJsonFile(`${AS.selectedModule.id}-worldbook.json`, { entries: AS.worldbookEntries || [] });
}

function importWorldbookJson() {
  if (!AS.selectedModule) return createToast("请先选择世界", "warn");
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json";
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    const json = JSON.parse(await file.text());
    const entries = Array.isArray(json) ? json : (json.entries || json.worldbook?.entries || []);
    if (!Array.isArray(entries) || !entries.length) return createToast("没有识别到世界书 entries", "bad");
    const res = await API.saveWorldbook({ moduleKey: AS.selectedModule.id, action: "append", entries });
    if (res.status !== "ok") throw new Error(res.errorMsg || "导入失败");
    AS.worldbookEntries = res.entries || [];
    createToast(`已导入 ${entries.length} 条世界书`);
    render();
  };
  input.click();
}

async function toggleWorldbookEntry(id) {
  const entry = AS.worldbookEntries.find(e => (e.id || "") === id);
  const res = await API.saveWorldbook({ moduleKey: AS.selectedModule.id, action: "toggle", id, enabled: entry?.enabled === false });
  if (res.status === "ok") AS.worldbookEntries = res.entries || [];
  render();
}

async function deleteWorldbookEntry(id) {
  if (!id || !confirm("删除该世界书条目？")) return;
  const res = await API.saveWorldbook({ moduleKey: AS.selectedModule.id, action: "delete", id });
  if (res.status === "ok") AS.worldbookEntries = res.entries || [];
  render();
}

async function testWorldbook() {
  if (!AS.selectedModule) return createToast("请先选择世界", "warn");
  AS.worldbookTest = await API.testWorldbook({ moduleKey: AS.selectedModule.id, input: U.qs("#worldbookTestInput")?.value || "" });
  render();
}

async function alchemyImport() {
  const text = U.qs("#alchemyText")?.value.trim();
  if (!text) return createToast("请先粘贴素材", "warn");
  const res = await API.alchemyImport({ text, moduleKey: activeAlchemyModuleKey() });
  if (res.status !== "ok") throw new Error(res.errorMsg || "提取失败");
  await loadReviewFacts();
  createToast(`已加入审核队列 ${res.reviewItems?.length || 0} 项`);
  AS.libraryTab = "review";
  render();
}

function updateAlchemyItem(id, patch) {
  const item = AS.alchemyPreview?.items?.find(entry => entry.id === id);
  if (item) Object.assign(item, patch);
}

function activeAlchemyModuleKey() {
  const module = AS.selectedModule;
  return module && module.type !== "profile" && !String(module.id || "").startsWith("profile:") ? module.id : "";
}

function setAlchemyPreview(result) {
  AS.alchemyPreview = result.preview || null;
  AS.alchemyPreviewId = result.previewId || result.preview?.id || "";
  AS.alchemySelectedItemIds = (AS.alchemyPreview?.items || []).filter(item => item.selected !== false).map(item => item.id);
  AS.alchemyEditingItemId = "";
  AS.alchemyEditingMechanismId = "";
  AS.alchemyError = "";
}

async function loadMechanismLibrary(query = AS.alchemyMechanismQuery) {
  AS.alchemyMechanismQuery = String(query || "");
  const result = await API.mechanismLibrary({ query: AS.alchemyMechanismQuery, moduleKey: activeAlchemyModuleKey(), previewId: AS.alchemyPreviewId });
  AS.alchemyMechanismLibrary = result.templates || [];
  if (!AS.alchemyMechanismQuery && result.recommendations?.length) AS.alchemyMechanismRecommendations = result.recommendations;
  render();
}

async function loadAlchemyMechanismsFromInput() {
  const result = await API.mechanismDraft({
    previewId: AS.alchemyPreviewId,
    text: AS.alchemyText,
    moduleKey: activeAlchemyModuleKey(),
    userGoal: AS.alchemyUserGoal
  });
  const libraryDrafts = AS.alchemyMechanismDrafts.filter(draft => draft.source === "library" || draft.source === "manual");
  AS.alchemyMechanismDrafts = [...(result.drafts || []), ...libraryDrafts];
  AS.alchemyMechanismRecommendations = result.libraryRecommendations || [];
  await loadMechanismLibrary();
}

function addMechanismTemplate(templateId) {
  const template = AS.alchemyMechanismLibrary.find(item => item.templateId === templateId) || AS.alchemyMechanismRecommendations.find(item => item.templateId === templateId);
  if (!template) return createToast("没有找到这个机制模板", "warn");
  if (AS.alchemyMechanismDrafts.some(draft => draft.sourceRef?.templateId === template.templateId)) return createToast("这个模板已加入本次机制", "warn");
  const defaults = template.defaultDraft || {};
  AS.alchemyMechanismDrafts.push({
    id: globalThis.crypto?.randomUUID?.() || `mechanism-${Date.now()}`,
    source: "library",
    sourceRef: { templateId: template.templateId },
    name: defaults.name || template.name,
    type: defaults.type || template.type || "custom",
    description: defaults.description || template.description || "",
    scope: defaults.scope || ((defaults.type || template.type) === "custom" ? "world" : "save"),
    stateSchema: defaults.stateSchema || { kind: "custom" },
    visualHint: defaults.visualHint || template.visualHint || { preferredType: "status_list", showToPlayer: true },
    selected: true,
    warnings: []
  });
  createToast(`已添加：${template.name}`);
  render();
}

function editMechanismDraft(id) {
  const draft = AS.alchemyMechanismDrafts.find(item => item.id === id);
  if (!draft) return;
  if (AS.alchemyEditingMechanismId !== id) {
    AS.alchemyEditingMechanismId = id;
    return render();
  }
  const card = document.querySelector(`[data-mechanism-draft-id="${globalThis.CSS?.escape?.(id) || id}"]`);
  const field = name => card?.querySelector(`[data-mechanism-field="${name}"]`);
  const numberOrUndefined = name => field(name)?.value === "" ? undefined : Number(field(name)?.value);
  const min = numberOrUndefined("min");
  const max = numberOrUndefined("max");
  const defaultValue = numberOrUndefined("defaultValue");
  if (min !== undefined && max !== undefined && min > max) return createToast("最小值不能大于最大值", "bad");
  if (defaultValue !== undefined && min !== undefined && defaultValue < min) return createToast("默认值不能小于最小值", "bad");
  if (defaultValue !== undefined && max !== undefined && defaultValue > max) return createToast("默认值不能大于最大值", "bad");
  draft.name = String(field("name")?.value || "").trim().slice(0, 120) || draft.name;
  draft.type = field("type")?.value || "custom";
  draft.description = String(field("description")?.value || "").trim().slice(0, 500);
  draft.scope = field("scope")?.value || "save";
  draft.stateSchema = { kind: field("kind")?.value || "custom", ...(min !== undefined ? { min } : {}), ...(max !== undefined ? { max } : {}), ...(defaultValue !== undefined ? { defaultValue } : {}) };
  draft.visualHint = { preferredType: field("preferredType")?.value || "status_list", showToPlayer: Boolean(field("showToPlayer")?.checked) };
  AS.alchemyEditingMechanismId = "";
  render();
}

function removeMechanismDraft(id) {
  AS.alchemyMechanismDrafts = AS.alchemyMechanismDrafts.filter(item => item.id !== id);
  if (AS.alchemyEditingMechanismId === id) AS.alchemyEditingMechanismId = "";
  render();
}

async function commitMechanismDraftsToWorld() {
  const moduleKey = activeAlchemyModuleKey();
  if (!moduleKey || moduleKey === "__quick__") return createToast("请先选择要写入机制缓存的世界", "warn");
  const result = await API.mechanismCommit({ moduleKey, drafts: AS.alchemyMechanismDrafts });
  AS.alchemyMechanismCache = result.cache || null;
  createToast(`已提交 ${result.committed || 0} 项机制；跳过 ${result.skipped || 0} 项`);
}


async function alchemyG1Plan() {
  AS.alchemyText = U.qs("#alchemyText")?.value || AS.alchemyText;
  AS.alchemyG1.userSupplement = U.qs("#alchemyG1Supplement")?.value || AS.alchemyG1.userSupplement || "";
  const text = AS.alchemyText.trim();
  if (!text) return createToast("请先输入灵感或设定", "warn");

  AS.alchemyG1.busy = true;
  AS.alchemyG1.error = "";
  render();
  try {
    const result = await API.alchemyPlan({
      text,
      userPreference: { userSupplement: AS.alchemyG1.userSupplement },
      previousPlan: AS.alchemyG1.plan || null
    });
    if (result.status !== "ok") throw new Error(result.errorMsg || "创作地图生成失败");
    AS.alchemyG1.plan = result;
    const recommended = result.userDecisionNeeded?.recommendedTargets || [];
    if (!AS.alchemyG1.selectedTargets?.length && recommended.length) {
      AS.alchemyG1.selectedTargets = recommended.filter(Boolean);
    }
    createToast("创作地图已生成");
  } catch (err) {
    AS.alchemyG1.error = err.message || String(err);
    createToast(AS.alchemyG1.error, "bad");
  } finally {
    AS.alchemyG1.busy = false;
    render();
  }
}

async function alchemyG1GeneratePreview() {
  const text = (U.qs("#alchemyText")?.value || AS.alchemyText || "").trim();
  AS.alchemyG1.userSupplement = U.qs("#alchemyG1Supplement")?.value || AS.alchemyG1.userSupplement || "";
  const selectedTargets = AS.alchemyG1.selectedTargets || [];
  if (!AS.alchemyG1.plan) return createToast("请先生成创作地图", "warn");
  if (!selectedTargets.length) return createToast("请选择至少一个输出目标", "warn");

  AS.alchemyG1.busy = true;
  AS.alchemyG1.error = "";
  render();
  try {
    const result = await API.alchemyGeneratePreview({
      text,
      plan: AS.alchemyG1.plan,
      selectedTargets,
      userSupplement: AS.alchemyG1.userSupplement
    });
    if (result.status !== "ok") throw new Error(result.errorMsg || "内容预览生成失败");
    AS.alchemyG1.preview = result;
    AS.alchemyG1.localFolderDraft = null;
    createToast("内容预览已生成");
  } catch (err) {
    AS.alchemyG1.error = err.message || String(err);
    createToast(AS.alchemyG1.error, "bad");
  } finally {
    AS.alchemyG1.busy = false;
    render();
  }
}

async function alchemyG1Localize() {
  if (!AS.alchemyG1.preview) return createToast("请先生成内容预览", "warn");
  AS.alchemyG1.busy = true;
  AS.alchemyG1.error = "";
  render();
  try {
    const result = await API.alchemyLocalize({
      preview: AS.alchemyG1.preview,
      selectedTargets: AS.alchemyG1.selectedTargets || []
    });
    if (result.status !== "ok") throw new Error(result.errorMsg || "本地文件夹草案生成失败");
    AS.alchemyG1.localFolderDraft = result;
    createToast("本地文件夹草案已生成");
  } catch (err) {
    AS.alchemyG1.error = err.message || String(err);
    createToast(AS.alchemyG1.error, "bad");
  } finally {
    AS.alchemyG1.busy = false;
    render();
  }
}

async function alchemyG1Deliver() {
  if (!AS.alchemyG1.preview || !AS.alchemyG1.localFolderDraft) return createToast("请先生成预览和本地草案", "warn");
  const selectedTargets = AS.alchemyG1.selectedTargets || [];
  if (!selectedTargets.length) return createToast("请选择至少一个输出目标", "warn");
  if (!confirm("确认交付？这会把内容写入本地世界/数据入口。")) return;

  AS.alchemyG1.busy = true;
  AS.alchemyG1.error = "";
  render();
  try {
    const result = await API.alchemyDeliver({
      preview: AS.alchemyG1.preview,
      localFolderDraft: AS.alchemyG1.localFolderDraft,
      selectedTargets,
      userConfirmed: true
    });
    if (result.status !== "ok") throw new Error(result.errorMsg || "交付失败");
    const deliveries = await API.alchemyDeliveries(result.moduleKey || "");
    AS.alchemyG1.deliveries = deliveries.deliveries || [];
    await refreshModules();
    if (result.moduleKey) {
      await selectModule(result.moduleKey, "workbench");
      AS.workbenchMode = "chat";
    }
    createToast("炼金台交付完成，可以开始游玩");
  } catch (err) {
    AS.alchemyG1.error = err.message || String(err);
    createToast(AS.alchemyG1.error, "bad");
  } finally {
    AS.alchemyG1.busy = false;
    render();
  }
}

async function createAlchemyPreview() {
  AS.alchemyText = U.qs("#alchemyText")?.value || AS.alchemyText;
  AS.alchemyUserGoal = U.qs("#alchemyUserGoal")?.value || "";
  AS.alchemyTarget = U.qs("#alchemyTarget")?.value || AS.alchemyTarget;
  const text = AS.alchemyText.trim();
  if (!text) return createToast("请先输入素材或灵感", "warn");
  if (text.length > 120000) return createToast("文本过长，请分段处理。", "warn");
  AS.alchemyPreviewBusy = true;
  AS.alchemyError = "";
  render();
  try {
    const result = await API.alchemyPreview({
      text,
      moduleKey: activeAlchemyModuleKey(),
      mode: AS.alchemyMode,
      target: AS.alchemyTarget,
      userGoal: AS.alchemyUserGoal,
      options: { autoRelations: true, detectConflicts: true, suggestMissingFields: true, preserveSource: false }
    });
    setAlchemyPreview(result);
    await loadAlchemyMechanismsFromInput();
    createToast(`已生成 ${result.preview?.items?.length || 0} 个候选条目`);
  } catch (err) {
    AS.alchemyError = err.message || "预览处理失败";
    createToast(AS.alchemyError, "bad");
  } finally {
    AS.alchemyPreviewBusy = false;
    render();
  }
}

function toggleAlchemyItemEdit(id) {
  if (!id) return;
  AS.alchemyEditingItemId = AS.alchemyEditingItemId === id ? "" : id;
  render();
}

function ignoreAlchemyItem(id) {
  const item = AS.alchemyPreview?.items?.find(entry => entry.id === id);
  if (!item) return;
  item.selected = false;
  AS.alchemySelectedItemIds = AS.alchemySelectedItemIds.filter(itemId => itemId !== id);
  render();
}

async function refineAlchemyPreview() {
  if (!AS.alchemyPreviewId) return createToast("请先生成预览", "warn");
  AS.alchemyRefineText = U.qs("#alchemyRefineText")?.value || AS.alchemyRefineText;
  const instruction = AS.alchemyRefineText.trim();
  if (!instruction) return createToast("请输入继续处理的要求", "warn");
  if (!AS.alchemySelectedItemIds.length) return createToast("没有选中的条目可继续处理。", "warn");
  AS.alchemyPreviewBusy = true;
  AS.alchemyError = "";
  render();
  try {
    const result = await API.alchemyRefine({
      previewId: AS.alchemyPreviewId,
      instruction,
      selectedItemIds: AS.alchemySelectedItemIds,
      mode: AS.alchemyMode === "import" ? "polish" : AS.alchemyMode
    });
    setAlchemyPreview(result);
    await loadAlchemyMechanismsFromInput();
    AS.alchemyRefineText = "";
    createToast("已按要求生成新的预览版本");
  } catch (err) {
    AS.alchemyError = err.message || "继续处理失败";
    createToast(AS.alchemyError, "bad");
  } finally {
    AS.alchemyPreviewBusy = false;
    render();
  }
}

async function commitAlchemyPreview() {
  if (!AS.alchemyPreviewId) return createToast("请先生成预览", "warn");
  if (!AS.alchemySelectedItemIds.length) return createToast("没有选中的条目可加入审核队列。", "warn");
  AS.alchemyCommitBusy = true;
  AS.alchemyError = "";
  render();
  try {
    const result = await API.alchemyCommit({
      previewId: AS.alchemyPreviewId,
      action: "enqueue_review",
      selectedItemIds: AS.alchemySelectedItemIds,
      editedItems: AS.alchemyPreview?.items || []
    });
    await loadReviewFacts();
    createToast(`已加入审核队列 ${result.stats?.enqueued || 0} 条`);
    AS.libraryTab = "review";
  } catch (err) {
    AS.alchemyError = err.message || "加入审核队列失败";
    createToast(AS.alchemyError, "bad");
  } finally {
    AS.alchemyCommitBusy = false;
    render();
  }
}

function clearAlchemyPreview() {
  AS.alchemyPreview = null;
  AS.alchemyPreviewId = "";
  AS.alchemySelectedItemIds = [];
  AS.alchemyEditingItemId = "";
  AS.alchemyRefineText = "";
  AS.alchemyMechanismDrafts = [];
  AS.alchemyMechanismRecommendations = [];
  AS.alchemyMechanismTemplateId = "";
  AS.alchemyError = "";
  render();
}

async function enqueueReview() {
  const text = U.qs("#reviewSourceText")?.value.trim();
  if (!text) return createToast("请先粘贴素材", "warn");
  const res = await API.alchemyImport({ text, moduleKey: activeAlchemyModuleKey() });
  if (res.status !== "ok") throw new Error(res.errorMsg || "提取失败");
  await loadReviewFacts();
  render();
}

async function reviewAction(action, id) {
  if (!id) return;
  const payload = { id, moduleKey: AS.selectedModule?.id };
  if (!payload.moduleKey || payload.moduleKey === "__quick__") {
    if (action === "confirm-review") payload.action = "confirm";
    if (action === "ignore-review") payload.action = "ignore";
    if (action === "merge-review") payload.action = "merge";
    const res = await API.alchemyReview(payload);
    AS.reviewItems = res.items || [];
    return render();
  }
  let endpoint = action === "ignore-review" ? "reject" : "adopt";
  if (action === "merge-review") {
    endpoint = "edit-and-adopt";
    const item = AS.reviewItems.find(x => x.id === id) || {};
    const patch = prompt("编辑后的 after JSON", U.json(item.after || item.data || {}));
    if (patch && patch.trim()) {
      try { payload.after = JSON.parse(patch); }
      catch { return createToast("字段 JSON 格式不正确", "bad"); }
    }
  }
  const res = await API.reviewAction(endpoint, payload);
  if (res.status !== "ok") throw new Error(res.errorMsg || "审核操作失败");
  await loadReviewFacts();
  render();
}
