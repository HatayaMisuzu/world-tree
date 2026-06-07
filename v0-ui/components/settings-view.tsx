'use client'

import { useEffect, useState } from 'react'
import { PageShell } from '@/components/page-shell'
import {
  ChevronIcon,
  UploadIcon,
  SparkleIcon,
  PlusIcon,
  EyeIcon,
  CheckIcon,
  XIcon,
  AlertIcon,
  EditIcon,
  TrashIcon,
} from '@/components/icons'
import { cn } from '@/lib/utils'
import {
  type CastEntry,
  type CastType,
  type RelEntry,
  type RelStrength,
  type RelStatusChange,
  type WorkshopResult,
  type ImportResult,
  type InjectionPreview,
} from '@/lib/world-state'
import { useWorldState } from '@/components/world-state-provider'

type SectionId =
  | 'general'
  | 'model'
  | 'style'
  | 'worldbook'
  | 'cast'
  | 'relations'
  | 'workshop'
  | 'advanced'

const nav: { id: SectionId; label: string }[] = [
  { id: 'general', label: '通用设置' },
  { id: 'model', label: '模型连接' },
  { id: 'style', label: '叙事与引擎' },
  { id: 'worldbook', label: '世界书' },
  { id: 'cast', label: '角色与场景' },
  { id: 'relations', label: '关系网络' },
  { id: 'workshop', label: '素材工坊' },
  { id: 'advanced', label: '高级' },
]

export function SettingsView({
  initialSection,
}: {
  initialSection?: string
}) {
  const { worldName } = useWorldState()
  const valid = nav.some((n) => n.id === initialSection)
  const [active, setActive] = useState<SectionId>(
    valid ? (initialSection as SectionId) : 'general',
  )

  useEffect(() => {
    const section = new URLSearchParams(window.location.search).get('section')
    if (nav.some((n) => n.id === section)) {
      setActive(section as SectionId)
    }
  }, [])

  return (
    <PageShell worldName={worldName} statusText="世界设定 · 根脉编织">
      <div className="flex flex-1 overflow-hidden">
        {/* 左侧分区导航 */}
        <aside className="hidden w-52 shrink-0 flex-col border-r border-border/60 bg-sidebar/60 px-3 py-5 md:flex">
          <p className="px-2 pb-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            世界设定
          </p>
          <nav className="flex flex-col gap-0.5">
            {nav.map((n) => (
              <button
                key={n.id}
                onClick={() => setActive(n.id)}
                className={cn(
                  'rounded-lg px-3 py-2 text-left font-serif text-sm transition-colors',
                  active === n.id
                    ? 'bg-card text-foreground gold-hairline'
                    : 'text-muted-foreground hover:bg-card/70 hover:text-foreground',
                )}
              >
                {n.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* 内容区 */}
        <main className="flex-1 overflow-y-auto px-5 py-6 md:px-10">
          {/* 移动端分区切换 */}
          <div className="mb-5 flex gap-2 overflow-x-auto pb-1 md:hidden">
            {nav.map((n) => (
              <button
                key={n.id}
                onClick={() => setActive(n.id)}
                className={cn(
                  'shrink-0 rounded-full border px-3 py-1.5 text-xs font-serif',
                  active === n.id
                    ? 'border-gold/50 bg-card text-foreground'
                    : 'border-border/60 text-muted-foreground',
                )}
              >
                {n.label}
              </button>
            ))}
          </div>

          <div className="mx-auto max-w-2xl">
            {active === 'general' && <GeneralSection worldName={worldName} />}
            {active === 'model' && <ModelSection />}
            {active === 'style' && <StyleSection />}
            {active === 'worldbook' && <WorldBookSection />}
            {active === 'cast' && <CastSection worldName={worldName} />}
            {active === 'relations' && <RelationsSection />}
            {active === 'workshop' && <WorkshopSection />}
            {active === 'advanced' && <AdvancedSection />}
          </div>
        </main>
      </div>
    </PageShell>
  )
}

/* ─────────── 共用子组件 ─────────── */

function SectionTitle({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="mb-6">
      <h1 className="font-serif text-xl font-medium text-foreground">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
    </div>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  )
}

const inputCls =
  'w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-gold/60'

function Toggle({ defaultOn }: { defaultOn?: boolean }) {
  const [on, setOn] = useState(defaultOn ?? false)
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => setOn((v) => !v)}
      className={cn(
        'relative h-6 w-11 shrink-0 rounded-full transition-colors',
        on ? 'bg-primary' : 'bg-input',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 size-5 rounded-full bg-card shadow-sm transition-transform',
          on ? 'translate-x-5' : 'translate-x-0.5',
        )}
      />
    </button>
  )
}

function FeedbackBanner({
  state,
}: {
  state: 'idle' | 'loading' | 'ok' | 'error'
}) {
  if (state === 'idle') return null
  if (state === 'loading')
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-secondary/60 px-4 py-2.5 text-sm text-muted-foreground">
        <span className="size-2 animate-pulse rounded-full bg-gold" />
        处理中…
      </div>
    )
  if (state === 'ok')
    return (
      <div className="flex items-center gap-2 rounded-lg border border-moss/40 bg-primary/8 px-4 py-2.5 text-sm text-moss">
        <CheckIcon className="size-4" />
        操作成功
      </div>
    )
  return (
    <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/8 px-4 py-2.5 text-sm text-destructive">
      <AlertIcon className="size-4" />
      操作失败，请检查配置后重试
    </div>
  )
}

/* ─────────── 通用设置 ─────────── */

