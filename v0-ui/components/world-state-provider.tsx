'use client'

/**
 * world-state-provider.tsx
 *
 * 单一数据源。所有页面/组件通过 useWorldState() 消费世界状态与操作，
 * 不再各自硬编码任何业务值。
 *
 * 真实项目接入方式（二选一）：
 *   1. 用 server component 抓取数据，作为 `initialData` 传给 <WorldStateProvider>。
 *   2. 替换 lib/world-state.ts 里的 createDefaultDataSource()，改为调用真实后端。
 *
 * 异步操作（测试连接 / 导入 / 工坊运行）统一走 dataSource 暴露的方法，
 * 返回结构化结果，组件只负责把结果渲染出来。
 */

import { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef } from 'react'
import {
  type WorldData,
  type DataSource,
  type SystemState,
  type ModelConfig,
  type ModelConnectionState,
  type WorldBookEntry,
  type ImportResult,
  type InjectionPreview,
  type CastEntry,
  type RelEntry,
  type WorkshopResult,
  createDefaultDataSource,
  deriveIssues,
  isSystemOk,
} from '@/lib/world-state'

type WorldStateContextValue = {
  // ── 只读状态 ──
  worldName: string
  systemState: SystemState
  connectionOk: boolean
  connectionIssues: string[]
  modelConfig: ModelConfig
  modelConnection: ModelConnectionState
  worldBook: WorldBookEntry[]
  cast: CastEntry[]
  relations: RelEntry[]
  updateWorldName: (name: string) => void

  // ── 模型连接 ──
  updateModelConfig: (patch: Partial<ModelConfig>) => void
  testConnection: () => Promise<ModelConnectionState>

  // ── 世界书 ──
  toggleWorldBookEntry: (id: string) => void
  importWorldBook: (raw: string, overwrite: boolean) => Promise<ImportResult>
  previewInjection: () => InjectionPreview

  // ── 角色与场景 ──
  upsertCastEntry: (entry: Omit<CastEntry, 'id'> & { id?: string }) => void
  deleteCastEntry: (id: string) => void
  toggleCastEnabled: (id: string) => void

  // ── 关系网络 ──
  upsertRelation: (entry: Omit<RelEntry, 'id'> & { id?: string }) => void
  deleteRelation: (id: string) => void

  // ── 素材工坊 ──
  runWorkshop: (material: string) => Promise<WorkshopResult>
}

const WorldStateContext = createContext<WorldStateContextValue | null>(null)

type DesktopApi = {
  getConfig?: () => Promise<any>
  saveConfig?: (update: any) => Promise<any>
  getSecrets?: () => Promise<any>
  saveLlmSecret?: (payload: any) => Promise<any>
  getActiveLlmSecretValue?: () => Promise<string>
  getV0State?: () => Promise<Partial<WorldData> & { workshopRuns?: WorkshopResult[] }>
  saveV0State?: (update: Partial<WorldData> & { workshopRuns?: WorkshopResult[] }) => Promise<any>
  testLlmConnection?: (payload: any) => Promise<ModelConnectionState>
  worldList?: () => Promise<any[]>
}

declare global {
  interface Window {
    worldTreeDesktop?: DesktopApi
  }
}

function desktopApi(): DesktopApi | null {
  if (typeof window === 'undefined') return null
  return window.worldTreeDesktop ?? null
}

function mapConfig(config: any, apiKey = ''): ModelConfig {
  return {
    baseUrl: config?.llmBaseUrl || '',
    apiKey,
    model: config?.llmModel || '',
  }
}

function deriveSystem(data: WorldData, secretReady: boolean, hermesReady = true): SystemState {
  return {
    ...data.systemState,
    llmConnected: Boolean(data.modelConfig.baseUrl && data.modelConfig.model && secretReady),
    hermesConnected: hermesReady,
    dmLoaded: data.cast.some((entry) => entry.enabled),
    worldbookInjected: data.worldBook.some((entry) => entry.on),
    archiveOk: true,
    queueCount: data.systemState.queueCount || 0,
  }
}

