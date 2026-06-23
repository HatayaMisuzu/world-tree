import { createModeMetadata } from "./mode-metadata.js";
import { createModeInitialState, createModeEngineStatePatch } from "./mode-initial-state.js";

/**
 * 统一创建 mode runtime packet。
 * 聚合 metadata、initialState、engineStatePatch、moduleGraph、wrapperGraph 和 warnings。
 * 所有字段 JSON-safe——不包含函数、路径、密钥。
 */
export function createModeRuntimePacket(modeId, options = {}) {
  const metadata = createModeMetadata(modeId, options);
  const initialState = createModeInitialState(modeId, options);
  const engineStatePatch = createModeEngineStatePatch(modeId, options);

  const warnings = [
    ...(metadata.moduleGraph?.warnings || []),
    ...(metadata.wrapperGraph?.warnings || [])
  ];

  return {
    mode: modeId,
    metadata,
    initialState,
    engineStatePatch,
    moduleGraph: metadata.moduleGraph,
    wrapperGraph: metadata.wrapperGraph,
    warnings
  };
}

/**
 * 轻量摘要——用于测试和 debug。
 * 不包含完整 graph，仅返回计数和状态。
 */
export function createModeRuntimeSummary(modeId, options = {}) {
  const packet = createModeRuntimePacket(modeId, options);
  return {
    mode: packet.mode,
    displayName: packet.metadata?.displayName || modeId,
    dataMode: packet.metadata?.dataMode || "",
    worldSubType: packet.metadata?.worldSubType || "",
    sourceType: packet.metadata?.sourceType || "",
    moduleCount: packet.moduleGraph?.modules?.length || 0,
    wrapperCount: packet.wrapperGraph?.wrappers?.length || 0,
    missingModuleCount: packet.moduleGraph?.missing?.length || 0,
    missingWrapperCount: packet.wrapperGraph?.missingWrappers?.length || 0,
    warnings: packet.warnings
  };
}