function GeneralSection({ worldName }: { worldName: string }) {
  const { updateWorldName } = useWorldState()
  const [name, setName] = useState(worldName)
  const [saved, setSaved] = useState<'idle' | 'ok'>('idle')
  useEffect(() => {
    setName(worldName)
  }, [worldName])
  function handleSave() {
    updateWorldName(name)
    setSaved('ok')
    setTimeout(() => setSaved('idle'), 2000)
  }
  return (
    <div>
      <SectionTitle title="通用设置" desc="为你的世界命名，设定它的基调与语言。" />
      <div className="flex flex-col gap-5 rounded-xl border border-border/70 bg-card/60 p-5">
        <Field label="世界名称">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="世界一句话简介" hint="将作为开篇引导与记忆摘要的基调。">
          <input
            className={inputCls}
            placeholder="可选：写一句话描述这个世界"
          />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="叙事语言">
            <select className={inputCls} defaultValue="zh">
              <option value="zh">简体中文</option>
              <option value="en">English</option>
            </select>
          </Field>
          <Field label="时间流速">
            <select className={inputCls} defaultValue="normal">
              <option value="slow">缓慢 · 重氛围</option>
              <option value="normal">常规</option>
              <option value="fast">迅捷 · 重剧情</option>
            </select>
          </Field>
        </div>
        {saved === 'ok' && (
          <div className="flex items-center gap-2 rounded-lg border border-moss/40 bg-primary/8 px-4 py-2.5 text-sm text-moss">
            <CheckIcon className="size-4" />
            设置已保存
          </div>
        )}
        <div className="flex justify-end pt-1">
          <button
            onClick={handleSave}
            className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground transition-colors hover:bg-primary/90"
          >
            保存设置
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─────────── 模型连接 ─────────── */

function ModelSection() {
  /**
   * 配置与连接状态全部来自 Provider（单一数据源）。
   * 「测试连接」调用 Provider 的 async testConnection()，由数据源返回真实结构化结果，
   * 组件只负责渲染结果，不再自造成功/失败。
   */
  const { modelConfig, modelConnection, updateModelConfig, testConnection } = useWorldState()
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)

  const connStatus = testing ? 'testing' : modelConnection.status
  const errorMsg = modelConnection.errorMsg
  const latencyMs = modelConnection.latencyMs
  const keyTail = modelConfig.apiKey ? modelConfig.apiKey.slice(-4) : '未配置'

  async function handleTest() {
    setTesting(true)
    await testConnection()
    setTesting(false)
  }

  async function handleSave() {
    await testConnection()
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div>
      <SectionTitle title="模型连接" desc="连接为世界树注入灵思的语言模型。" />
      <div className="flex flex-col gap-5 rounded-xl border border-border/70 bg-card/60 p-5">
        <Field label="服务地址" hint="模型 API 的访问入口，如 OpenAI Compatible 地址。">
          <input
            className={inputCls}
            placeholder="https://api.example.com/v1"
            value={modelConfig.baseUrl}
            onChange={(e) => updateModelConfig({ baseUrl: e.target.value })}
          />
        </Field>
        <Field label="访问密钥" hint="仅保存在本地，不会出现在叙事内容中。">
          <input
            type="password"
            className={inputCls}
            placeholder="••••••••••••••••"
            value={modelConfig.apiKey}
            onChange={(e) => updateModelConfig({ apiKey: e.target.value })}
          />
        </Field>
        <Field label="模型名称">
          <input
            className={inputCls}
            value={modelConfig.model}
            onChange={(e) => updateModelConfig({ model: e.target.value })}
          />
        </Field>

        {/* 连接状态区 — 完全由外部状态驱动，无硬编码正常值 */}
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">当前连接状态</p>
          {connStatus === 'idle' && (
            <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-secondary/50 px-4 py-2.5 text-sm text-muted-foreground">
              <span className="size-2 rounded-full bg-muted-foreground/50" />
              未测试 · 点击「测试连接」验证配置
            </div>
          )}
          {connStatus === 'testing' && (
            <div className="flex items-center gap-2 rounded-lg border border-gold/40 bg-gold/8 px-4 py-2.5 text-sm text-gold-foreground">
              <span className="size-2 animate-pulse rounded-full bg-gold" />
              正在连接，请稍候…
            </div>
          )}
          {connStatus === 'ok' && (
            <div className="flex items-center gap-2 rounded-lg border border-moss/40 bg-primary/8 px-4 py-2.5 text-sm text-moss">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-moss/60" />
                <span className="relative inline-flex size-2 rounded-full bg-moss" />
              </span>
              <span className="flex-1">
                灵思链路正常{typeof latencyMs === 'number' ? ` · 响应延迟 ${latencyMs}ms` : ''}
              </span>
            </div>
          )}
          {connStatus === 'error' && (
            <div className="flex flex-col gap-1.5 rounded-lg border border-destructive/40 bg-destructive/8 px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertIcon className="size-4 shrink-0" />
                <span className="font-medium">连接失败</span>
              </div>
              {errorMsg ? (
                <p className="pl-6 text-xs text-destructive/80">{errorMsg}</p>
              ) : (
                <p className="pl-6 text-xs text-destructive/80">请检查服务地址与访问密钥是否正确</p>
              )}
            </div>
          )}
        </div>

        {/* 当前配置摘要 — 反映真实输入 */}
        <div className="rounded-lg border border-border/50 bg-secondary/30 px-4 py-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground/70">当前配置</p>
          <p className="mt-1">密钥：•••••••• （最后 4 位 {keyTail}）</p>
          <p className="mt-0.5">模型：{modelConfig.model || '未配置'} · 服务地址 {modelConfig.baseUrl || '未配置'}</p>
        </div>

        {saved && (
          <div className="flex items-center gap-2 rounded-lg border border-moss/40 bg-primary/8 px-4 py-2.5 text-sm text-moss">
            <CheckIcon className="size-4" />
            配置已保存
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button
            onClick={handleTest}
            disabled={connStatus === 'testing'}
            className="flex-1 rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
          >
            测试连接
          </button>
          <button
            onClick={handleSave}
            className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground transition-colors hover:bg-primary/90"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─────────── 叙事与引擎 ─────────── */

function StyleSection() {
  const [dataMode, setDataMode] = useState<string>('世界书')
  const [directorMode, setDirectorMode] = useState<string>('混合导演')
  const [narrator, setNarrator] = useState<string>('稳定剧作家')
  const [saved, setSaved] = useState(false)

  const dataModes = ['世界书', '角色卡', '预设']
  const directorModes = ['轻量本地', '混合导演', '深度导演']
  const narrators = [
    { id: '稳定剧作家', desc: '稳健、精炼，叙事逻辑严密' },
    { id: '温柔看护者', desc: '温暖、包容，侧重情感引导' },
    { id: '残酷命运', desc: '无情、真实，后果不可逆' },
    { id: '悬疑织网者', desc: '谜题与伏笔密布，信息不对称' },
    { id: '疯狂骰子', desc: '随机事件，结局不可预测' },
    { id: '史诗编年史家', desc: '宏大叙事，历史感强烈' },
  ]

  function handleSave() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div>
      <SectionTitle title="叙事与引擎" desc="调定世界的笔触、气息与驱动模式。" />
      <div className="flex flex-col gap-4">
        {/* 数据模式 */}
        <div className="rounded-xl border border-border/70 bg-card/60 p-5">
          <p className="mb-1.5 text-sm font-medium text-foreground">数据模式</p>
          <p className="mb-3 text-xs text-muted-foreground">决定世界设定如何注入叙事上下文。</p>
          <div className="flex gap-2">
            {dataModes.map((m) => (
              <button
                key={m}
                onClick={() => setDataMode(m)}
                className={cn(
                  'flex-1 rounded-lg border py-2 text-sm font-serif transition-colors',
                  dataMode === m
                    ? 'border-gold/50 bg-gold/15 text-gold-foreground'
                    : 'border-border text-muted-foreground hover:text-foreground',
                )}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* 导演模式 */}
        <div className="rounded-xl border border-border/70 bg-card/60 p-5">
          <p className="mb-1.5 text-sm font-medium text-foreground">导演模式</p>
          <p className="mb-3 text-xs text-muted-foreground">控制 DM 介入叙事的深度与频率。</p>
          <div className="flex gap-2">
            {directorModes.map((m) => (
              <button
                key={m}
                onClick={() => setDirectorMode(m)}
                className={cn(
                  'flex-1 rounded-lg border py-2 text-sm font-serif transition-colors',
                  directorMode === m
                    ? 'border-primary/50 bg-primary/12 text-primary'
                    : 'border-border text-muted-foreground hover:text-foreground',
                )}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* 叙事者 */}
        <div className="rounded-xl border border-border/70 bg-card/60 p-5">
          <p className="mb-1.5 text-sm font-medium text-foreground">叙事者</p>
          <p className="mb-3 text-xs text-muted-foreground">世界树以何种声音叙说这个故事。</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {narrators.map((n) => (
              <button
                key={n.id}
                onClick={() => setNarrator(n.id)}
                className={cn(
                  'flex flex-col gap-0.5 rounded-xl border p-3 text-left transition-colors',
                  narrator === n.id
                    ? 'border-gold/50 bg-gold/10'
                    : 'border-border/70 bg-card/40 hover:border-border hover:bg-card',
                )}
              >
                <span className="font-serif text-sm font-medium text-foreground">{n.id}</span>
                <span className="text-xs text-muted-foreground">{n.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Context 预算 */}
        <div className="rounded-xl border border-border/70 bg-card/60 p-5">
          <Field label="Context 预算" hint="控制注入世界书与记忆的 Token 上限（当前：6000 tokens）。">
            <input type="range" min={10} max={100} defaultValue={60} className="accent-[var(--moss)]" />
          </Field>
        </div>

        {saved && (
          <div className="flex items-center gap-2 rounded-lg border border-moss/40 bg-primary/8 px-4 py-2.5 text-sm text-moss">
            <CheckIcon className="size-4" />
            引擎设置已保存
          </div>
        )}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground transition-colors hover:bg-primary/90"
          >
            保存设置
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─────────── 世界书 ─────────── */

function WorldBookSection() {
  // 数据与操作全部来自 Provider（单一数据源）
  const { worldBook: entries, toggleWorldBookEntry, importWorldBook, previewInjection } =
    useWorldState()
  const [importOpen, setImportOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [importText, setImportText] = useState('')
  const [overwrite, setOverwrite] = useState(false)
  const [importing, setImporting] = useState(false)
  // 导入结果：null = 未运行，object = 结构化结果
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  // 注入预览结果：点击「预览注入」时实时计算
  const [preview, setPreview] = useState<InjectionPreview | null>(null)

  async function handleImport() {
    setImporting(true)
    const result = await importWorldBook(importText, overwrite)
    setImportResult(result)
    setImporting(false)
    setImportOpen(false)
    setImportText('')
  }

  function openPreview() {
    setPreview(previewInjection())
    setPreviewOpen(true)
  }

  const overBudget = preview ? preview.estimatedTokens > preview.tokenBudget : false

  return (
    <div>
      <SectionTitle title="世界书" desc="一条条被触发的设定，让世界自洽地生长。" />
      <div className="flex flex-col gap-3">
        {entries.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">
            尚无世界书条目，点击下方「导入条目」开始构建。
          </div>
        )}
        {entries.map((e) => (
          <div
            key={e.id}
            className="flex items-start justify-between gap-3 rounded-xl border border-border/70 bg-card/60 p-4"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-serif text-sm font-medium text-foreground">{e.name}</span>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                  {e.tag}
                </span>
                {!e.on && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    已停用
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">触发词：{e.trigger}</p>
            </div>
            <button
              role="switch"
              aria-checked={e.on}
              onClick={() => toggleWorldBookEntry(e.id)}
              className={cn(
                'relative h-6 w-11 shrink-0 rounded-full transition-colors',
                e.on ? 'bg-primary' : 'bg-input',
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 size-5 rounded-full bg-card shadow-sm transition-transform',
                  e.on ? 'translate-x-5' : 'translate-x-0.5',
                )}
              />
            </button>
          </div>
        ))}

        {/* 最近一次导入结果（若存在） */}
        {importResult !== null && (
          <div className="rounded-lg border border-border/60 bg-secondary/30 px-4 py-3 text-xs">
            <p className="mb-1.5 font-medium text-foreground/70">上次导入结果</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-md bg-primary/8 px-2 py-1.5">
                <p className="text-lg font-medium text-moss">{importResult.imported}</p>
                <p className="text-muted-foreground">已导入</p>
              </div>
              <div className="rounded-md bg-secondary/60 px-2 py-1.5">
                <p className="text-lg font-medium text-muted-foreground">{importResult.skipped}</p>
                <p className="text-muted-foreground">已跳过</p>
              </div>
              <div className="rounded-md bg-secondary/60 px-2 py-1.5">
                <p className="text-lg font-medium text-muted-foreground">{importResult.overwritten}</p>
                <p className="text-muted-foreground">已覆盖</p>
              </div>
            </div>
          </div>
        )}

        <div className="mt-2 flex gap-2">
          <button
            onClick={() => setImportOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary"
          >
            <PlusIcon className="size-4" />
            导入条目
          </button>
          <button
            onClick={openPreview}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary"
          >
            <EyeIcon className="size-4" />
            预览注入
          </button>
        </div>

        {/* 导入条目弹层 */}
        {importOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/25 p-4 backdrop-blur-sm"
            onClick={() => setImportOpen(false)}
          >
            <div
              className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h3 className="font-serif text-base font-medium text-foreground">导入世界书条目</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">粘贴 JSON / 纯文本设定，或拖入文件。</p>
                </div>
                <button
                  onClick={() => setImportOpen(false)}
                  className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary"
                >
                  <XIcon className="size-4" />
                </button>
              </div>
              <textarea
                rows={6}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder={'{"name": "新条目", "tag": "地点", "trigger": "触发词"}'}
                className={cn(inputCls, 'resize-none font-mono text-xs')}
              />
              <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={overwrite}
                  onChange={(e) => setOverwrite(e.target.checked)}
                  className="accent-[var(--gold)]"
                />
                覆盖已有同名条目（默认跳过）
              </label>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={() => setImportOpen(false)}
                  className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary"
                >
                  取消
                </button>
                <button
                  onClick={handleImport}
                  disabled={importing || !importText.trim()}
                  className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {importing ? '导入中…' : '导入'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 预览注入弹层 — 内容来自真实计算结果 */}
        {previewOpen && preview && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/25 p-4 backdrop-blur-sm"
            onClick={() => setPreviewOpen(false)}
          >
            <div
              className="flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between border-b border-border/60 px-6 py-4">
                <div>
                  <h3 className="font-serif text-base font-medium text-foreground">注入预览</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    下一轮叙事中，世界书将以此形式注入 Context。
                  </p>
                </div>
                <button
                  onClick={() => setPreviewOpen(false)}
                  className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary"
                >
                  <XIcon className="size-4" />
                </button>
              </div>

              {/* 注入摘要行 — 真实数值 */}
              <div className="flex items-center gap-4 border-b border-border/40 bg-secondary/30 px-6 py-3 text-xs">
                <span className="text-muted-foreground">
                  已启用条目：<span className="font-medium text-foreground">{preview.enabledCount} 条</span>
                </span>
                <span className="text-muted-foreground">
                  预计 Token：
                  <span className={cn('font-medium', overBudget ? 'text-destructive' : 'text-foreground')}>
                    {preview.estimatedTokens}
                  </span>
                  {' '}/ {preview.tokenBudget}
                </span>
                {overBudget ? (
                  <span className="flex items-center gap-1 text-destructive">
                    <AlertIcon className="size-3" />
                    超出预算
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-moss">
                    <CheckIcon className="size-3" />
                    预算充足
                  </span>
                )}
              </div>

              <div className="max-h-[42vh] overflow-y-auto px-6 py-4">
                <pre className="overflow-x-auto rounded-xl border border-border/60 bg-secondary/50 p-4 font-mono text-xs leading-relaxed text-foreground whitespace-pre-wrap">
                  {preview.text}
                </pre>
              </div>
              <div className="flex justify-end border-t border-border/60 px-6 py-3">
                <button
                  onClick={() => setPreviewOpen(false)}
                  className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  关闭
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─────────── 角色与场景 ─────────── */

function CastSection({ worldName }: { worldName: string }) {
  // 数据与增删改全部来自 Provider（单一数据源）
  const {
    cast: entries,
    toggleCastEnabled,
    deleteCastEntry,
    upsertCastEntry,
  } = useWorldState()
  const [createOpen, setCreateOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)

  const editEntry = editId ? entries.find((e) => e.id === editId) : null
  const detailEntry = detailId ? entries.find((e) => e.id === detailId) : null

  return (
    <div>
      <SectionTitle title="角色与场景" desc="登记世界中的角色与重要场景，让叙事拥有可依凭的根。" />

      <div className="flex flex-col gap-3">
        {entries.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-card/40 p-8 text-center">
            <p className="text-sm text-muted-foreground">尚无条目，点击「新建条目」开始编织。</p>
          </div>
        )}

        {entries.map((e) => (
          <div
            key={e.id}
            className={cn(
              'rounded-xl border bg-card/60 p-4 transition-colors',
              e.enabled ? 'border-border/70' : 'border-border/40 opacity-60',
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-serif text-sm font-medium text-foreground">{e.name}</span>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs',
                      e.type === '角色'
                        ? 'bg-primary/12 text-primary'
                        : 'bg-gold/15 text-gold-foreground',
                    )}
                  >
                    {e.type}
                  </span>
                  {!e.enabled && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      已停用
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{e.desc}</p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {e.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded-full border border-border/60 px-1.5 py-0.5 text-xs text-muted-foreground"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => setDetailId(e.id)}
                  className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  aria-label="查看详情"
                >
                  <EyeIcon className="size-3.5" />
                </button>
                <button
                  onClick={() => setEditId(e.id)}
                  className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  aria-label="编辑"
                >
                  <EditIcon className="size-3.5" />
                </button>
                <button
                  onClick={() => deleteCastEntry(e.id)}
                  className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  aria-label="删除"
                >
                  <TrashIcon className="size-3.5" />
                </button>
                <button
                  role="switch"
                  aria-checked={e.enabled}
                  onClick={() => toggleCastEnabled(e.id)}
                  className={cn(
                    'relative ml-1 h-6 w-11 shrink-0 rounded-full transition-colors',
                    e.enabled ? 'bg-primary' : 'bg-input',
                  )}
                >
                  <span
                    className={cn(
                      'absolute top-0.5 size-5 rounded-full bg-card shadow-sm transition-transform',
                      e.enabled ? 'translate-x-5' : 'translate-x-0.5',
                    )}
                  />
                </button>
              </div>
            </div>
          </div>
        ))}

        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-border/70 bg-card/30 py-3 text-sm text-muted-foreground transition-colors hover:border-gold/50 hover:bg-card/60 hover:text-foreground"
        >
          <PlusIcon className="size-4" />
          新建条目
        </button>
      </div>

      {/* 新建 / 编辑弹层 */}
      {(createOpen || editEntry) && (
        <CastEditModal
          entry={editEntry ?? null}
          defaultWorldModule={worldName}
          onClose={() => { setCreateOpen(false); setEditId(null) }}
          onSave={(data) => {
            // 通过 Provider 统一写入：有 id 即更新，无 id 即新建
            upsertCastEntry({
              ...data,
              id: editEntry?.id,
              enabled: editEntry?.enabled ?? true,
              worldModule: data.worldModule || worldName,
            })
            setCreateOpen(false)
            setEditId(null)
          }}
        />
      )}

      {/* 详情弹层 */}
      {detailEntry && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/25 p-4 backdrop-blur-sm"
          onClick={() => setDetailId(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-serif text-base font-medium text-foreground">{detailEntry.name}</h3>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs',
                      detailEntry.type === '角色'
                        ? 'bg-primary/12 text-primary'
                        : 'bg-gold/15 text-gold-foreground',
                    )}
                  >
                    {detailEntry.type}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setDetailId(null)}
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary"
              >
                <XIcon className="size-4" />
              </button>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">{detailEntry.desc}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {detailEntry.tags.map((t) => (
                <span key={t} className="rounded-full border border-border/60 px-2 py-0.5 text-xs text-muted-foreground">
                  {t}
                </span>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between rounded-lg border border-border/50 bg-secondary/30 px-3 py-2.5 text-xs">
              <span className="text-muted-foreground">所属世界</span>
              <span className="font-serif text-foreground/80">{detailEntry.worldModule}</span>
            </div>
            <div className="mt-2 flex items-center justify-between rounded-lg border border-border/50 bg-secondary/30 px-3 py-2.5 text-xs">
              <span className="text-muted-foreground">状态</span>
              <span className={detailEntry.enabled ? 'text-moss' : 'text-muted-foreground'}>
                {detailEntry.enabled ? '已启用' : '已停用'}
              </span>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => { setDetailId(null); setEditId(detailEntry.id) }}
                className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary"
              >
                编辑
              </button>
              <button
                onClick={() => setDetailId(null)}
                className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground transition-colors hover:bg-primary/90"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function CastEditModal({
  entry,
  defaultWorldModule,
  onClose,
  onSave,
}: {
  entry: CastEntry | null
  defaultWorldModule: string
  onClose: () => void
  onSave: (data: Omit<CastEntry, 'id' | 'enabled'>) => void
}) {
  const [name, setName] = useState(entry?.name ?? '')
  const [type, setType] = useState<CastType>(entry?.type ?? '角色')
  const [worldModule, setWorldModule] = useState(entry?.worldModule ?? defaultWorldModule)
  const [desc, setDesc] = useState(entry?.desc ?? '')
  const [tagsStr, setTagsStr] = useState(entry?.tags.join('，') ?? '')

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/25 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <h3 className="font-serif text-base font-medium text-foreground">
            {entry ? '编辑条目' : '新建条目'}
          </h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary">
            <XIcon className="size-4" />
          </button>
        </div>
        <div className="flex flex-col gap-4">
          <Field label="条目名称">
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="输入名称…" />
          </Field>
          <Field label="条目类型">
            <div className="flex gap-2">
              {(['角色', '场景'] as CastType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={cn(
                    'flex-1 rounded-lg border py-2 text-sm transition-colors',
                    type === t
                      ? 'border-primary/50 bg-primary/12 text-primary'
                      : 'border-border text-muted-foreground hover:text-foreground',
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </Field>
          <Field label="所属世界 / 模块" hint="用于多世界项目中区分条目归属">
            <input className={inputCls} value={worldModule} onChange={(e) => setWorldModule(e.target.value)} placeholder="世界名称或模块…" />
          </Field>
          <Field label="简述">
            <textarea
              rows={3}
              className={cn(inputCls, 'resize-none')}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="简要描述…"
            />
          </Field>
          <Field label="标签" hint="逗号分隔，如：主要角色，中立阵营">
            <input className={inputCls} value={tagsStr} onChange={(e) => setTagsStr(e.target.value)} placeholder="主要角色，中立…" />
          </Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary">
            取消
          </button>
          <button
            onClick={() =>
              onSave({
                name,
                type,
                worldModule,
                desc,
                tags: tagsStr.split(/[，,]+/).filter(Boolean),
              })
            }
            className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground transition-colors hover:bg-primary/90"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─────────── 关系网络 ─────────── */

function RelationsSection() {
  // 数据与增删改全部来自 Provider（单一数据源）
  const { relations: entries, deleteRelation, upsertRelation } = useWorldState()
  const [createOpen, setCreateOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)

  const statusChangeCls: Record<RelStatusChange, string> = {
    稳定: 'bg-moss/12 text-moss',
    波动: 'bg-gold/15 text-gold-foreground',
    恶化: 'bg-destructive/12 text-destructive',
    修复中: 'bg-primary/12 text-primary',
  }

  const strengthColor: Record<RelStrength, string> = {
    强: 'bg-primary/12 text-primary',
    中: 'bg-gold/15 text-gold-foreground',
    弱: 'bg-muted text-muted-foreground',
    未知: 'bg-secondary text-secondary-foreground',
  }

  const editEntry = editId ? entries.find((e) => e.id === editId) : null
  const detailEntry = detailId ? entries.find((e) => e.id === detailId) : null

  return (
    <div>
      <SectionTitle title="关系网络" desc="梳理角色与阵营之间的羁绊、敌意与盟约。" />

      <div className="flex flex-col gap-3">
        {entries.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-card/40 p-8 text-center">
            <p className="text-sm text-muted-foreground">尚无关系条目，点击「新增关系」开始记录。</p>
          </div>
        )}

        {entries.map((e) => (
          <div key={e.id} className="rounded-xl border border-border/70 bg-card/60 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                {/* 关系双方 */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-serif text-sm font-medium text-foreground">{e.from}</span>
                  <span className="text-xs text-muted-foreground">→</span>
                  <span className="font-serif text-sm font-medium text-foreground">{e.to}</span>
                  <span className="rounded-full border border-border/60 px-2 py-0.5 text-xs text-muted-foreground">
                    {e.relType}
                  </span>
                  <span className={cn('rounded-full px-2 py-0.5 text-xs', strengthColor[e.strength])}>
                    {e.strength}
                  </span>
                  <span className={cn('rounded-full px-2 py-0.5 text-xs', statusChangeCls[e.statusChange])}>
                    {e.statusChange}
                  </span>
                </div>
                {/* 备注 */}
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{e.note}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => setDetailId(e.id)}
                  className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  aria-label="查看详情"
                >
                  <EyeIcon className="size-3.5" />
                </button>
                <button
                  onClick={() => setEditId(e.id)}
                  className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  aria-label="编辑"
                >
                  <EditIcon className="size-3.5" />
                </button>
                <button
                  onClick={() => deleteRelation(e.id)}
                  className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  aria-label="删除"
                >
                  <TrashIcon className="size-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}

        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-border/70 bg-card/30 py-3 text-sm text-muted-foreground transition-colors hover:border-gold/50 hover:bg-card/60 hover:text-foreground"
        >
          <PlusIcon className="size-4" />
          新增关系
        </button>
      </div>

      {/* 新建 / 编辑弹层 */}
      {(createOpen || editEntry) && (
        <RelEditModal
          entry={editEntry ?? null}
          onClose={() => { setCreateOpen(false); setEditId(null) }}
          onSave={(data) => {
            // 通过 Provider 统一写入：有 id 即更新，无 id 即新建
            upsertRelation({ ...data, id: editEntry?.id })
            setCreateOpen(false)
            setEditId(null)
          }}
        />
      )}

      {/* 详情弹层 */}
      {detailEntry && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/25 p-4 backdrop-blur-sm"
          onClick={() => setDetailId(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <h3 className="font-serif text-base font-medium text-foreground">关系详情</h3>
              <button onClick={() => setDetailId(null)} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary">
                <XIcon className="size-4" />
              </button>
            </div>
            <div className="flex flex-col gap-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-secondary/40 px-3 py-2">
                  <p className="text-xs text-muted-foreground">关系方 A</p>
                  <p className="font-serif font-medium text-foreground">{detailEntry.from}</p>
                </div>
                <div className="rounded-lg bg-secondary/40 px-3 py-2">
                  <p className="text-xs text-muted-foreground">关系方 B</p>
                  <p className="font-serif font-medium text-foreground">{detailEntry.to}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-secondary/40 px-3 py-2">
                <span className="text-xs text-muted-foreground">类型</span>
                <span className="text-foreground">{detailEntry.relType}</span>
                <span className="ml-auto text-xs text-muted-foreground">强度</span>
                <span className={cn('rounded-full px-2 py-0.5 text-xs', strengthColor[detailEntry.strength])}>
                  {detailEntry.strength}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-secondary/40 px-3 py-2">
                <span className="text-xs text-muted-foreground">关系状态</span>
                <span className={cn('rounded-full px-2 py-0.5 text-xs', statusChangeCls[detailEntry.statusChange])}>
                  {detailEntry.statusChange}
                </span>
              </div>
              <div className="rounded-lg bg-secondary/40 px-3 py-2.5">
                <p className="mb-1 text-xs text-muted-foreground">备注</p>
                <p className="leading-relaxed text-foreground">{detailEntry.note}</p>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => { setDetailId(null); setEditId(detailEntry.id) }} className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary">
                编辑
              </button>
              <button onClick={() => setDetailId(null)} className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground transition-colors hover:bg-primary/90">
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function RelEditModal({
  entry,
  onClose,
  onSave,
}: {
  entry: RelEntry | null
  onClose: () => void
  onSave: (data: Omit<RelEntry, 'id'>) => void
}) {
  const [from, setFrom] = useState(entry?.from ?? '')
  const [to, setTo] = useState(entry?.to ?? '')
  const [relType, setRelType] = useState(entry?.relType ?? '')
  const [strength, setStrength] = useState<RelStrength>(entry?.strength ?? '未知')
  const [statusChange, setStatusChange] = useState<RelStatusChange>(entry?.statusChange ?? '稳定')
  const [note, setNote] = useState(entry?.note ?? '')

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/25 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <h3 className="font-serif text-base font-medium text-foreground">
            {entry ? '编辑关系' : '新增关系'}
          </h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary">
            <XIcon className="size-4" />
          </button>
        </div>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="关系方 A">
              <input className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} placeholder="如：主角" />
            </Field>
            <Field label="关系方 B">
              <input className={inputCls} value={to} onChange={(e) => setTo(e.target.value)} placeholder="如：重要角色" />
            </Field>
          </div>
          <Field label="关系类型">
            <input className={inputCls} value={relType} onChange={(e) => setRelType(e.target.value)} placeholder="如：师徒、敌对…" />
          </Field>
          <Field label="强度">
            <div className="flex gap-2">
              {(['强', '中', '弱', '未知'] as RelStrength[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setStrength(s)}
                  className={cn(
                    'flex-1 rounded-lg border py-1.5 text-sm transition-colors',
                    strength === s
                      ? 'border-primary/50 bg-primary/12 text-primary'
                      : 'border-border text-muted-foreground hover:text-foreground',
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </Field>
          <Field label="关系状态变化" hint="反映近期关系走势，便于叙事追踪">
            <div className="flex gap-2">
              {(['稳定', '波动', '恶化', '修复中'] as RelStatusChange[]).map((sc) => (
                <button
                  key={sc}
                  onClick={() => setStatusChange(sc)}
                  className={cn(
                    'flex-1 rounded-lg border py-1.5 text-sm transition-colors',
                    statusChange === sc
                      ? 'border-gold/50 bg-gold/12 text-gold-foreground'
                      : 'border-border text-muted-foreground hover:text-foreground',
                  )}
                >
                  {sc}
                </button>
              ))}
            </div>
          </Field>
          <Field label="备注">
            <textarea
              rows={3}
              className={cn(inputCls, 'resize-none')}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="关系背景与当前状态…"
            />
          </Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary">
            取消
          </button>
          <button
            onClick={() => onSave({ from, to, relType, strength, statusChange, note })}
            className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground transition-colors hover:bg-primary/90"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─────────── 素材工坊 ─────────── */

type WorkshopStage = 'idle' | 'running' | 'done'

function WorkshopSection() {
  /**
   * 工坊处理走 Provider 的 async runWorkshop()，结果是结构化的 WorkshopResult，
   * 由数据源（演示后端 / 真实 API）返回，组件只渲染结果——不再用 setTimeout 自造内容。
   * 不同的素材输入会得到不同的识别结果，体现真实「输入→输出」链路。
   */
  const { runWorkshop } = useWorldState()
  const [importText, setImportText] = useState('')
  const [stage, setStage] = useState<WorkshopStage>('idle')
  const [result, setResult] = useState<WorkshopResult | null>(null)

  async function handleRun() {
    if (!importText.trim()) return
    setStage('running')
    const res = await runWorkshop(importText)
    setResult(res)
    setStage('done')
  }

  return (
    <div>
      <SectionTitle title="素材工坊" desc="把零散的灵感炼成世界的一部分。" />

      <div className="flex flex-col gap-5">
        {/* 素材输入区 */}
        <div className="rounded-xl border border-border/70 bg-card/60 p-5">
          <div className="mb-3 flex items-center gap-2">
            <UploadIcon className="size-4 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">导入素材</p>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            粘贴文本、设定集或旧存档内容，工坊会识别条目、生成建议并写入世界书。
          </p>
          <textarea
            rows={6}
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder="在此粘贴你的素材文本、设定集或旧存档内容…"
            className={cn(inputCls, 'resize-none')}
          />
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={handleRun}
              disabled={!importText.trim() || stage === 'running'}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <SparkleIcon className="size-4" />
              {stage === 'running' ? '炼制中…' : '识别并处理'}
            </button>
            <span className="text-xs text-muted-foreground">
              当前素材 {importText.trim().length} 字
            </span>
          </div>
        </div>

        {/* 运行中提示 */}
        {stage === 'running' && (
          <div className="flex items-center gap-2 rounded-xl border border-gold/40 bg-gold/8 px-4 py-3 text-sm text-gold-foreground">
            <span className="size-2 animate-pulse rounded-full bg-gold" />
            正在分析素材、生成建议并写入世界书…
          </div>
        )}

        {/* 结果区 — 全部来自 runWorkshop 的真实返回 */}
        {stage === 'done' && result && (
          <>
            {/* 识别结果 */}
            <div className="rounded-xl border border-border/70 bg-card/60 p-5">
              <p className="mb-3 text-sm font-medium text-foreground">识别结果（{result.recognized.length}）</p>
              {result.recognized.length === 0 ? (
                <p className="text-sm text-muted-foreground">未从素材中识别到可用条目。</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {result.recognized.map((r) => (
                    <div
                      key={r.name}
                      className="flex items-center justify-between rounded-lg border border-border/60 bg-secondary/40 px-3 py-2.5"
                    >
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-primary/12 px-2 py-0.5 text-xs text-primary">{r.type}</span>
                        <span className="text-sm text-foreground">{r.name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{r.hit}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 建议 */}
            {result.suggestions.length > 0 && (
              <div className="rounded-xl border border-border/70 bg-card/60 p-5">
                <p className="mb-3 text-sm font-medium text-foreground">生成建议</p>
                <ul className="flex flex-col gap-2">
                  {result.suggestions.map((s, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 rounded-lg border border-border/60 bg-secondary/40 px-3 py-2.5 text-sm text-muted-foreground"
                    >
                      <span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-gold" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 处理汇总 */}
            <div className="rounded-xl border border-border/70 bg-card/60 p-5">
              <p className="mb-3 text-sm font-medium text-foreground">批量处理结果</p>
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-md bg-secondary/60 px-2 py-2">
                    <p className="text-lg font-medium text-foreground">{result.recognized.length}</p>
                    <p className="text-xs text-muted-foreground">识别条目</p>
                  </div>
                  <div className="rounded-md bg-secondary/60 px-2 py-2">
                    <p className="text-lg font-medium text-foreground">{result.suggestions.length}</p>
                    <p className="text-xs text-muted-foreground">生成建议</p>
                  </div>
                  <div className="rounded-md bg-primary/8 px-2 py-2">
                    <p className="text-lg font-medium text-moss">{result.written.length}</p>
                    <p className="text-xs text-muted-foreground">写入世界书</p>
                  </div>
                </div>
                {result.written.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-muted-foreground">写入条目明细</p>
                    <div className="flex flex-col gap-1.5">
                      {result.written.map((w) => (
                        <div
                          key={w.name}
                          className="flex items-center gap-2 rounded-lg border border-border/50 bg-secondary/30 px-3 py-2 text-xs"
                        >
                          <span className="rounded-full bg-primary/12 px-2 py-0.5 text-primary">{w.type}</span>
                          <span className="text-foreground">{w.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2 rounded-lg border border-moss/40 bg-primary/8 px-4 py-2.5 text-sm text-moss">
                  <CheckIcon className="size-4" />
                  {result.written.length} 条条目已写入世界书
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* ─────────── 高级 ─────────── */

function AdvancedSection() {
  const [open, setOpen] = useState(false)
  const [powerUser, setPowerUser] = useState(false)
  const [resetConfirm, setResetConfirm] = useState(false)
  const [cmdSaved, setCmdSaved] = useState(false)

  function handleSaveCmd() {
    setCmdSaved(true)
    setTimeout(() => setCmdSaved(false), 2000)
  }
  function handleReset() {
    setResetConfirm(false)
  }

  return (
    <div>
      <SectionTitle title="高级" desc="面向资深创作者的底层入口，请谨慎调整。" />

      {/* 危险警示 */}
      <div className="mb-4 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/8 px-4 py-3">
        <AlertIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
        <p className="text-xs leading-relaxed text-destructive">
          此分区内的操作可能直接影响世界数据。错误修改可能导致叙事不一致或数据损坏，建议在进行任何操作前手动备份存档。
        </p>
      </div>

      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-xl border border-border/70 bg-card/60 px-4 py-3 text-left transition-colors hover:bg-card"
      >
        <span className="font-serif text-sm text-foreground">展开底层设置</span>
        <ChevronIcon
          className={cn('size-4 text-muted-foreground transition-transform', open && 'rotate-90')}
        />
      </button>

      {open && (
        <div className="mt-3 flex flex-col gap-4 rounded-xl border border-border/70 bg-card/60 p-5">
          <Field label="数据路径" hint="世界数据的本地存储路径。">
            <input
              className={cn(inputCls, 'font-mono text-xs')}
              defaultValue="~/world-tree/saves"
            />
          </Field>

          <Field label="原始世界数据（JSON）" hint="直接编辑世界状态数据，高风险操作。">
            <textarea
              rows={6}
              className={cn(inputCls, 'resize-none font-mono text-xs')}
              defaultValue={'{\n  "world": "silver-leaf",\n  "turn": 7,\n  "branch": "main"\n}'}
            />
          </Field>

          <Field label="Slash Command 指令库" hint="每行一条自定义指令，以 / 开头。">
            <textarea
              rows={4}
              className={cn(inputCls, 'resize-none font-mono text-xs')}
              defaultValue={'/recap 总结当前章节\n/jump 跳转到指定时间点\n/inspect 查看指定角色状态'}
            />
          </Field>

          {cmdSaved && (
            <div className="flex items-center gap-2 rounded-lg border border-moss/40 bg-primary/8 px-4 py-2.5 text-sm text-moss">
              <CheckIcon className="size-4" />
              指令库已保存
            </div>
          )}

          <div className="flex items-start justify-between rounded-lg border border-border/60 bg-secondary/40 px-3 py-2.5">
            <div className="flex-1 pr-4">
              <span className="text-sm font-medium text-foreground">Power User 模式</span>
              <p className="mt-0.5 text-xs text-muted-foreground">解锁底层参数与实验性功能</p>
              {powerUser && (
                <div className="mt-2 rounded-md border border-gold/30 bg-gold/8 px-3 py-2 text-xs text-gold-foreground">
                  <p className="font-medium">已启用 Power User 模式</p>
                  <ul className="mt-1.5 flex flex-col gap-1 text-gold-foreground/80">
                    <li>· 可直接编辑原始世界 JSON 数据</li>
                    <li>· 可访问实验性叙事参数（temperature、top_p 等）</li>
                    <li>· 解锁强制跳转与记忆点覆盖等高危操作</li>
                    <li>· 上述操作均不可逆，请在完整备份后使用</li>
                  </ul>
                </div>
              )}
            </div>
            <button
              role="switch"
              aria-checked={powerUser}
              onClick={() => setPowerUser((v) => !v)}
              className={cn(
                'relative h-6 w-11 shrink-0 rounded-full transition-colors',
                powerUser ? 'bg-primary' : 'bg-input',
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 size-5 rounded-full bg-card shadow-sm transition-transform',
                  powerUser ? 'translate-x-5' : 'translate-x-0.5',
                )}
              />
            </button>
          </div>

          <div className="flex gap-2 pt-1">
            {!resetConfirm ? (
              <button
                onClick={() => setResetConfirm(true)}
                className="flex-1 rounded-lg border border-destructive/40 px-3 py-2 text-sm text-destructive transition-colors hover:bg-destructive/8"
              >
                重置草稿
              </button>
            ) : (
              <div className="flex flex-1 items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/8 px-3 py-2">
                <span className="flex-1 text-xs text-destructive">确认重置？此操作不可撤销。</span>
                <button onClick={handleReset} className="rounded-md bg-destructive px-2.5 py-1 text-xs text-white transition-colors hover:bg-destructive/90">
                  确认
                </button>
                <button onClick={() => setResetConfirm(false)} className="rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary">
                  取消
                </button>
              </div>
            )}
            <button
              onClick={handleSaveCmd}
              className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground transition-colors hover:bg-primary/90"
            >
              保存命令
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
