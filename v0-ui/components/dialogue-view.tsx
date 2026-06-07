'use client'

import Image from 'next/image'
import { useState, useRef, useEffect } from 'react'
import { PageShell } from '@/components/page-shell'
import { LeafIcon, CheckIcon, XIcon, ChevronIcon } from '@/components/icons'
import { cn } from '@/lib/utils'
import { useWorldState } from '@/components/world-state-provider'

type Role = 'player' | 'world' | 'system'
type Message = { id: number; role: Role; text: string }
type ChangeStatus = 'pending' | 'accepted' | 'rejected' | 'stashed'

type WorldChange = {
  id: string
  title: string
  desc: string
  impact: string
  detail: string
  status: ChangeStatus
}

const conversations = [
  { id: 'c1', title: '新会话', meta: '当前会话', active: true },
]

const initialMessages: Message[] = []

const initialChanges: WorldChange[] = []

const roleStyles: Record<Role, string> = {
  player: 'self-end bg-primary/12 border-primary/25 text-foreground',
  world: 'self-start bg-card border-border/80 text-foreground',
  system:
    'self-center bg-gold/10 border-gold/30 text-gold-foreground text-center text-xs max-w-full',
}

const statusLabel: Record<ChangeStatus, { text: string; cls: string }> = {
  pending: { text: '待确认', cls: 'bg-gold/15 text-gold-foreground' },
  accepted: { text: '已采纳', cls: 'bg-primary/15 text-primary' },
  rejected: { text: '已拒绝', cls: 'bg-destructive/12 text-destructive' },
  stashed: { text: '已暂存', cls: 'bg-muted text-muted-foreground' },
}

export function DialogueView() {
  const { worldName, connectionOk, connectionIssues } = useWorldState()
  const [messages, setMessages] = useState(initialMessages)
  const [input, setInput] = useState('')
  const [changes, setChanges] = useState<WorldChange[]>(initialChanges)
  const [panelOpen, setPanelOpen] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const pendingCount = changes.filter((c) => c.status === 'pending').length
  const hasChanges = pendingCount > 0

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function send() {
    const text = input.trim()
    if (!text) return
    setMessages((m) => [...m, { id: Date.now(), role: 'player', text }])
    setInput('')
  }

  function setChangeStatus(id: string, status: ChangeStatus) {
    setChanges((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)))
  }

  function acceptAll() {
    setChanges((prev) =>
      prev.map((c) => (c.status === 'pending' ? { ...c, status: 'accepted' } : c)),
    )
  }

  return (
    <PageShell
      worldName={worldName}
      statusText={hasChanges ? `有 ${pendingCount} 个世界变化等待确认` : '当前世界等待你的下一步'}
      statusMode={hasChanges ? 'warning' : 'normal'}
      showConnectionStatus
      connectionOk={connectionOk}
      connectionIssues={connectionIssues}
    >
      <div className="flex flex-1 overflow-hidden">
        {/* 左侧会话列表（桌面端显示） */}
        <aside className="hidden w-52 shrink-0 flex-col border-r border-border/60 bg-sidebar/60 px-3 py-4 lg:flex">
          <p className="px-2 pb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            记忆之径
          </p>
          <div className="flex flex-col gap-1">
            {conversations.map((c) => (
              <button
                key={c.id}
                className={cn(
                  'flex flex-col gap-0.5 rounded-lg border px-3 py-2 text-left transition-colors',
                  c.active
                    ? 'border-gold/40 bg-card text-foreground gold-hairline'
                    : 'border-transparent text-muted-foreground hover:bg-card/70 hover:text-foreground',
                )}
              >
                <span className="font-serif text-sm">{c.title}</span>
                <span className="text-xs text-muted-foreground">{c.meta}</span>
              </button>
            ))}
          </div>
        </aside>

        {/* 中央对话流 */}
        <section className="relative flex flex-1 flex-col overflow-hidden">
          {/* 右侧边缘藤蔓装饰（极淡，不占内容区） */}
          <div
            className="pointer-events-none absolute right-0 top-0 h-full w-16 opacity-[0.07]"
            aria-hidden
            style={{
              backgroundImage: 'url(/02_corner_vine_ornament_alpha.png)',
              backgroundSize: '64px',
              backgroundRepeat: 'repeat-y',
              backgroundPosition: 'right top',
            }}
          />

          {/* 待确认变更提示条 */}
          {hasChanges && (
            <div className="mx-auto mt-3 w-full max-w-2xl px-4">
              <div className="flex items-center justify-between rounded-lg border border-gold/40 bg-gold/8 px-4 py-2.5">
                <span className="flex items-center gap-2 text-sm text-gold-foreground">
                  <LeafIcon className="size-4 shrink-0" />
                  有 {pendingCount} 个世界变化等待确认
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPanelOpen(true)}
                    className="rounded-md border border-gold/40 bg-card/70 px-2.5 py-1 text-xs text-gold-foreground transition-colors hover:bg-gold/15"
                  >
                    查看变化
                  </button>
                  <button
                    onClick={acceptAll}
                    className="rounded-md bg-primary/90 px-2.5 py-1 text-xs text-primary-foreground transition-colors hover:bg-primary"
                  >
                    全部采纳
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 消息流 */}
          <div className="flex-1 overflow-y-auto px-4 py-4 pb-2">
            <div className="mx-auto flex max-w-2xl flex-col gap-3">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    'max-w-[86%] rounded-2xl border px-4 py-3 text-sm leading-relaxed shadow-sm',
                    roleStyles[m.role],
                  )}
                >
                  {m.role === 'world' && (
                    <span className="mb-1.5 block font-serif text-xs text-moss">
                      世界树 · 引导者
                    </span>
                  )}
                  {m.text}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          </div>

          {/* 底部输入栏 */}
          <div className="border-t border-border/60 bg-background/85 px-4 py-3 backdrop-blur-md">
            <div className="mx-auto flex max-w-2xl items-end gap-2">
              <div className="flex flex-1 items-center rounded-2xl border border-border bg-card px-4 py-1.5 shadow-sm transition-colors focus-within:border-gold/60">
                <textarea
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      send()
                    }
                  }}
                  placeholder="向世界树诉说你的下一步…"
                  className="max-h-36 flex-1 resize-none bg-transparent py-1.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
              </div>
              <button
                onClick={send}
                aria-label="发送"
                className="relative flex size-11 shrink-0 items-center justify-center rounded-full bg-primary shadow-sm transition-transform hover:-translate-y-0.5 hover:bg-primary/90 active:translate-y-0"
              >
                <Image
                  src="/08_send_button_icon_alpha.png"
                  alt="发送"
                  fill
                  className="object-contain p-2 brightness-[10]"
                />
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* 世界变更逐条处理面板 */}
      {panelOpen && (
        <ChangePanel
          changes={changes}
          onClose={() => setPanelOpen(false)}
          onSetStatus={setChangeStatus}
          onAcceptAll={acceptAll}
        />
      )}
    </PageShell>
  )
}

