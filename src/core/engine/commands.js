import { applyPreset, MODULES, MODULE_PRESETS, setModuleEnabled, normalizeEngineState } from "./modules.js";
import { isCardModeCommand, CARD_MODE_ALLOWED_COMMANDS } from "../data/character-card.js";
import { collectRuntimeSnapshot, embedRuntimeInArchive } from "./archive-state.js";
import { resetPredictionCache, getEventCache } from "./director.js";
import { resetEventCache, getEventHistory } from "../data/random-events.js";
import { runHealthCheck, formatHealthReport } from "./health-check.js";

export function classifyWorldTreeInput(input = "") {
  const text = String(input || "").trim();
  const slash = text.match(/^\/(\S+)(?:\s+(\S+))?(?:\s+([\s\S]*))?$/);
  if (!slash) return { kind: "narrative", text };
  const [, root, action = "", rest = ""] = slash;
  const category =
    root.includes("引擎") ? "engine" :
    root.includes("模块") ? "modules" :
    root.includes("世界书集") ? "worldbookset" :
    root.includes("世界书") ? "worldbook" :
    root.includes("世界状态") ? "worldstate" :
    root.includes("角色") ? "characters" :
    root.includes("场景") ? "scene" :
    root.includes("预设") ? "preset" :
    root.includes("组织") ? "organization" :
    root.includes("存档") || root.includes("读档") ? "archive" :
    root.includes("分支") ? "branch" :
    root.includes("规则") ? "rules" :
    root.includes("审查") ? "quality" :
    root.includes("推进") ? "advance" :
    root.includes("处理") || root.includes("搜集") || root.includes("发现") || root.includes("补全") || root.includes("推理") ? "processing" :
    root.includes("时间") ? "time" :
    root.includes("随机") ? "random" :
    root.includes("预测") ? "prediction" :
    root.includes("认知") ? "cognition" :
    root.includes("追踪") ? "tracking" :
    root.includes("摘要") ? "summary" :
    root.includes("压缩") ? "compress" :
    root.includes("上下文") ? "compress" :
    root.includes("隔离") ? "isolation" :
    root.includes("素材") ? "material" :
    root.includes("插件") ? "plugin" :
    root.includes("创作") ? "creation" :
    root.includes("回滚") ? "rollback" :
    root.includes("世界") ? "world" : "slash";
  return { kind: "slash", root, action, rest, command: `/${root}${action ? ` ${action}` : ""}`, category, text };
}

function commandPatch(type, payload) {
  return { type, payload, createdAt: new Date().toISOString() };
}

