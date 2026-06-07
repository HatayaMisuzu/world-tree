'use client'

import Link from 'next/link'
import { useState } from 'react'
import { PageShell } from '@/components/page-shell'
import { BookIcon, ChevronIcon, LeafIcon, GitBranchIcon, XIcon, CheckIcon } from '@/components/icons'
import { cn } from '@/lib/utils'
import { useWorldState } from '@/components/world-state-provider'

type Tab = 'saves' | 'sessions' | 'tree'

type Save = {
  id: string
  name: string
  time: string
  turn: number
  summary: string
  summaryFull: string
  status: '进行中' | '已完结' | '已搁置'
  current?: boolean
}

const saves: Save[] = []

type Session = {
  id: string
  name: string
  meta: string
  active: boolean
}

const sessions: Session[] = []

type Branch = {
  id: string
  name: string
  state: string
  tone: 'moss' | 'gold' | 'muted'
  desc: string
  divergedAt: string
}

const branches: Branch[] = []

export function MemoryView() {
  const { worldName } = useWorldState()
  const [tab, setTab] = useState<Tab>('saves')

  return (
    <PageShell worldName={worldName} statusText="读取记忆 · 翻阅档案" showConnectionStatus={false}>
      <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
        <div className="mx-auto max-w-4xl">
          <header className="mb-5">
            <h1 className="font-serif text-2xl font-medium text-foreground">记忆档案</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              翻开往昔的书页，回到任意一个记忆点。
            </p>
          </header>

          {/* 标签切换 */}
          <div className="mb-5 inline-flex rounded-xl border border-border/70 bg-card/60 p-1">
            {([
              { id: 'saves' as Tab, label: '存档记忆' },
              { id: 'sessions' as Tab, label: '历史会话' },
              { id: 'tree' as Tab, label: '分支时间树' },
            ] as { id: Tab; label: string }[]).map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'rounded-lg px-4 py-1.5 text-sm font-serif transition-colors',
                  tab === t.id
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'saves' && <SavesList />}
          {tab === 'sessions' && <SessionsList />}
          {tab === 'tree' && <BranchTree />}
        </div>
      </div>
    </PageShell>
  )
}

