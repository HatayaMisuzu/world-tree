// Legacy character-card HTTP routes (/api/characters*), split out of http-api-router.js.
// Behavior unchanged. Returns false when the request is not a character-card route.
export async function handleCharacterCardHttpRoute({ path, method, req, res }, deps = {}) {
  const { jsonResponse, jsonError, readBody, listCharacters, handleCharacterImport, handleCharacterUpdate, safeEntityId, dataRoot, join, existsSync, readJsonSync, pathWithinRoot, CHARACTERS_DIR, rmSync, ensureDir, mkdirSync, readFileSync, writeFileSync } = deps;
  if (path === "/api/characters" && method === "GET") return jsonResponse(res, listCharacters());
  if (path === "/api/characters/import" && method === "POST") return jsonResponse(res, await handleCharacterImport(await readBody(req)));
  if (path === "/api/characters/update" && method === "POST") return jsonResponse(res, await handleCharacterUpdate(await readBody(req)));
  if (path === "/api/characters/load" && method === "POST") {
    const body = await readBody(req);
    const id = safeEntityId(body.id || "", "");
    if (!id) return jsonError(res, 400, "CHARACTER_ID_MISSING", "缺少角色卡 ID。请重新选择角色卡后再试。");
    const { parseCharacterCard } = await import("../core/data/character-card.js");
    const cardJsonPath = join(dataRoot(), "engine", "characters", id, "card.json");
    const card = existsSync(cardJsonPath) ? readJsonSync(cardJsonPath, null) : null;
    if (!card) return jsonError(res, 404, "CHARACTER_NOT_FOUND", "没有找到这张角色卡。它可能已被删除或移动。");
    const parsed = parseCharacterCard(card);
    let v2Capsule = null;
    let v2RuntimeContext = null;
    let v2RuntimeMvp = null;
    try {
      const { loadCharacterCapsuleSummary, loadCharacterCapsuleRuntimeContext, loadCharacterCapsuleRuntimeMvp } = await import("./character-capsule-service.js");
      const charactersRoot = join(dataRoot(), "engine", "characters");
      v2Capsule = loadCharacterCapsuleSummary(charactersRoot, id);
      v2RuntimeContext = await loadCharacterCapsuleRuntimeContext(charactersRoot, id);
      v2RuntimeMvp = await loadCharacterCapsuleRuntimeMvp(charactersRoot, id);
    } catch { /* V2 capsule unavailable; legacy-only */ }
    return jsonResponse(res, { status: "ok", card: parsed, ...(v2Capsule ? { v2Capsule } : {}), ...(v2RuntimeContext ? { v2RuntimeContext } : {}), ...(v2RuntimeMvp ? { v2RuntimeMvp } : {}) });
  }
  if (path === "/api/characters/delete" && method === "POST") {
    const body = await readBody(req);
    const id = safeEntityId(body.id || "", "");
    if (!id) return jsonError(res, 400, "CHARACTER_ID_MISSING", "缺少角色卡 ID。请重新选择角色卡后再试。");
    const targetDir = join(dataRoot(), "engine", "characters", id);
    if (!pathWithinRoot(CHARACTERS_DIR(), targetDir)) return jsonError(res, 400, "CHARACTER_ID_INVALID", "角色卡 ID 无效。");
    if (!existsSync(targetDir)) return jsonError(res, 404, "CHARACTER_NOT_FOUND", "角色卡不存在，可能已经被删除。");
    try {
      rmSync(targetDir, { recursive: true, force: true });
      return jsonResponse(res, { status: "ok" });
    } catch (err) {
      return jsonError(res, 500, "CHARACTER_DELETE_FAILED", "删除角色卡失败。请检查文件是否被其他程序占用。", err.message);
    }
  }
  if (path === "/api/characters/backup" && method === "POST") {
    // 角色卡备份：复制 data/engine/characters/ 到 data/characters-archive/
    const body = await readBody(req);
    const id = safeEntityId(body.id || "", "");
    if (!id) return jsonError(res, 400, "CHARACTER_ID_MISSING", "缺少角色卡 ID。请重新选择角色卡后再试。");
    const srcDir = join(dataRoot(), "engine", "characters", id);
    if (!pathWithinRoot(CHARACTERS_DIR(), srcDir)) return jsonError(res, 400, "CHARACTER_ID_INVALID", "角色卡 ID 无效。");
    if (!existsSync(srcDir)) return jsonError(res, 404, "CHARACTER_NOT_FOUND", "角色卡不存在，无法备份。");
    try {
      const archiveDir = join(dataRoot(), "characters-archive");
      ensureDir(archiveDir);
      const backupId = `${id}_${Date.now()}`;
      const destDir = join(archiveDir, backupId);
      mkdirSync(destDir, { recursive: true });
      const srcCard = join(srcDir, "card.json");
      if (existsSync(srcCard)) {
        const content = readFileSync(srcCard, "utf-8");
        writeFileSync(join(destDir, "card.json"), content, "utf-8");
      }
      return jsonResponse(res, { status: "ok", backupId, location: "characters-archive" });
    } catch (err) {
      return jsonError(res, 500, "CHARACTER_BACKUP_FAILED", "备份角色卡失败。请检查数据目录是否可写。", err.message);
    }
  }
  return false;
}