export function execSlashCommand({ input, engineState, model }) {
  const intent = classifyWorldTreeInput(input);
  if (intent.kind !== "slash") return { handled: false, intent };

  const state = normalizeEngineState(engineState);
  const dataMode = state.dataMode || "worldbook";

  // ═══ 角色卡模式：拦截非允许指令 ═══
  if (dataMode === "character_card" && !isCardModeCommand(intent.category)) {
    return {
      handled: true,
      intent,
      narrative: `角色卡模式下「${intent.text}」不可用。DM 已隐退，仅保留基础指令。可用：/存档 /读档 /存档列表 /场景 /角色 show /分支 /引擎 status。`,
      patch: commandPatch("card-mode-blocked", { command: intent.text, reason: "character_card mode restricts commands" })
    };
  }

  const modName = intent.rest || "";

  // ===== 引擎 =====
  if (intent.category === "engine") {
    if (intent.action === "status") {
      return { handled: true, intent,
        narrative: `引擎状态：v12.19-desktop | ${state.status || "ready"} | 数据模式：${state.dataMode || "worldbook"} | 活跃模块：${(state.activeModules || []).join(", ")} | 预设：${state.preset} | 模组：${model.selected?.name || model.selected?.id || "未加载"}`,
        patch: commandPatch("engine-status", { engineState: state })
      };
    }
    if (intent.action === "load") {
      return { handled: true, intent,
        narrative: `加载模组：${modName || "未指定"}。Desktop 读取原始数据层并叠加 data/engine/ overlay。`,
        patch: commandPatch("engine-load", { module: modName })
      };
    }
    if (intent.action === "new") {
      return { handled: true, intent,
        narrative: `创建新模组：${modName || "未命名模组"}。Desktop 在 data/engine/ 中建立运行层，不覆盖核心 JSON。`,
        patch: commandPatch("engine-new", { module: modName })
      };
    }
    if (intent.action === "exit") {
      return { handled: true, intent,
        narrative: "引擎退出。所有运行时数据已保存到 overlay。",
        patch: commandPatch("engine-exit", {}),
        engineState: { ...state, status: "idle" }
      };
    }
    if (intent.action === "health") {
      const healthResult = runHealthCheck(model);
      const report = formatHealthReport(healthResult);
      return { handled: true, intent,
        narrative: report,
        patch: commandPatch("engine-health", { result: healthResult })
      };
    }
  }

  // ===== 模块 =====
  if (intent.category === "modules") {
    if (intent.action === "list") {
      const active = new Set(state.activeModules || []);
      return { handled: true, intent,
        narrative: MODULES.map((mod) => `${active.has(mod.id) ? "[ON] " : "[OFF]"} ${mod.id} ${mod.name}${mod.dependsOn.length ? ` (依赖: ${mod.dependsOn.join(",")})` : ""}`).join("\n"),
        patch: commandPatch("module-list", {})
      };
    }
    if (intent.action === "on" || intent.action === "off") {
      const next = setModuleEnabled(state, intent.rest.trim(), intent.action === "on");
      return { handled: true, intent,
        engineState: next,
        narrative: `${intent.rest.trim()} 已${intent.action === "on" ? "激活" : "关闭"}。依赖关系已自动处理。活跃模块：${next.activeModules.join(", ")}`,
        patch: commandPatch("module-toggle", { moduleId: intent.rest.trim(), enabled: intent.action === "on" })
      };
    }
    if (intent.action === "preset") {
      const preset = intent.rest.trim() || "epic";
      const next = applyPreset(state, preset);
      return { handled: true, intent,
        engineState: next,
        narrative: `模块预设切换为 ${preset}。活跃模块：${next.activeModules.join(", ")}`,
        patch: commandPatch("module-preset", { preset })
      };
    }
    if (intent.action === "all") {
      return { handled: true, intent,
        engineState: applyPreset(state, "all"),
        narrative: `全部模块已激活。`,
        patch: commandPatch("module-all", {})
      };
    }
    if (intent.action === "minimal") {
      return { handled: true, intent,
        engineState: applyPreset(state, "minimal"),
        narrative: `最小模块集已激活。`,
        patch: commandPatch("module-minimal", {})
      };
    }
  }

  // ===== 世界书 =====
  if (intent.category === "worldbook") {
    if (intent.action === "add") {
      const parts = modName.split(":").map((s) => s.trim());
      return { handled: true, intent,
        narrative: `世界书条目提案已生成：key="${parts[0] || ""}"。下一轮 LLM 生成标记段时将作为【世界书提案】注入。`,
        patch: commandPatch("worldbook-add", { keys: [parts[0] || ""], content: parts.slice(1).join(":") || "(等待生成)" })
      };
    }
    if (intent.action === "list") {
      const wb = model.moduleData?.worldbook?.entries || model.moduleData?.worldbook || {};
      const entries = Array.isArray(wb) ? wb : Object.values(wb);
      return { handled: true, intent,
        narrative: entries.length ? entries.map((e, i) => `${i + 1}. [${e.keys?.join(",") || ""}] ${e.title || e.comment || ""}`).join("\n") : "当前世界书为空。",
        patch: commandPatch("worldbook-list", { count: entries.length })
      };
    }
    if (intent.action === "show" && modName) {
      return { handled: true, intent,
        narrative: `世界书条目：${modName}。完整内容见下一轮。`,
        patch: commandPatch("worldbook-show", { name: modName })
      };
    }
    if (intent.action === "remove" && modName) {
      return { handled: true, intent,
        narrative: `世界书条目 "${modName}" 标记为删除。此操作将通过 overlay 写入。`,
        patch: commandPatch("worldbook-remove", { name: modName })
      };
    }
    if (intent.action === "mode" || intent.action === "layer" || intent.action === "depth" || intent.action === "match" || intent.action === "match-mode") {
      return { handled: true, intent,
        narrative: `${intent.text}：条目 "${modName}" 的参数变更将通过 overlay 写入。`,
        patch: commandPatch("worldbook-config", { command: intent.text, name: modName })
      };
    }
    if (intent.action === "stats") {
      return { handled: true, intent,
        narrative: "世界书统计通过 LLM 引擎下一轮输出【世界书提案】标记段生成。",
        patch: commandPatch("worldbook-stats", {})
      };
    }
    if (intent.action === "suggest") {
      return { handled: true, intent,
        narrative: "世界书拓展建议将通过 LLM 分析当前条目后生成。",
        patch: commandPatch("worldbook-suggest", {})
      };
    }
  }

  // ===== 世界书集 =====
  if (intent.category === "worldbookset") {
    if (intent.action === "list") {
      const modules = model.modules || [];
      return { handled: true, intent,
        narrative: modules.length ? modules.map((m, i) => `${i + 1}. ${m.name || m.id} [${m.branch || "main"}]`).join("\n") : "尚无模组。",
        patch: commandPatch("worldbookset-list", { count: modules.length })
      };
    }
    if (intent.action === "switch" || intent.action === "now" || intent.action === "create" || intent.action === "delete" || intent.action === "rename") {
      return { handled: true, intent,
        narrative: `${intent.text}：操作通过 overlay 执行。`,
        patch: commandPatch("worldbookset-op", { command: intent.text })
      };
    }
  }

  // ===== 场景 =====
  if (intent.category === "scene") {
    if (intent.action === "now") {
      const scene = model.moduleData?.scenes?.[0];
      return { handled: true, intent,
        narrative: scene ? `当前场景：${scene.title} | 地点：${scene.location || "未知"} | 时间：${scene.time || "未知"} | 摘要：${scene.summary || "无"}` : "未加载场景数据。",
        patch: commandPatch("scene-now", { scene })
      };
    }
    if (intent.action === "move") {
      return { handled: true, intent,
        narrative: `场景切换至：${modName || "新地点"}。切换后新场景将重新扫描世界书并追加摘要链。`,
        patch: commandPatch("scene-move", { location: modName })
      };
    }
    if (intent.action === "summary" || intent.action === "chain") {
      const scenes = model.moduleData?.scenes || [];
      return { handled: true, intent,
        narrative: scenes.slice(0, 8).map((s, i) => `${i + 1}. ${s.title}${s.time ? ` / ${s.time}` : ""}\n   ${s.summary || "(无摘要)"}`).join("\n") || "暂无场景链。",
        patch: commandPatch("scene-chain", { count: scenes.length })
      };
    }
  }

  // ===== 角色 =====
  if (intent.category === "characters") {
    if (intent.action === "list") {
      const chars = model.moduleData?.characters || [];
      return { handled: true, intent,
        narrative: chars.length ? chars.map((c, i) => `${i + 1}. ${c.name}${c.role ? ` / ${c.role}` : ""}${c.status ? ` / ${c.status}` : ""}${c.location ? ` @${c.location}` : ""}`).join("\n") : "暂无角色。",
        patch: commandPatch("characters-list", { count: chars.length })
      };
    }
    if (intent.action === "show") {
      return { handled: true, intent,
        narrative: `角色详情：${modName}。完整信息通过 LLM 生成标记段输出。`,
        patch: commandPatch("characters-show", { name: modName })
      };
    }
    if (intent.action === "create") {
      return { handled: true, intent,
        narrative: `角色 "${modName}" 创建提案已记录。LLM 将在标记段中生成完整角色卡。`,
        patch: commandPatch("characters-create", { name: modName })
      };
    }
    if (intent.action === "use") {
      return { handled: true, intent,
        narrative: `切换操控角色为：${modName}。如角色属于其他世界书，自动触发世界书切换。`,
        patch: commandPatch("characters-use", { name: modName })
      };
    }
    if (intent.action === "delete" || intent.action === "edit" || intent.action === "link" || intent.action === "export" || intent.action === "load") {
      return { handled: true, intent,
        narrative: `${intent.text}：操作通过 overlay 执行。`,
        patch: commandPatch("characters-op", { command: intent.text })
      };
    }
  }

  // ===== 存档 =====
  if (intent.category === "archive") {
    const mode = state.dataMode || "worldbook";
    const modePrefix = mode === "character_card" ? "[C]" : mode === "preset" ? "[P]" : "[W]";

    if (intent.action === "list" || intent.root.includes("存档列表")) {
      // 按模式分组展示
      const all = model.moduleData?.archives || [];
      const wb = all.filter((a) => !a.name?.startsWith("[C]") && !a.name?.startsWith("[P]"));
      const cc = all.filter((a) => a.name?.startsWith("[C]"));
      const pr = all.filter((a) => a.name?.startsWith("[P]"));
      const parts = [];
      if (wb.length) parts.push(`【世界书】\n${wb.map((a,i) => `${i+1}. ${a.name} | ${a.createdAt||""} | ${a.summary||""}`).join("\n")}`);
      if (cc.length) parts.push(`【角色卡】\n${cc.map((a,i) => `${i+1}. ${a.name} | ${a.createdAt||""} | ${a.summary||""}`).join("\n")}`);
      if (pr.length) parts.push(`【预设模式】\n${pr.map((a,i) => `${i+1}. ${a.name} | ${a.createdAt||""} | ${a.summary||""}`).join("\n")}`);
      return { handled: true, intent,
        narrative: parts.length ? parts.join("\n\n") : "暂无存档。",
        patch: commandPatch("archive-list", { count: all.length, grouped: { worldbook: wb.length, character_card: cc.length, preset: pr.length } })
      };
    }
    if (intent.root.includes("存档") && !intent.root.includes("列表") && !intent.root.includes("delete")) {
      // /存档 [名称] — 收集运行时快照，嵌入存档
      const rawName = modName || intent.action || `auto-${Date.now()}`;
      const prefixedName = rawName.startsWith("[W]") || rawName.startsWith("[C]") || rawName.startsWith("[P]")
        ? rawName : `${modePrefix}${rawName}`;

      // 收集当前运行时状态（情绪/缓存/事件历史）
      const runtimeSnapshot = collectRuntimeSnapshot(state, {
        predictionCache: getEventCache(),
        eventHistory: getEventHistory()
      });

      return { handled: true, intent,
        narrative: `存档 "${prefixedName}"（${mode}模式）已保存。运行时状态已嵌入存档，重新加载时将精确恢复。`,
        patch: commandPatch("archive-save", {
          name: prefixedName,
          dataMode: mode,
          overlayPath: `data/engine/runs/${mode}/archives/${prefixedName}.json`,
          runtimeSnapshot  // 🆕 嵌入运行时快照
        })
      };
    }
    if (intent.root.includes("读档")) {
      const loadName = modName || intent.action || "";
      // 清理跨存档缓存
      resetPredictionCache();
      resetEventCache();
      return { handled: true, intent,
        narrative: `${mode}模式：读档 "${loadName}"。引擎将从存档恢复完整运行时状态（情绪/事件/缓存），跨存档数据已清理。`,
        patch: commandPatch("archive-load", { name: loadName, currentMode: mode })
      };
    }
    if (intent.root.includes("delete")) {
      return { handled: true, intent,
        narrative: `存档 "${modName}" 标记为删除。`,
        patch: commandPatch("archive-delete", { name: modName })
      };
    }
  }

  // ===== 分支 =====
  if (intent.category === "branch") {
    if (intent.action === "list") {
      const branches = model.moduleData?.branches || [];
      return { handled: true, intent,
        narrative: branches.length ? branches.map((b) => `${b.active ? "★ " : "  "}${b.id}`).join("\n") : "仅主分支 (main)。",
        patch: commandPatch("branch-list", { branches })
      };
    }
    return { handled: true, intent,
      narrative: `${intent.text}：跨分支操作通过 overlay 管理。`,
      patch: commandPatch("branch-op", { command: intent.text })
    };
  }

  // ===== 时间 =====
  if (intent.category === "time") {
    if (intent.action === "now") {
      const time = model.moduleData?.timeline || {};
      return { handled: true, intent,
        narrative: `当前时间：${time.current || time.time || time.updatedAt || "未设定"} | 历法：${time.calendar || "默认"}`,
        patch: commandPatch("time-now", { time })
      };
    }
    if (intent.action === "skip") {
      return { handled: true, intent,
        narrative: `时间跳过 ${modName}。引擎将推进时间轴并在下一轮标记段中更新【状态】。`,
        patch: commandPatch("time-skip", { amount: modName })
      };
    }
    if (intent.action === "timeline" || intent.action === "where" || intent.action === "check" || intent.action === "speed" || intent.action === "set") {
      return { handled: true, intent,
        narrative: `${intent.text}：通过 LLM 引擎分析时间轴后生成结果。`,
        patch: commandPatch("time-op", { command: intent.text })
      };
    }
  }

  // ===== 规则 & 审查 =====
  if (intent.category === "rules" || intent.category === "quality") {
    return { handled: true, intent,
      narrative: `${intent.text}：规则/审查操作的结果将通过 LLM 标记段或引擎审计日志返回。`,
      patch: commandPatch("rule-op", { command: intent.text })
    };
  }

  // ===== 推进 =====
  if (intent.category === "advance") {
    return { handled: true, intent,
      narrative: "推进剧情——引擎将在下一轮叙事中主动引导场景转换或事件发展。",
      patch: commandPatch("advance", {})
    };
  }

  // ===== 随机 =====
  if (intent.category === "random") {
    if (intent.action === "trigger") {
      return { handled: true, intent,
        narrative: `手动触发随机事件：${modName || "按默认权重"}。`,
        patch: commandPatch("random-trigger", { level: modName })
      };
    }
    return { handled: true, intent,
      narrative: `${intent.text}：随机事件配置通过 overlay 管理。`,
      patch: commandPatch("random-op", { command: intent.text })
    };
  }

  // ===== 认知 =====
  if (intent.category === "cognition") {
    if (intent.action === "show") {
      const char = model.moduleData?.characters?.find((c) => c.name === modName || c.id === modName) || model.moduleData?.characters?.[0];
      return { handled: true, intent,
        narrative: char ? `角色 ${char.name} 的认知边界：已知${(char.known || []).length || 0}条，秘密${(char.secrets || []).length || 0}条。` : "需指定角色名。",
        patch: commandPatch("cognition-show", { name: modName })
      };
    }
    return { handled: true, intent,
      narrative: `${intent.text}：认知层操作通过 LLM 生成标记段中的【角色】段更新。`,
      patch: commandPatch("cognition-op", { command: intent.text })
    };
  }

  // ===== 预设 =====
  if (intent.category === "preset" || intent.root.includes("预设")) {
    if (intent.action === "list") {
      const presets = Object.keys(MODULE_PRESETS).filter((k) => k !== "all");
      return { handled: true, intent,
        narrative: presets.map((p) => `${p === state.preset ? "★ " : "  "}${p}: ${MODULE_PRESETS[p].join(",")}`).join("\n"),
        patch: commandPatch("preset-list", { current: state.preset })
      };
    }
    if (intent.action === "use" || intent.action === "switch") {
      const next = applyPreset(state, modName || state.preset);
      return { handled: true, intent,
        engineState: next,
        narrative: `预设切换为 ${modName || state.preset}。活跃模块：${next.activeModules.join(", ")}`,
        patch: commandPatch("preset-use", { preset: modName })
      };
    }
    if (intent.action === "status") {
      return { handled: true, intent,
        narrative: `当前预设：${state.preset} | 活跃模块：${(state.activeModules || []).join(", ")} | 模式：${state.dataMode}`,
        patch: commandPatch("preset-status", { preset: state.preset, dataMode: state.dataMode })
      };
    }
    return { handled: true, intent,
      narrative: `${intent.text}：预设操作通过 overlay 管理。可用子命令：list/use/switch/status。`,
      patch: commandPatch("preset-op", { command: intent.text })
    };
  }

  // ===== 组织 (M4-M7, M10) =====
  if (intent.category === "organization" || intent.root.includes("组织")) {
    if (intent.action === "list") {
      const orgs = model.moduleData?.organizations || [];
      return { handled: true, intent,
        narrative: orgs.length ? orgs.map((o, i) => `${i + 1}. ${o.name}${o.hierarchy ? ` / ${o.hierarchy}` : ""}`).join("\n") : "暂无组织数据。",
        patch: commandPatch("org-list", { count: orgs.length })
      };
    }
    if (intent.action === "show") {
      return { handled: true, intent,
        narrative: `组织详情：${modName}。完整信息通过 LLM 生成标记段输出。`,
        patch: commandPatch("org-show", { name: modName })
      };
    }
    return { handled: true, intent,
      narrative: `${intent.text}：组织操作通过 overlay 管理。可用子命令：list/show。`,
      patch: commandPatch("org-op", { command: intent.text })
    };
  }

  // ===== 世界状态 (M3) =====
  if (intent.category === "worldstate" || intent.root.includes("世界状态")) {
    if (intent.action === "list" || intent.action === "show") {
      const ws = model.moduleData?.worldState || {};
      return { handled: true, intent,
        narrative: `世界状态变量：${Object.keys(ws.variables || {}).join(", ") || "暂无"} | 事件数：${(ws.events || []).length}`,
        patch: commandPatch("worldstate-list", { count: Object.keys(ws.variables || {}).length })
      };
    }
    return { handled: true, intent,
      narrative: `${intent.text}：世界状态操作通过 LLM 标记段【状态】更新。`,
      patch: commandPatch("worldstate-op", { command: intent.text })
    };
  }

  // ===== 追踪 =====
  if (intent.category === "tracking" || intent.root.includes("追踪")) {
    if (intent.action === "status" || !intent.action) {
      const tracking = model.moduleData?.tracking || [];
      return { handled: true, intent,
        narrative: tracking.length ? tracking.map((t) => `- ${t.name || t.id}: ${t.count || 0}`).join("\n") : "暂无追踪数据。",
        patch: commandPatch("tracking-status", { items: tracking.map((t) => ({ name: t.name || t.id, count: t.count || 0 })) })
      };
    }
    return { handled: true, intent,
      narrative: `${intent.text}：追踪数据通过 overlay 管理。可用子命令：status。`,
      patch: commandPatch("tracking-op", { command: intent.text })
    };
  }

  // ===== 素材 =====
  if (intent.category === "material" || intent.root.includes("素材")) {
    return { handled: true, intent,
      narrative: `${intent.text}：素材系统（提取/检索/应用/搜集/筛选）当前通过 Desktop overlay + LLM 引擎协作执行。完整实现见下一步规划。`,
      patch: commandPatch("material-op", { command: intent.text })
    };
  }

  // ===== 上下文 =====
  if (intent.category === "compress" || intent.category === "summary" || intent.root.includes("压缩") || intent.root.includes("上下文")) {
    if (intent.action === "show") {
      const scenes = model.moduleData?.scenes || [];
      return { handled: true, intent,
        narrative: `当前场景链 ${scenes.length} 条 | 上下文档位：${state.contextBudget || "balanced"}`,
        patch: commandPatch("context-show", { scenes: scenes.length, budget: state.contextBudget })
      };
    }
    if (intent.action === "depth") {
      return { handled: true, intent,
        narrative: `场景摘要深度设置为 ${modName || 5}。后续叙事将只保留最近 ${modName || 5} 条摘要。`,
        patch: commandPatch("context-depth", { depth: modName })
      };
    }
    return { handled: true, intent,
      narrative: `${intent.text}：上下文管理通过 Desktop 场景链旋转和场景摘要机制执行。`,
      patch: commandPatch("context-op", { command: intent.text })
    };
  }

  // ===== 隔离 =====
  if (intent.category === "isolation" || intent.root.includes("隔离")) {
    if (intent.action === "status") {
      return { handled: true, intent,
        narrative: `当前模组隔离状态：${model.selected?.name || "未加载"} | 分支：${model.selected?.branch || "main"} | 数据模式：${state.dataMode}`,
        patch: commandPatch("isolation-status", { module: model.selected?.name, branch: model.selected?.branch, dataMode: state.dataMode })
      };
    }
    return { handled: true, intent,
      narrative: `${intent.text}：M1 世界书隔离容器已激活。跨模组数据泄露由守门人自动阻断。`,
      patch: commandPatch("isolation-op", { command: intent.text })
    };
  }

  // ===== 插件 =====
  if (intent.category === "plugin" || intent.root.includes("插件")) {
    if (intent.action === "list") {
      return { handled: true, intent,
        narrative: `当前 Desktop 引擎内建模块（M1-M19 + M-创作）即为可用的「插件」。使用 /模块 list 查看完整清单。`,
        patch: commandPatch("plugin-list", { builtin: MODULES.length })
      };
    }
    return { handled: true, intent,
      narrative: `${intent.text}：Desktop 引擎通过模块系统（M1-M19 + M-创作）实现插件化。使用 /模块 系列指令管理。`,
      patch: commandPatch("plugin-op", { command: intent.text })
    };
  }

  // ===== M-创作 工具箱 =====
  if (intent.category === "creation" || intent.root.includes("创作")) {
    return { handled: true, intent,
      narrative: `M-创作工具箱已激活。支持：创作七步法、十大原则、8张技术卡片（人物锚点/结局架构/叙事密度/留白指南/小物件/开局设计/信息分层/触发与位置策略）。使用 /模块 on M-创作 激活后，可通过 LLM 引擎调用。`,
      patch: commandPatch("creation-op", { command: intent.text })
    };
  }

  // ===== 世界（Minecraft 式世界管理） =====
  if (intent.category === "world") {
    const action = intent.action || "";
    const worldName = intent.rest?.trim() || "";

    if (action === "list" || action === "ls") {
      // 【世界 list】— 应由 main.cjs 提供真实的 fs 列表
      return { handled: true, intent,
        narrative: "【世界列表】功能需要 Electron 主进程（main.cjs）实现文件系统读取。Desktop 当前会话中可用 /引擎 load 加载已有模组。",
        patch: commandPatch("world-list", {})
      };
    }
    if (action === "new" || action === "create") {
      if (!worldName) {
        return { handled: true, intent,
          narrative: "请指定世界名称，例如：/世界 new 艾尔德兰",
          patch: commandPatch("world-new", {})
        };
      }
      return { handled: true, intent,
        narrative: `新世界「${worldName}」已创建。世界目录：data/engine/worlds/${encodeURIComponent(worldName)}/。这是完整自包含的世界——所有数据、情绪、缓存都将自动保存在此文件夹中。`,
        patch: commandPatch("world-new", { name: worldName, mode: state.dataMode || "worldbook" })
      };
    }
    if (action === "load" || (!action && worldName)) {
      const target = action === "load" ? worldName : (intent.root?.replace("世界", "").trim() || worldName);
      if (!target) {
        return { handled: true, intent,
          narrative: "请指定要加载的世界名称，例如：/世界 load 艾尔德兰",
          patch: commandPatch("world-load", {})
        };
      }
      // 清理跨世界缓存
      resetPredictionCache();
      resetEventCache();
      return { handled: true, intent,
        narrative: `正在加载世界「${target}」。引擎将从 data/engine/worlds/${encodeURIComponent(target)}/ 恢复完整世界状态。跨世界缓存已清理。`,
        patch: commandPatch("world-load", { name: target })
      };
    }
    if (action === "delete" || action === "remove") {
      return { handled: true, intent,
        narrative: `世界「${worldName}」标记为删除。该操作不可逆，世界文件夹和所有数据将被移除。`,
        patch: commandPatch("world-delete", { name: worldName })
      };
    }
    // /世界 复制 <源> <目标> — 整个世界文件夹克隆
    if (action === "复制" || action === "copy" || action === "clone") {
      const parts = worldName.split(/\s+/);
      const source = parts[0] || "";
      const target = parts[1] || `${source}_分歧_${Date.now()}`;
      const label = parts.slice(2).join(" ") || "";
      if (!source) {
        return { handled: true, intent,
          narrative: "请指定要复制的世界名。格式：/世界 复制 <源世界> <新世界名> [标注]",
          patch: commandPatch("world-copy", {})
        };
      }
      return { handled: true, intent,
        narrative: `正在复制世界「${source}」→「${target}」。这是整个文件夹的完整克隆——情绪、缓存、记忆、叙事分支全部复制。两个世界从此完全独立。标注：${label || "无"}`,
        patch: commandPatch("world-copy", { source, target, label })
      };
    }
    // /世界 分支 <世界名> — 查看该世界的分支树
    if (action === "分支" || action === "branch" || action === "tree") {
      return { handled: true, intent,
        narrative: `分支树查询：${worldName || "当前世界"}。此功能需要 Electron 主进程提供文件系统支持。`,
        patch: commandPatch("world-branch", { worldName })
      };
    }
    return { handled: true, intent,
      narrative: `世界指令：${intent.text}。可用指令：/世界 list, /世界 new <名称>, /世界 load <名称>, /世界 delete <名称>。`,
      patch: commandPatch("world-op", { command: intent.text })
    };
  }

  // 默认兜底
  return {
    handled: true,
    intent,
    narrative: `已识别 ${intent.category} 指令：${intent.text}。该指令结果将通过 LLM 引擎协议生成并写入 Desktop overlay。`,
    patch: commandPatch("slash-command", { intent })
  };
}
