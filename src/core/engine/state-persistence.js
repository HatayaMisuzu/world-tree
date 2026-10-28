// ===== 引擎状态持久化 v1 =====
// 统一导出/导入入口——在 completeTurn 末尾调用 exportEngineState()，
// 在模组加载时调用 importEngineState()。
//
// 覆盖：记忆层 / 关系网 / 提案队列 / 预测缓存 / 情绪状态 / 事件历史

import { exportMemorySnapshot, importMemorySnapshot, resetAllMemoryLayers } from "./memory-layers.js";
import { exportRelations, importRelationsSnapshot, resetRelations } from "../data/relations.js";
import { exportProposalSnapshot, importProposalSnapshot, resetProposalStore } from "./proposal-system.js";
import { exportPredictionStores, importPredictionStores, exportDirectorLog, importDirectorLog, resetDirectorLog } from "./director.js";
import { getEventHistory, resetEventCache, importEventHistory } from "../data/random-events.js";
import { loadGlobalMemory } from "./global-memory.js";

/**
 * 导出全部引擎内存状态为可序列化对象
 * @param {Object} [extra] — { emotionState, turnCount, sceneSummary }
 * @returns {Object}
 */
export function exportEngineState(extra = {}) {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    memory: exportMemorySnapshot(),
    relations: exportRelations(),
    proposals: exportProposalSnapshot(),
    predictions: exportPredictionStores(),
    director: exportDirectorLog(),
    events: {
      history: getEventHistory()
    },
    runtime: {
      emotionState: extra.emotionState || null,
      turnCount: extra.turnCount || 0,
      sceneSummary: extra.sceneSummary || ""
    }
  };
}

export function resetEngineState() {
  resetAllMemoryLayers();
  resetRelations();
  resetProposalStore();
  importPredictionStores({});
  resetDirectorLog();
  resetEventCache();
  loadGlobalMemory({ snapshots: [], version: 2 });
}

/**
 * 从持久化快照恢复全部引擎内存状态
 * @param {Object} snapshot — exportEngineState 的输出
 */
export function importEngineState(snapshot = {}) {
  if (!snapshot || !snapshot.version) return;

  if (snapshot.memory) {
    importMemorySnapshot(snapshot.memory);
  }
  if (snapshot.relations) {
    importRelationsSnapshot(snapshot.relations);
  }
  if (snapshot.proposals) {
    importProposalSnapshot(snapshot.proposals);
  }
  if (snapshot.predictions) {
    importPredictionStores(snapshot.predictions);
  }
  if (snapshot.director) {
    importDirectorLog(snapshot.director);
  }
  // 事件历史：重置后按快照恢复（此前只重置不恢复，读档后冷却信息丢失）
  resetEventCache();
  if (snapshot.events?.history) importEventHistory(snapshot.events.history);

  return snapshot.runtime || null;
}
