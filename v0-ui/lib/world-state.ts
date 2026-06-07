/**
 * world-state.ts
 *
 * 全应用的「数据契约」中心。
 *
 * 设计目标：让所有页面/组件都不持有任何业务状态来源，只通过 useWorldState()
 * 消费。真实项目接入时，只需替换本文件底部的 `createDefaultDataSource()`
 * （改为调用后端 API / 数据库 / store），其余组件代码一行都不用动。
 *
 * 三层结构：
 *   1. 类型契约（WorldData / SystemState / 各 handler 的入参与返回）
 *   2. 纯函数（deriveIssues / isSystemOk）
 *   3. 默认数据源实现 DataSource（演示后端，可整体替换为真实实现）
 */

// ─── 连接与系统状态 ───────────────────────────────

export type SystemState = {
  llmConnected: boolean
  hermesConnected: boolean
  dmLoaded: boolean
  worldbookInjected: boolean
  /** 叙事档案是否可读写 */
  archiveOk: boolean
  /** 待处理队列长度 */
  queueCount: number
  /** LLM 连接的附加错误文案，如"服务地址不可达" */
  llmError?: string
  /** Hermes 连接的附加错误文案 */
  hermesError?: string
}

/** 从 SystemState 推导出显示给用户的异常列表（业务语言，不含技术词） */
export function deriveIssues(s: SystemState): string[] {
  const issues: string[] = []
  if (!s.llmConnected) issues.push('LLM 未连接')
  if (!s.hermesConnected) issues.push('Hermes API 未连接')
  if (!s.dmLoaded) issues.push('DM 未载入')
  if (!s.worldbookInjected) issues.push('世界书未注入')
  return issues
}

/** 正常时返回 true */
export function isSystemOk(s: SystemState): boolean {
  return deriveIssues(s).length === 0
}

// ─── 模型连接状态 ─────────────────────────────────

export type ConnStatus = 'idle' | 'testing' | 'ok' | 'error'

export type ModelConnectionState = {
  status: ConnStatus
  /** 错误时的具体原因，由外部传入，如"服务地址不可达"、"访问密钥无效" */
  errorMsg?: string
  /** 连接成功时的附加信息，如延迟 */
  latencyMs?: number
}

export type ModelConfig = {
  baseUrl: string
  apiKey: string
  model: string
}

// ─── 世界书 ───────────────────────────────────────

export type WorldBookEntry = {
  id: string
  name: string
  tag: string
  trigger: string
  on: boolean
}

export type ImportResult = {
  imported: number
  skipped: number
  overwritten: number
  entries?: WorldBookEntry[]
}

export type InjectionPreview = {
  enabledCount: number
  estimatedTokens: number
  tokenBudget: number
  /** 真正会注入 Context 的文本 */
  text: string
}

// ─── 角色与场景 ───────────────────────────────────

export type CastType = '角色' | '场景'

export type CastEntry = {
  id: string
  name: string
  type: CastType
  /** 所属模块/世界 */
  worldModule: string
  desc: string
  tags: string[]
  enabled: boolean
}

// ─── 关系网络 ─────────────────────────────────────

export type RelStrength = '强' | '中' | '弱' | '未知'
export type RelStatusChange = '稳定' | '波动' | '恶化' | '修复中'

export type RelEntry = {
  id: string
  from: string
  to: string
  relType: string
  strength: RelStrength
  statusChange: RelStatusChange
  note: string
}

// ─── 素材工坊 ─────────────────────────────────────

export type WorkshopRecognized = {
  type: string
  name: string
  hit: string
}

export type WorkshopResult = {
  recognized: WorkshopRecognized[]
  suggestions: string[]
  /** 写入世界书的条目 */
  written: { name: string; type: string }[]
}

// ─── 顶层世界数据 ─────────────────────────────────

export type WorldData = {
  worldName: string
  systemState: SystemState
  modelConfig: ModelConfig
  modelConnection: ModelConnectionState
  worldBook: WorldBookEntry[]
  cast: CastEntry[]
  relations: RelEntry[]
}

/**
 * 数据源接口：真实项目实现这个接口即可。
 * 所有异步操作返回结构化结果，而非 void/setTimeout。
 */
export type DataSource = {
  /** 读取初始世界数据（真实项目：fetch / server component 注入） */
  load(): WorldData

  /** 测试模型连接，返回真实连接结果 */
  testConnection(config: ModelConfig): Promise<ModelConnectionState>

  /** 导入世界书条目，返回真实导入统计 */
  importWorldBook(raw: string, overwrite: boolean, currentEntries?: WorldBookEntry[]): Promise<ImportResult>

  /** 生成注入预览，基于当前已启用条目 */
  previewInjection(entries: WorldBookEntry[]): InjectionPreview

  /** 素材工坊：识别 → 建议 → 写入，返回完整结果 */
  runWorkshop(material: string): Promise<WorkshopResult>
}

// ════════════════════════════════════════════════
// 默认数据源实现（演示后端）
// 真实项目：把整段替换为调用后端 API 的实现即可。
// ════════════════════════════════════════════════

export const DEFAULT_WORLD_NAME = '未命名世界'

const DEFAULT_SYSTEM: SystemState = {
  llmConnected: false,
  hermesConnected: false,
  dmLoaded: false,
  worldbookInjected: false,
  archiveOk: true,
  queueCount: 0,
}

