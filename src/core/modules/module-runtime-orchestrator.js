import { loadWrappersForMode } from "./module-loader.js";
import { getMode } from "../modes/mode-manifest.js";
import { scrubSensitiveText, truncateText } from "./wrapper-utils.js";

/**
 * 统一构造传给 wrapper 的 ctx。
 * 所有字段可为空，不 throw，不写文件，不调用 LLM。
 */
export function createModuleRuntimeContext(input = {}) {
  return {
    model: input.model || {},
    input: input.input || "",
    engineState: input.engineState || {},
    moduleData: input.moduleData || {},
    worldbookState: input.worldbookState || null,
    cards: Array.isArray(input.cards) ? input.cards : [],
    options: input.options || {}
  };
}

/**
 * 安全调用单个 wrapper 的单个 hook。
 * hook 不存在 → skipped；抛错 → 捕获不中断。
 * 错误信息经 scrub，不含本机路径。
 */
export function runWrapperHook(wrapper, hookName, ctx = {}) {
  const moduleId = wrapper.id || "unknown";
  const legacyId = wrapper.legacyId || "";

  if (typeof wrapper[hookName] !== "function") {
    return {
      ok: false,
      skipped: true,
      moduleId,
      legacyId,
      hook: hookName,
      result: null,
      warnings: [`hook not implemented: ${hookName}`]
    };
  }

  try {
    const result = wrapper[hookName](ctx);
    return {
      ok: true,
      skipped: false,
      moduleId,
      legacyId,
      hook: hookName,
      result,
      warnings: Array.isArray(result?.warnings) ? [...result.warnings] : []
    };
  } catch (error) {
    return {
      ok: false,
      skipped: false,
      moduleId,
      legacyId,
      hook: hookName,
      result: null,
      warnings: [scrubSensitiveText(truncateText(error?.message || "unknown error", 240))]
    };
  }
}

/**
 * 批量调用：对所有 wrappers 执行同一 hook。
 */
export function runWrappersHook(wrappers = [], hookName, ctx = {}) {
  return wrappers.map((wrapper) => runWrapperHook(wrapper, hookName, ctx));
}

/**
 * 将 runWrapperHook 的原始结果规范化为 JSON-safe 块。
 * 提取 data + warnings，脱敏截断。
 */
export function normalizeHookResult(result) {
  return {
    moduleId: result.moduleId,
    legacyId: result.legacyId,
    ok: result.ok,
    skipped: result.skipped || false,
    data: result.result?.data ?? result.result ?? null,
    warnings: (Array.isArray(result.warnings) ? result.warnings : [])
      .map((w) => scrubSensitiveText(truncateText(w, 240)))
  };
}

/**
 * 统一创建 Module Runtime Packet。
 *
 * 流程：
 *   1. loadWrappersForMode(modeId)
 *   2. createModuleRuntimeContext(ctx)
 *   3. 对每个 wrapper 调用 buildContext / buildPromptBlock / getDebugInfo
 *   4. 聚合 contextBlocks / promptBlocks / debugInfo / warnings / errors
 *
 * 所有输出 JSON-safe——不含函数、路径、密钥。
 * promptBlocks 只是旁路结果，本轮不注入主 LLM prompt。
 */
export function createModuleRuntimePacket(modeId, ctx = {}) {
  const mode = getMode(modeId);
  const loaderResult = loadWrappersForMode(modeId);
  const wrappers = loaderResult.wrappers || [];
  const missingWrappers = loaderResult.missingWrappers || [];
  const runtimeCtx = createModuleRuntimeContext(ctx);

  const warnings = [...(loaderResult.warnings || [])];
  const errors = [];

  if (!mode) {
    errors.push(`unknown mode: ${modeId}`);
    return {
      modeId,
      requested: [],
      wrapperCount: 0,
      missingWrappers,
      contextBlocks: [],
      promptBlocks: [],
      debugInfo: [],
      warnings: warnings.map((w) => scrubSensitiveText(truncateText(w, 240))),
      errors
    };
  }

  // buildContext
  const contextBlocks = wrappers.map((wrapper) => {
    const raw = runWrapperHook(wrapper, "buildContext", runtimeCtx);
    if (!raw.ok && !raw.skipped) {
      errors.push(`buildContext failed for ${raw.moduleId}: ${raw.warnings[0] || "unknown"}`);
    }
    return normalizeHookResult(raw);
  });

  // buildPromptBlock
  const promptBlocks = wrappers.map((wrapper) => {
    const raw = runWrapperHook(wrapper, "buildPromptBlock", runtimeCtx);
    if (!raw.ok && !raw.skipped) {
      errors.push(`buildPromptBlock failed for ${raw.moduleId}`);
    }
    return {
      moduleId: raw.moduleId,
      legacyId: raw.legacyId,
      ok: raw.ok,
      text: scrubSensitiveText(
        truncateText(typeof raw.result === "string" ? raw.result : "", 1200)
      ),
      warnings: (Array.isArray(raw.warnings) ? raw.warnings : [])
        .map((w) => scrubSensitiveText(truncateText(w, 240)))
    };
  });

  // getDebugInfo
  const debugInfo = wrappers.map((wrapper) => {
    const raw = runWrapperHook(wrapper, "getDebugInfo", runtimeCtx);
    if (!raw.ok && !raw.skipped) {
      errors.push(`getDebugInfo failed for ${raw.moduleId}`);
    }
    return normalizeHookResult(raw);
  });

  return {
    modeId,
    requested: loaderResult.uses || [],
    wrapperCount: wrappers.length,
    missingWrappers,
    contextBlocks,
    promptBlocks,
    debugInfo,
    warnings: warnings.map((w) => scrubSensitiveText(truncateText(w, 240))),
    errors
  };
}

/**
 * 轻量摘要——测试和 debug 用。
 */
export function createModuleRuntimeSummary(packet = {}) {
  return {
    modeId: packet.modeId || "",
    wrapperCount: packet.wrapperCount || 0,
    contextBlockCount: Array.isArray(packet.contextBlocks) ? packet.contextBlocks.length : 0,
    promptBlockCount: Array.isArray(packet.promptBlocks) ? packet.promptBlocks.length : 0,
    debugInfoCount: Array.isArray(packet.debugInfo) ? packet.debugInfo.length : 0,
    missingWrapperCount: Array.isArray(packet.missingWrappers) ? packet.missingWrappers.length : 0,
    warningCount: Array.isArray(packet.warnings) ? packet.warnings.length : 0,
    errorCount: Array.isArray(packet.errors) ? packet.errors.length : 0
  };
}