/* ─────────── 世界变更处理面板 ─────────── */

function ChangePanel({
  changes,
  onClose,
  onSetStatus,
  onAcceptAll,
}: {
  changes: WorldChange[]
  onClose: () => void
  onSetStatus: (id: string, status: ChangeStatus) => void
  onAcceptAll: () => void
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const pending = changes.filter((c) => c.status === 'pending')

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/25 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-xl flex-col gap-0 overflow-hidden rounded-2xl border border-border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题栏 */}
        <div className="flex items-start justify-between border-b border-border/60 px-6 py-4">
          <div>
            <h2 className="font-serif text-lg font-medium text-foreground">世界变化</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {pending.length > 0
                ? `${pending.length} 条待确认 · 确认后写入世界记忆`
                : '所有变化已处理完毕'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <XIcon className="size-4" />
          </button>
        </div>

        {/* 变化列表 */}
        <div className="max-h-[60vh] overflow-y-auto divide-y divide-border/50">
          {changes.map((c) => (
            <ChangeItem
              key={c.id}
              change={c}
              expanded={expandedId === c.id}
              onToggleExpand={() => setExpandedId(expandedId === c.id ? null : c.id)}
              onSetStatus={onSetStatus}
            />
          ))}
        </div>

        {/* 底部 */}
        <div className="flex items-center justify-between border-t border-border/60 px-6 py-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary"
          >
            稍后再说
          </button>
          {pending.length > 0 && (
            <button
              onClick={() => { onAcceptAll(); onClose() }}
              className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground transition-colors hover:bg-primary/90"
            >
              全部纳入世界
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function ChangeItem({
  change,
  expanded,
  onToggleExpand,
  onSetStatus,
}: {
  change: WorldChange
  expanded: boolean
  onToggleExpand: () => void
  onSetStatus: (id: string, status: ChangeStatus) => void
}) {
  const st = statusLabel[change.status]
  const isPending = change.status === 'pending'

  return (
    <div className="px-6 py-4">
      {/* 顶行：标题 + 状态标签 + 展开 */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-serif text-sm font-medium text-foreground">{change.title}</span>
            <span className={cn('rounded-full px-2 py-0.5 text-xs', st.cls)}>{st.text}</span>
          </div>
          {/* 描述 */}
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{change.desc}</p>
          {/* 影响数值 */}
          <p className="mt-1.5 text-xs font-medium text-gold-foreground">{change.impact}</p>
        </div>
        <button
          onClick={onToggleExpand}
          className="shrink-0 rounded-lg border border-border/60 p-1.5 text-muted-foreground transition-colors hover:bg-secondary"
          aria-label={expanded ? '收起详情' : '查看详情'}
        >
          <ChevronIcon
            className={cn('size-3.5 transition-transform', expanded && 'rotate-90')}
          />
        </button>
      </div>

      {/* 展开详情 */}
      {expanded && (
        <div className="mt-3 rounded-xl border border-gold/25 bg-gold/6 px-4 py-3">
          <p className="text-xs font-medium text-gold-foreground">完整影响说明</p>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{change.detail}</p>
        </div>
      )}

      {/* 操作按钮 —— 仅待确认时显示全部，已处理显示撤销 */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {isPending ? (
          <>
            <button
              onClick={() => onSetStatus(change.id, 'accepted')}
              className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <CheckIcon className="size-3" />
              采纳
            </button>
            <button
              onClick={() => onSetStatus(change.id, 'rejected')}
              className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary"
            >
              <XIcon className="size-3" />
              拒绝
            </button>
            <button
              onClick={() => onSetStatus(change.id, 'stashed')}
              className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary"
            >
              暂存
            </button>
          </>
        ) : (
          <button
            onClick={() => onSetStatus(change.id, 'pending')}
            className="rounded-lg border border-border/60 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary"
          >
            撤回决定
          </button>
        )}
      </div>
    </div>
  )
}