/* ─────────── 存档列表 ─────────── */
function SavesList() {
  const [summaryId, setSummaryId] = useState<string | null>(null)
  const [returnedId, setReturnedId] = useState<string | null>(null)

  const summaryEntry = summaryId ? saves.find((s) => s.id === summaryId) : null

  function handleReturn(id: string) {
    setReturnedId(id)
    setTimeout(() => setReturnedId(null), 2500)
  }

  return (
    <div className="flex flex-col gap-3">
      {saves.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-card/40 p-10 text-center">
          <BookIcon className="mx-auto size-8 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">尚无存档，开始一段旅程后将自动记录。</p>
        </div>
      )}

      {saves.map((s) => (
        <article
          key={s.id}
          className={cn(
            'group flex flex-col gap-3 rounded-2xl border bg-card/70 p-5 transition-colors sm:flex-row sm:items-center sm:justify-between',
            s.current
              ? 'border-gold/50 gold-hairline'
              : 'border-border/70 hover:border-gold/40',
          )}
        >
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-moss">
              <BookIcon className="size-5" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-serif text-base font-medium text-foreground">{s.name}</h2>
                <span className="rounded-full bg-gold/15 px-2 py-0.5 text-xs text-gold-foreground">
                  第 {s.turn} 轮
                </span>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-xs',
                    s.status === '进行中'
                      ? 'bg-primary/15 text-primary'
                      : s.status === '已搁置'
                      ? 'bg-muted text-muted-foreground'
                      : 'bg-moss/15 text-moss',
                  )}
                >
                  {s.status}
                </span>
                {s.current && (
                  <span className="rounded-full bg-gold/20 px-2 py-0.5 text-xs font-medium text-gold-foreground">
                    当前
                  </span>
                )}
              </div>
              <p className="mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">
                {s.summary}
              </p>
              <p className="mt-1 text-xs text-muted-foreground/70">上次 · {s.time}</p>

              {/* 回到记忆点后的状态反馈 */}
              {returnedId === s.id && (
                <div className="mt-2 flex items-center gap-2 rounded-lg border border-moss/40 bg-primary/8 px-3 py-1.5 text-xs text-moss">
                  <CheckIcon className="size-3.5" />
                  已回到此记忆点，可继续旅程
                </div>
              )}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              onClick={() => setSummaryId(s.id)}
              className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary"
            >
              查看摘要
            </button>
            {s.current ? (
              <Link
                href="/dialogue"
                className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <LeafIcon className="size-3.5" />
                继续旅程
              </Link>
            ) : (
              <button
                onClick={() => handleReturn(s.id)}
                className="flex items-center gap-1 rounded-lg border border-gold/40 bg-gold/8 px-3 py-1.5 text-xs text-gold-foreground transition-colors hover:bg-gold/15"
              >
                回到此记忆点
              </button>
            )}
          </div>
        </article>
      ))}

      {/* 原始数据折叠 */}
      <RawDataFold />

      {/* 摘要弹层 */}
      {summaryEntry && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/25 p-4 backdrop-blur-sm"
          onClick={() => setSummaryId(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-serif text-base font-medium text-foreground">{summaryEntry.name}</h3>
                  <span className="rounded-full bg-gold/15 px-2 py-0.5 text-xs text-gold-foreground">
                    第 {summaryEntry.turn} 轮
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">上次保存 · {summaryEntry.time}</p>
              </div>
              <button
                onClick={() => setSummaryId(null)}
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary"
              >
                <XIcon className="size-4" />
              </button>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">{summaryEntry.summaryFull}</p>
            <div className="mt-5 flex justify-end gap-2">
              {summaryEntry.current ? (
                <Link
                  href="/dialogue"
                  onClick={() => setSummaryId(null)}
                  className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  <LeafIcon className="size-3.5" />
                  继续旅程
                </Link>
              ) : (
                <button
                  onClick={() => { setSummaryId(null) }}
                  className="rounded-lg border border-gold/40 bg-gold/8 px-4 py-2 text-sm text-gold-foreground transition-colors hover:bg-gold/15"
                >
                  回到此记忆点
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─────────── 历史会话 ─────────── */
function SessionsList() {
  if (sessions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/40 p-10 text-center">
        <p className="text-sm text-muted-foreground">尚无历史会话记录。</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/60">
      {sessions.map((s, i) => (
        <button
          key={s.id}
          className={cn(
            'flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-card',
            i !== sessions.length - 1 && 'border-b border-border/50',
            s.active && 'gold-hairline',
          )}
        >
          <div className="flex items-center gap-3">
            {s.active ? (
              <span className="relative flex size-2 shrink-0">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-moss/50" />
                <span className="relative inline-flex size-2 rounded-full bg-moss" />
              </span>
            ) : (
              <span className="size-2 shrink-0 rounded-full bg-border" />
            )}
            <span
              className={cn(
                'font-serif text-sm',
                s.active ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {s.name}
            </span>
            {s.active && (
              <span className="rounded-full bg-gold/15 px-1.5 py-0.5 text-xs text-gold-foreground">
                当前
              </span>
            )}
          </div>
          <span className="text-xs text-muted-foreground">{s.meta}</span>
        </button>
      ))}
    </div>
  )
}

/* ─────────── 分支时间树 ─────────── */
const toneDot: Record<string, string> = {
  moss: 'bg-moss',
  gold: 'bg-gold',
  muted: 'bg-muted-foreground/50',
}

function BranchTree() {
  const [compareIds, setCompareIds] = useState<string[]>([])
  const [compareOpen, setCompareOpen] = useState(false)

  function toggleCompare(id: string) {
    setCompareIds((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : prev.length < 2 ? [...prev, id] : prev,
    )
  }

  const compareEntries = compareIds.map((id) => branches.find((b) => b.id === id)).filter(Boolean) as Branch[]

  if (branches.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/40 p-10 text-center">
        <GitBranchIcon className="mx-auto size-8 text-muted-foreground/40" />
        <p className="mt-3 text-sm text-muted-foreground">尚无分支记录，叙事发生分叉后将自动追踪。</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl border border-border/70 bg-card/60 p-5">
        <div className="mb-4 flex items-center gap-2">
          <GitBranchIcon className="size-4 text-muted-foreground" />
          <span className="font-serif text-sm font-medium text-foreground">时间分支总览</span>
        </div>
        <div className="relative flex flex-col gap-1 pl-4">
          {/* 主干线 */}
          <span className="absolute bottom-2 left-[7px] top-2 w-px bg-border" aria-hidden />
          {branches.map((b) => (
            <div
              key={b.id}
              className={cn(
                'relative rounded-lg py-3 pl-5 pr-2 transition-colors hover:bg-card',
                compareIds.includes(b.id) && 'bg-gold/6',
              )}
            >
              <span
                className={cn('absolute left-0 size-3.5 rounded-full ring-4 ring-card', toneDot[b.tone])}
                aria-hidden
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-serif text-sm text-foreground">{b.name}</span>
                    <span
                      className={cn(
                        'rounded-full px-1.5 py-0.5 text-xs',
                        b.state === '进行中'
                          ? 'bg-primary/12 text-primary'
                          : b.state === '分支'
                          ? 'bg-gold/15 text-gold-foreground'
                          : b.state === '已搁置'
                          ? 'bg-muted text-muted-foreground'
                          : 'bg-moss/15 text-moss',
                      )}
                    >
                      {b.state}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{b.desc}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground/60">分叉点：{b.divergedAt}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={compareIds.includes(b.id)}
                      onChange={() => toggleCompare(b.id)}
                      disabled={!compareIds.includes(b.id) && compareIds.length >= 2}
                      className="accent-[var(--gold)]"
                    />
                    比较
                  </label>
                  <button className="rounded-md border border-border px-2 py-1 text-xs text-moss transition-colors hover:bg-primary/10 hover:text-primary">
                    回到此记忆点
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-4">
          <p className="text-xs text-muted-foreground">
            {compareIds.length === 0
              ? '勾选最多 2 条分支进行比较'
              : compareIds.length === 1
              ? '再选 1 条分支即可比较'
              : '已选 2 条，可进行比较'}
          </p>
          <button
            onClick={() => setCompareOpen(true)}
            disabled={compareIds.length < 2}
            className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40"
          >
            比较分支
          </button>
        </div>
      </div>

      {/* 比较弹层 */}
      {compareOpen && compareEntries.length === 2 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/25 p-4 backdrop-blur-sm"
          onClick={() => setCompareOpen(false)}
        >
          <div
            className="w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-border/60 px-6 py-4">
              <div>
                <h3 className="font-serif text-base font-medium text-foreground">分支比较</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">对比两条分支的差异</p>
              </div>
              <button
                onClick={() => setCompareOpen(false)}
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary"
              >
                <XIcon className="size-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 divide-x divide-border/60">
              {compareEntries.map((b) => (
                <div key={b.id} className="p-5">
                  <div className="flex items-center gap-2">
                    <span className={cn('size-2.5 rounded-full', toneDot[b.tone])} />
                    <p className="font-serif text-sm font-medium text-foreground">{b.name}</p>
                  </div>
                  <div className="mt-3 flex flex-col gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">状态</p>
                      <p className="mt-0.5 text-foreground">{b.state}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">分叉点</p>
                      <p className="mt-0.5 text-foreground">{b.divergedAt}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">描述</p>
                      <p className="mt-0.5 leading-relaxed text-foreground">{b.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end border-t border-border/60 px-6 py-3">
              <button
                onClick={() => setCompareOpen(false)}
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

/* ─────────── 原始数据折叠 ─────────── */
function RawDataFold() {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-2xl border border-border/60 bg-card/40">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-5 py-3 text-left"
      >
        <span className="text-sm text-muted-foreground">原始数据</span>
        <ChevronIcon
          className={cn(
            'size-4 text-muted-foreground transition-transform',
            open && 'rotate-90',
          )}
        />
      </button>
      {open && (
        <pre className="overflow-x-auto border-t border-border/50 px-5 py-4 font-mono text-xs leading-relaxed text-muted-foreground">
{`{
  "world": "silver-leaf",
  "turn": 7,
  "branch": "main",
  "checkpoints": 3,
  "saves": ${saves.length},
  "sessions": ${sessions.length},
  "branches": ${branches.length}
}`}
        </pre>
      )}
    </div>
  )
}