async function loadDesktopData(fallback: WorldData): Promise<WorldData> {
  const api = desktopApi()
  if (!api) return fallback
  const [config, secrets, v0State, worlds] = await Promise.all([
    api.getConfig?.().catch(() => null),
    api.getSecrets?.().catch(() => null),
    api.getV0State?.().catch(() => null),
    api.worldList?.().catch(() => []),
  ])
  const activeSecret = secrets?.llm?.items?.find((item: any) => item.active)
  const worldName = v0State?.worldName || worlds?.[0]?.displayName || worlds?.[0]?.name || fallback.worldName
  const next: WorldData = {
    ...fallback,
    worldName,
    modelConfig: mapConfig(config, activeSecret?.masked ? '********' : ''),
    worldBook: Array.isArray(v0State?.worldBook) ? v0State.worldBook : [],
    cast: Array.isArray(v0State?.cast) ? v0State.cast : [],
    relations: Array.isArray(v0State?.relations) ? v0State.relations : [],
  }
  next.systemState = deriveSystem(next, Boolean(activeSecret?.masked), true)
  return next
}

function persistV0State(data: WorldData) {
  const api = desktopApi()
  if (!api?.saveV0State) return
  api.saveV0State({
    worldName: data.worldName,
    worldBook: data.worldBook,
    cast: data.cast,
    relations: data.relations,
  }).catch(() => {})
}

