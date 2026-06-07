const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("worldTreeDesktop", {
  getConfig: () => ipcRenderer.invoke("config:get"),
  saveConfig: (update) => ipcRenderer.invoke("config:save", update),
  getSecrets: () => ipcRenderer.invoke("secrets:get"),
  saveLlmSecret: (payload) => ipcRenderer.invoke("secrets:saveLlm", payload),
  setActiveLlmSecret: (id) => ipcRenderer.invoke("secrets:setActiveLlm", id),
  getActiveLlmSecretValue: () => ipcRenderer.invoke("secrets:getActiveLlmValue"),
  getWorldbookState: () => ipcRenderer.invoke("worldbookState:get"),
  saveWorldbookState: (update) => ipcRenderer.invoke("worldbookState:save", update),
  getPowerUser: () => ipcRenderer.invoke("powerUser:get"),
  savePowerUser: (update) => ipcRenderer.invoke("powerUser:save", update),
  getEngineState: () => ipcRenderer.invoke("engine:getState"),
  saveEngineState: (update) => ipcRenderer.invoke("engine:saveState", update),
  getV0State: () => ipcRenderer.invoke("v0State:get"),
  saveV0State: (update) => ipcRenderer.invoke("v0State:save", update),
  testLlmConnection: (payload) => ipcRenderer.invoke("llm:testConnection", payload),
  searchEngineKnowledge: (payload) => ipcRenderer.invoke("engine:searchKnowledge", payload),
  searchEngineFulltext: (payload) => ipcRenderer.invoke("engine:searchFulltext", payload),
  getEngineManifest: () => ipcRenderer.invoke("engine:manifest"),
  getKnowledgeCard: (moduleId) => ipcRenderer.invoke("engine:getKnowledgeCard", moduleId),
  execEngineCommand: (payload) => ipcRenderer.invoke("engine:execCommand", payload),
  runEngineTurn: (payload) => ipcRenderer.invoke("engine:runTurn", payload),
  loadEngineModule: (payload) => ipcRenderer.invoke("engine:loadModule", payload),
  newEngineModule: (payload) => ipcRenderer.invoke("engine:newModule", payload),
  saveEngineArchive: (payload) => ipcRenderer.invoke("engine:saveArchive", payload),
  loadEngineArchive: (payload) => ipcRenderer.invoke("engine:loadArchive", payload),
  rollbackEngine: (payload) => ipcRenderer.invoke("engine:rollback", payload),
  readOverlay: (payload) => ipcRenderer.invoke("overlay:read", payload),
  writeOverlay: (payload) => ipcRenderer.invoke("overlay:write", payload),
  writeOverlayMany: (payload) => ipcRenderer.invoke("overlay:writeMany", payload),
  backupOverlay: (payload) => ipcRenderer.invoke("overlay:backup", payload),
  listOverlayAudit: () => ipcRenderer.invoke("overlay:listAudit"),
  // 🆕 v0.7.4.1 dataRoot 固定为项目内 data/，chooseRoot 保留用于数据迁移/备份恢复
  chooseRoot: () => ipcRenderer.invoke("data:chooseRoot"),
  readRoot: (rootPath) => ipcRenderer.invoke("data:readRoot", rootPath),
  saveText: (payload) => ipcRenderer.invoke("export:saveText", payload),
  appInfo: () => ipcRenderer.invoke("app:info"),
  readPersona: (fileName) => ipcRenderer.invoke("persona:read", fileName),
  importCards: () => ipcRenderer.invoke("cards:import"),
  getCreationRequirements: () => ipcRenderer.invoke("creation:getRequirements"),
  generateCreationQuestions: (payload) => ipcRenderer.invoke("creation:generateQuestions", payload),
  getCreationSummary: (payload) => ipcRenderer.invoke("creation:getSummary", payload),
  getCreationDefaults: (payload) => ipcRenderer.invoke("creation:getDefaults", payload),
  saveCreationModule: (payload) => ipcRenderer.invoke("creation:saveModule", payload),

  // 🆕 世界系统 API
  worldList: () => ipcRenderer.invoke("world:list"),
  worldNew: (payload) => ipcRenderer.invoke("world:new", payload),
  worldLoad: (payload) => ipcRenderer.invoke("world:load", payload),
  worldCopy: (payload) => ipcRenderer.invoke("world:copy", payload),
  worldDelete: (payload) => ipcRenderer.invoke("world:delete", payload),
  worldBranch: (payload) => ipcRenderer.invoke("world:branch", payload),
  worldProfiles: () => ipcRenderer.invoke("world:profiles"),

  // 🆕 v0.8.0 健康检查 + 采纳机制
  healthCheck: (payload) => ipcRenderer.invoke("health:check", payload),
  listPending: (payload) => ipcRenderer.invoke("pending:list", payload),
  adoptPending: (payload) => ipcRenderer.invoke("pending:adopt", payload),
  rejectPending: (payload) => ipcRenderer.invoke("pending:reject", payload),

  // 🆕 v2 内容系统升级 API
  // ── 内容注册表 ──
  contentRegistryList: () => ipcRenderer.invoke("contentRegistry:list"),
  contentRegistryFindById: (typeId) => ipcRenderer.invoke("contentRegistry:findById", typeId),

  // ── 提案系统 ──
  proposalList: (payload) => ipcRenderer.invoke("proposal:list", payload),
  proposalPendingConfirmations: () => ipcRenderer.invoke("proposal:pendingConfirmations"),
  proposalAdopt: (payload) => ipcRenderer.invoke("proposal:adopt", payload),
  proposalCommit: (payload) => ipcRenderer.invoke("proposal:commit", payload),
  proposalReject: (payload) => ipcRenderer.invoke("proposal:reject", payload),
  proposalReverse: (payload) => ipcRenderer.invoke("proposal:reverse", payload),
  proposalTick: (payload) => ipcRenderer.invoke("proposal:tick", payload),

  // ── 角色关系 ──
  relationsGetFor: (name) => ipcRenderer.invoke("relations:getFor", name),
  relationsSet: (payload) => ipcRenderer.invoke("relations:set", payload),
  relationsNetwork: () => ipcRenderer.invoke("relations:network"),

  // ── 时间线因果链 ──
  timelineTraceImpact: (payload) => ipcRenderer.invoke("timeline:traceImpact", payload),
  timelineTraceCauses: (payload) => ipcRenderer.invoke("timeline:traceCauses", payload),
  timelineWhatWouldChange: (payload) => ipcRenderer.invoke("timeline:whatWouldChange", payload),
  timelineEchoes: (payload) => ipcRenderer.invoke("timeline:echoes", payload),

  // ── 五层记忆 ──
  memorySearch: (payload) => ipcRenderer.invoke("memory:search", payload),
  memorySnapshot: () => ipcRenderer.invoke("memory:snapshot"),
  memorySessionSummary: () => ipcRenderer.invoke("memory:sessionSummary"),

  // ── Guardian v2 综合检查 ──
  guardianFullCheck: (payload) => ipcRenderer.invoke("guardian:fullCheck", payload),

  // 🆕 枝干系统
  branchTree: (payload) => ipcRenderer.invoke("branch:tree", payload),
  branchCreate: (payload) => ipcRenderer.invoke("branch:create", payload),
  branchMerge: (payload) => ipcRenderer.invoke("branch:merge", payload),
  branchExecuteMerge: (payload) => ipcRenderer.invoke("branch:executeMerge", payload),
  branchAbandon: (payload) => ipcRenderer.invoke("branch:abandon", payload),
  branchRevive: (payload) => ipcRenderer.invoke("branch:revive", payload),
  branchCompare: (payload) => ipcRenderer.invoke("branch:compare", payload),

  // 🆕 导演模式
  directorModes: () => ipcRenderer.invoke("director:modes"),
  directorGetMode: (modeId) => ipcRenderer.invoke("director:getMode", modeId),

  // 🆕 世界脉象
  telemetryCalculate: (payload) => ipcRenderer.invoke("telemetry:calculate", payload),
  telemetryProfile: (worldName) => ipcRenderer.invoke("telemetry:profile", { worldName }),
  telemetryRegister: (payload) => ipcRenderer.invoke("telemetry:register", payload),
  telemetryBuildPrompt: (payload) => ipcRenderer.invoke("telemetry:buildPrompt", payload),
  telemetryUserSummary: (payload) => ipcRenderer.invoke("telemetry:userSummary", payload),

  // 🆕 观测终端 v2
  openConsole: () => ipcRenderer.invoke("app:openConsole")
});