const DEFAULT_WORLDBOOK: WorldBookEntry[] = []
const DEFAULT_CAST: CastEntry[] = []
const DEFAULT_RELATIONS: RelEntry[] = []

const TOKENS_PER_ENTRY = 140
const TOKEN_BUDGET = 600

function buildInjectionText(entries: WorldBookEntry[]): string {
  const enabled = entries.filter((e) => e.on)
  if (enabled.length === 0) return '[WORLD_BOOK]\n（当前没有启用的条目）\n[/WORLD_BOOK]'
  const body = enabled
    .map((e) => `## ${e.name}\n触发：${e.trigger}\n（此处为「${e.name}」的设定正文，将注入下一轮叙事 Context。）`)
    .join('\n\n')
  return `[WORLD_BOOK]\n${body}\n[/WORLD_BOOK]`
}

function entryFromObject(value: any, index: number): WorldBookEntry {
  return {
    id: String(value?.id || `wb-${Date.now()}-${index}`),
    name: String(value?.name || value?.title || `未命名条目 ${index + 1}`),
    tag: String(value?.tag || value?.category || value?.type || '设定'),
    trigger: Array.isArray(value?.keys)
      ? value.keys.join(' / ')
      : String(value?.trigger || value?.key || value?.keys || value?.name || value?.title || ''),
    on: value?.on !== false && value?.enabled !== false,
  }
}

function parseWorldBook(raw: string): WorldBookEntry[] {
  const text = raw.trim()
  if (!text) return []
  try {
    const parsed = JSON.parse(text)
    const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.entries) ? parsed.entries : [parsed]
    return list.map(entryFromObject)
  } catch {
    return text
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, index) => {
        const [name, tag = '设定', trigger = name] = line.split(/[|,，]/).map((part) => part.trim())
        return { id: `wb-${Date.now()}-${index}`, name: name || `未命名条目 ${index + 1}`, tag, trigger, on: true }
      })
  }
}

/**
 * 创建默认数据源。
 * 真实项目：实现同名接口，内部改为 fetch('/api/...')、数据库查询或 store 读取。
 */
export function createDefaultDataSource(): DataSource {
  return {
    load(): WorldData {
      return {
        worldName: DEFAULT_WORLD_NAME,
        systemState: DEFAULT_SYSTEM,
        modelConfig: { baseUrl: '', apiKey: '', model: 'gpt-4o' },
        modelConnection: { status: 'idle' },
        worldBook: DEFAULT_WORLDBOOK,
        cast: DEFAULT_CAST,
        relations: DEFAULT_RELATIONS,
      }
    },

    async testConnection(config: ModelConfig): Promise<ModelConnectionState> {
      // 真实项目：await fetch(config.baseUrl + '/models', { headers: { Authorization: ... } })
      // 演示实现：根据用户是否填写配置返回结构化结果（不是无条件成功）
      await delay(900)
      if (!config.baseUrl.trim()) {
        return { status: 'error', errorMsg: '请先填写服务地址' }
      }
      if (!config.apiKey.trim()) {
        return { status: 'error', errorMsg: '访问密钥为空，无法通过鉴权' }
      }
      if (!/^https?:\/\//.test(config.baseUrl.trim())) {
        return { status: 'error', errorMsg: '服务地址格式无效，需以 http(s):// 开头' }
      }
      return { status: 'ok', latencyMs: 420 }
    },

    async importWorldBook(raw: string, overwrite: boolean, currentEntries: WorldBookEntry[] = []): Promise<ImportResult> {
      const incoming = parseWorldBook(raw)
      const currentByName = new Map(currentEntries.map((entry) => [entry.name, entry]))
      let skipped = 0
      let overwritten = 0
      const next = overwrite ? [...currentEntries] : [...currentEntries]
      for (const entry of incoming) {
        const existingIndex = next.findIndex((item) => item.name === entry.name)
        if (existingIndex >= 0) {
          if (overwrite) {
            next[existingIndex] = { ...next[existingIndex], ...entry, id: next[existingIndex].id }
            overwritten++
          } else {
            skipped++
          }
          continue
        }
        if (currentByName.has(entry.name) && !overwrite) {
          skipped++
          continue
        }
        next.push(entry)
      }
      return {
        imported: Math.max(0, incoming.length - skipped - overwritten),
        skipped,
        overwritten,
        entries: next,
      }
    },

    previewInjection(entries: WorldBookEntry[]): InjectionPreview {
      const enabled = entries.filter((e) => e.on)
      return {
        enabledCount: enabled.length,
        estimatedTokens: enabled.length * TOKENS_PER_ENTRY,
        tokenBudget: TOKEN_BUDGET,
        text: buildInjectionText(entries),
      }
    },

    async runWorkshop(material: string): Promise<WorkshopResult> {
      const lines = material
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean)
      const recognized = lines.slice(0, 6).map((line, index) => ({
        type: line.includes('地点') || line.includes('场景') ? '地点' : line.includes('关系') ? '关系' : '设定',
        name: line.replace(/^[-*#\d.\s]+/, '').slice(0, 24) || `素材片段 ${index + 1}`,
        hit: `第 ${index + 1} 行`,
      }))
      const suggestions = recognized.map((item) => `建议确认「${item.name}」是否写入世界书或角色关系。`)
      return {
        recognized,
        suggestions,
        written: recognized.map((r) => ({ name: r.name, type: r.type })),
      }
    },
  }
}