export function WorldStateProvider({
  children,
  initialData,
  dataSource,
}: {
  children: React.ReactNode
  /** 真实项目可由 server component 抓取后传入 */
  initialData?: WorldData
  /** 真实项目可注入自定义数据源（默认使用演示后端） */
  dataSource?: DataSource
}) {
  const source = useMemo(() => dataSource ?? createDefaultDataSource(), [dataSource])
  const [data, setData] = useState<WorldData>(() => initialData ?? source.load())

  // 用 ref 保证 async 回调读到最新 data，避免闭包过期
  const dataRef = useRef(data)
  dataRef.current = data

  useEffect(() => {
    let alive = true
    loadDesktopData(dataRef.current).then((loaded) => {
      if (alive) setData(loaded)
    })
    return () => {
      alive = false
    }
  }, [])

  // ── 模型连接 ──
  const updateModelConfig = useCallback((patch: Partial<ModelConfig>) => {
    setData((d) => {
      const next = { ...d, modelConfig: { ...d.modelConfig, ...patch } }
      next.systemState = deriveSystem(next, Boolean(next.modelConfig.apiKey), next.systemState.hermesConnected)
      return next
    })
  }, [])

  const testConnection = useCallback(async () => {
    setData((d) => ({ ...d, modelConnection: { status: 'testing' } }))
    const api = desktopApi()
    const current = dataRef.current.modelConfig
    if (api?.saveConfig) {
      await api.saveConfig({ llmBaseUrl: current.baseUrl, llmModel: current.model })
    }
    if (api?.saveLlmSecret && current.apiKey && current.apiKey !== '********') {
      await api.saveLlmSecret({ id: 'default', label: 'Default', value: current.apiKey })
    }
    const result = api?.testLlmConnection
      ? await api.testLlmConnection({
          config: { llmBaseUrl: current.baseUrl, llmModel: current.model },
          apiKey: current.apiKey === '********' ? '' : current.apiKey,
        })
      : await source.testConnection(current)
    setData((d) => {
      const next = { ...d, modelConnection: result }
      next.systemState = deriveSystem(next, result.status === 'ok' || Boolean(next.modelConfig.apiKey), next.systemState.hermesConnected)
      return next
    })
    return result
  }, [source])

  const updateWorldName = useCallback((name: string) => {
    setData((d) => {
      const next = { ...d, worldName: name.trim() || d.worldName }
      persistV0State(next)
      return next
    })
  }, [])

  // ── 世界书 ──
  const toggleWorldBookEntry = useCallback((id: string) => {
    setData((d) => {
      const next = {
        ...d,
        worldBook: d.worldBook.map((e) => (e.id === id ? { ...e, on: !e.on } : e)),
      }
      next.systemState = deriveSystem(next, Boolean(next.modelConfig.apiKey), next.systemState.hermesConnected)
      persistV0State(next)
      return next
    })
  }, [])

  const importWorldBook = useCallback(
    async (raw: string, overwrite: boolean) => {
      const result = await source.importWorldBook(raw, overwrite, dataRef.current.worldBook)
      if (result.entries) {
        setData((d) => {
          const next = { ...d, worldBook: result.entries || d.worldBook }
          next.systemState = deriveSystem(next, Boolean(next.modelConfig.apiKey), next.systemState.hermesConnected)
          persistV0State(next)
          return next
        })
      }
      return result
    },
    [source],
  )

  const previewInjection = useCallback(
    () => source.previewInjection(dataRef.current.worldBook),
    [source],
  )

  // ── 角色与场景 ──
  const upsertCastEntry = useCallback((entry: Omit<CastEntry, 'id'> & { id?: string }) => {
    setData((d) => {
      let next: WorldData
      if (entry.id && d.cast.some((c) => c.id === entry.id)) {
        next = {
          ...d,
          cast: d.cast.map((c) => (c.id === entry.id ? { ...c, ...entry, id: c.id } : c)),
        }
      } else {
        const id = entry.id ?? `cast${Date.now()}`
        next = { ...d, cast: [...d.cast, { ...entry, id }] }
      }
      next.systemState = deriveSystem(next, Boolean(next.modelConfig.apiKey), next.systemState.hermesConnected)
      persistV0State(next)
      return next
    })
  }, [])

  const deleteCastEntry = useCallback((id: string) => {
    setData((d) => {
      const next = { ...d, cast: d.cast.filter((c) => c.id !== id) }
      next.systemState = deriveSystem(next, Boolean(next.modelConfig.apiKey), next.systemState.hermesConnected)
      persistV0State(next)
      return next
    })
  }, [])

  const toggleCastEnabled = useCallback((id: string) => {
    setData((d) => {
      const next = {
        ...d,
        cast: d.cast.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c)),
      }
      next.systemState = deriveSystem(next, Boolean(next.modelConfig.apiKey), next.systemState.hermesConnected)
      persistV0State(next)
      return next
    })
  }, [])

  // ── 关系网络 ──
  const upsertRelation = useCallback((entry: Omit<RelEntry, 'id'> & { id?: string }) => {
    setData((d) => {
      let next: WorldData
      if (entry.id && d.relations.some((r) => r.id === entry.id)) {
        next = {
          ...d,
          relations: d.relations.map((r) => (r.id === entry.id ? { ...r, ...entry, id: r.id } : r)),
        }
      } else {
        const id = entry.id ?? `rel${Date.now()}`
        next = { ...d, relations: [...d.relations, { ...entry, id }] }
      }
      persistV0State(next)
      return next
    })
  }, [])

  const deleteRelation = useCallback((id: string) => {
    setData((d) => {
      const next = { ...d, relations: d.relations.filter((r) => r.id !== id) }
      persistV0State(next)
      return next
    })
  }, [])

  // ── 素材工坊 ──
  const runWorkshop = useCallback(async (material: string) => {
    const result = await source.runWorkshop(material)
    const api = desktopApi()
    if (api?.saveV0State) {
      const stored = await api.getV0State?.().catch(() => null)
      await api.saveV0State({ workshopRuns: [result, ...(stored?.workshopRuns || [])].slice(0, 20) })
    }
    return result
  }, [source])

  const value: WorldStateContextValue = {
    worldName: data.worldName,
    systemState: data.systemState,
    connectionOk: isSystemOk(data.systemState),
    connectionIssues: deriveIssues(data.systemState),
    modelConfig: data.modelConfig,
    modelConnection: data.modelConnection,
    worldBook: data.worldBook,
    cast: data.cast,
    relations: data.relations,
    updateWorldName,
    updateModelConfig,
    testConnection,
    toggleWorldBookEntry,
    importWorldBook,
    previewInjection,
    upsertCastEntry,
    deleteCastEntry,
    toggleCastEnabled,
    upsertRelation,
    deleteRelation,
    runWorkshop,
  }

  return <WorldStateContext.Provider value={value}>{children}</WorldStateContext.Provider>
}

export function useWorldState(): WorldStateContextValue {
  const ctx = useContext(WorldStateContext)
  if (!ctx) {
    throw new Error('useWorldState 必须在 <WorldStateProvider> 内使用')
  }
  return ctx
}
