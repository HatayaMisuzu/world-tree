'use client'

import Link from 'next/link'
import { useState } from 'react'
import { PageShell } from '@/components/page-shell'
import {
  ChevronIcon,
  ArrowUp,
  ArrowDown,
  ShieldIcon,
  CheckIcon,
  XIcon,
  AlertIcon,
  SettingsIcon,
  EyeIcon,
} from '@/components/icons'
import { cn } from '@/lib/utils'
import { type SystemState } from '@/lib/world-state'
import { useWorldState } from '@/components/world-state-provider'

type Trend = 'up' | 'down' | 'flat'
type ChangeStatus = 'pending' | 'accepted' | 'rejected'

const metrics: {
  label: string
  value: number
  trend: Trend
  tone: 'moss' | 'gold' | 'warn'
}[] = [
  { label: '稳定度', value: 0, trend: 'flat', tone: 'moss' },
  { label: '混乱度', value: 0, trend: 'flat', tone: 'warn' },
  { label: '神秘度', value: 0, trend: 'flat', tone: 'gold' },
  { label: '战争风险', value: 0, trend: 'flat', tone: 'warn' },
  { label: '角色压力', value: 0, trend: 'flat', tone: 'gold' },
  { label: '阵营冲突', value: 0, trend: 'flat', tone: 'warn' },
  { label: '规则完整度', value: 0, trend: 'flat', tone: 'moss' },
  { label: '记忆负载', value: 0, trend: 'flat', tone: 'gold' },
]

const toneColor: Record<string, string> = {
  moss: 'var(--moss)',
  gold: 'var(--gold)',
  warn: 'var(--destructive)',
}

type ChangeRequest = {
  id: string
  title: string
  impact: string
  impactDetail: string[]
  desc: string
  detail: string
  status: ChangeStatus
}

const initialChanges: ChangeRequest[] = []

// ─── 从 SystemState 推导诊断项列表 ──────────────────
function buildDiagItems(s: SystemState): { label: string; key: string; ok: boolean; value: string; hint?: string }[] {
  return [
    {
      label: 'LLM 状态',
      key: 'llm',
      ok: s.llmConnected,
      value: s.llmConnected ? '在线' : '未连接',
      hint: s.llmConnected ? undefined : (s.llmError ?? '请检查服务地址与访问密钥'),
    },
    {
      label: 'Hermes API',
      key: 'hermes',
      ok: s.hermesConnected,
      value: s.hermesConnected ? '在线' : '未连接',
      hint: s.hermesConnected ? undefined : (s.hermesError ?? '需要配置 Hermes 服务地址'),
    },
    {
      label: 'DM 模块',
      key: 'dm',
      ok: s.dmLoaded,
      value: s.dmLoaded ? '已载入' : '未载入',
      hint: s.dmLoaded ? undefined : '请重启 DM 服务后重试',
    },
    {
      label: '世界书注入',
      key: 'wb',
      ok: s.worldbookInjected,
      value: s.worldbookInjected ? '已就绪' : '未注入',
      hint: s.worldbookInjected ? undefined : '请在设置 > 世界书中检查条目状态',
    },
    {
      label: '叙事档案',
      key: 'arch',
      ok: s.archiveOk,
      value: s.archiveOk ? '正常' : '异常',
      hint: s.archiveOk ? undefined : '存档文件可能损坏，建议备份后重置',
    },
    {
      label: '待处理队列',
      key: 'queue',
      ok: s.queueCount === 0,
      value: s.queueCount === 0 ? '0 项' : `${s.queueCount} 项`,
      hint: s.queueCount > 0 ? '前往观测终端处理待裁决变更' : undefined,
    },
  ]
}

export function ObservatoryView() {
  const { worldName, systemState } = useWorldState()
  return (
    <PageShell worldName={worldName} statusText="观测终端 · 凝望世界">
      <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
        <div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-[1fr_300px]">
          {/* 主区 */}
          <div className="flex flex-col gap-5">
            <PulseOverview />
            <MetricsGrid />
            <DiagnosticsPanel systemState={systemState} />
          </div>

          {/* 右侧 */}
          <aside className="flex flex-col gap-4">
            <ChangeRequests />
            <NarrativeGuardian />
          </aside>
        </div>
      </div>
    </PageShell>
  )
}

/* ─────────── 世界脉象总览 ─────────── */
function PulseOverview() {
  return (
    <section className="rounded-2xl border border-border/70 bg-card/70 p-5 gold-hairline">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">世界脉象总览</p>
          <h2 className="mt-1 font-serif text-2xl font-medium text-foreground">
            稳定 · 暗流渐生
          </h2>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-gold/15 px-3 py-1 text-sm text-gold-foreground">
          <ArrowUp className="size-3.5" />
          等待数据
        </span>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        暂无叙事轮次数据。开始对话或载入世界后，这里会显示最近一轮的世界脉象摘要。
      </p>
    </section>
  )
}

/* ─────────── 指标网格 ─────────── */
function MetricsGrid() {
  return (
    <section>
      <p className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">世界指标</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {metrics.map((m) => (
          <MetricGauge key={m.label} {...m} />
        ))}
      </div>
    </section>
  )
}

function MetricGauge({
  label,
  value,
  trend,
  tone,
}: {
  label: string
  value: number
  trend: Trend
  tone: string
}) {
  const color = toneColor[tone]
  return (
    <div className="rounded-xl border border-border/60 bg-card/60 p-3.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        {trend === 'up' && <ArrowUp className="size-3 text-gold-foreground" />}
        {trend === 'down' && <ArrowDown className="size-3 text-moss" />}
        {trend === 'flat' && <span className="h-px w-3 bg-muted-foreground/50" />}
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="font-mono text-2xl font-medium text-foreground">{value}</span>
        <span className="text-xs text-muted-foreground">/100</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

/* ─────────── 世界变更请求 ─────────── */
function ChangeRequests() {
  const [changes, setChanges] = useState<ChangeRequest[]>(initialChanges)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [impactId, setImpactId] = useState<string | null>(null)

  function setStatus(id: string, status: ChangeStatus) {
    setChanges((c) => c.map((ch) => (ch.id === id ? { ...ch, status } : ch)))
  }

  const pending = changes.filter((c) => c.status === 'pending')

  const statusLabel: Record<ChangeStatus, { text: string; cls: string }> = {
    pending: { text: '待裁决', cls: 'bg-gold/15 text-gold-foreground' },
    accepted: { text: '已采纳', cls: 'bg-primary/15 text-primary' },
    rejected: { text: '已拒绝', cls: 'bg-destructive/12 text-destructive' },
  }

  return (
    <div className="rounded-2xl border border-border/70 bg-card/70 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="font-serif text-sm font-medium text-foreground">世界变更请求</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {pending.length > 0 ? `${pending.length} 条等待裁决` : '所有变更已处理'}
          </p>
        </div>
        {pending.length === 0 && changes.length > 0 && (
          <span className="rounded-full bg-moss/15 px-2 py-0.5 text-xs text-moss">已清空</span>
        )}
      </div>

      {changes.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted-foreground">暂无待处理变更</p>
      ) : (
        <div className="flex flex-col gap-3">
          {changes.map((c) => {
            const st = statusLabel[c.status]
            const isPending = c.status === 'pending'
            const showDetail = expandedId === c.id
            const showImpact = impactId === c.id

            return (
              <div
                key={c.id}
                className={cn(
                  'rounded-xl border p-3 transition-colors',
                  isPending
                    ? 'border-border/70 bg-secondary/40'
                    : 'border-border/40 bg-secondary/20 opacity-75',
                )}
              >
                {/* 标题��� */}
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="font-serif text-sm font-medium text-foreground">{c.title}</p>
                      <span className={cn('rounded-full px-2 py-0.5 text-xs', st.cls)}>
                        {st.text}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-gold-foreground">{c.impact}</p>
                  </div>
                </div>

                {/* 展开：详情 */}
                {showDetail && (
                  <div className="mt-2.5 rounded-xl border border-border/50 bg-card/60 p-3">
                    <p className="mb-1.5 text-xs font-medium text-foreground/70">变更说明</p>
                    <p className="text-xs leading-relaxed text-muted-foreground">{c.detail}</p>
                  </div>
                )}

                {/* 展开：影响明细 */}
                {showImpact && (
                  <div className="mt-2.5 rounded-xl border border-gold/25 bg-gold/6 p-3">
                    <p className="mb-2 text-xs font-medium text-gold-foreground">具体影响</p>
                    <ul className="flex flex-col gap-1.5">
                      {c.impactDetail.map((line, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                          <span className="mt-1 size-1.5 shrink-0 rounded-full bg-gold" />
                          {line}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 操作按钮 */}
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {isPending ? (
                    <>
                      <button
                        onClick={() => setStatus(c.id, 'accepted')}
                        className="flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs text-primary-foreground transition-colors hover:bg-primary/90"
                      >
                        <CheckIcon className="size-3" />
                        采纳
                      </button>
                      <button
                        onClick={() => setStatus(c.id, 'rejected')}
                        className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-card"
                      >
                        <XIcon className="size-3" />
                        拒绝
                      </button>
                      <button
                        onClick={() => setImpactId(impactId === c.id ? null : c.id)}
                        className={cn(
                          'rounded-lg border px-2.5 py-1.5 text-xs transition-colors',
                          impactId === c.id
                            ? 'border-gold/50 bg-gold/10 text-gold-foreground'
                            : 'border-border text-muted-foreground hover:bg-card',
                        )}
                      >
                        影响
                      </button>
                      <button
                        onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                        className={cn(
                          'flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs transition-colors',
                          expandedId === c.id
                            ? 'border-border bg-secondary text-foreground'
                            : 'border-border text-muted-foreground hover:bg-card',
                        )}
                      >
                        <EyeIcon className="size-3" />
                        查看详情
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setStatus(c.id, 'pending')}
                      className="rounded-lg border border-border/50 px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-card"
                    >
                      撤回决定
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ─────────── 叙事守护 ─────────── */
function NarrativeGuardian() {
  const hints = [
    { tone: 'gold', text: '神秘度上升较快，注意保持悬念与解答的平衡。' },
    { tone: 'moss', text: '暂无高风险冲突，世界规则保持自洽。' },
    { tone: 'moss', text: '记忆负载尚在安全区间（53/70），无需清理。' },
  ]
  return (
    <div className="rounded-2xl border border-border/70 bg-card/70 p-4">
      <div className="flex items-center gap-2">
        <ShieldIcon className="size-4 text-moss" />
        <p className="font-serif text-sm font-medium text-foreground">叙事守护</p>
      </div>
      <ul className="mt-3 flex flex-col gap-2">
        {hints.map((h, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
            <span
              className={cn(
                'mt-1 size-1.5 shrink-0 rounded-full',
                h.tone === 'gold' ? 'bg-gold' : 'bg-moss',
              )}
            />
            {h.text}
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ─────────── 系统诊断折叠区 ─────────── */

function DiagnosticsPanel({ systemState }: { systemState: SystemState }) {
  const [open, setOpen] = useState(false)
  const diagItems = buildDiagItems(systemState)
  const hasIssues = diagItems.some((d) => !d.ok)
  const issueCount = diagItems.filter((d) => !d.ok).length

  return (
    <section className="rounded-2xl border border-border/70 bg-card/60">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-5 py-3.5 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="font-serif text-sm font-medium text-foreground">系统诊断</span>
          {hasIssues ? (
            <span className="flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-xs text-destructive">
              <AlertIcon className="size-3" />
              {issueCount} 项异常
            </span>
          ) : (
            <span className="rounded-full bg-moss/15 px-2 py-0.5 text-xs text-moss">全部正常</span>
          )}
        </div>
        <ChevronIcon
          className={cn('size-4 text-muted-foreground transition-transform', open && 'rotate-90')}
        />
      </button>

      {open && (
        <div className="border-t border-border/60 px-5 py-4">
          {/* 诊断项网格 */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {diagItems.map((it) => (
              <div key={it.key} className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">{it.label}</span>
                <span
                  className={cn(
                    'flex items-center gap-1.5 text-sm',
                    it.ok ? 'text-moss' : 'text-destructive',
                  )}
                >
                  <span
                    className={cn('size-2 shrink-0 rounded-full', it.ok ? 'bg-moss' : 'bg-destructive')}
                  />
                  {it.value}
                </span>
                {!it.ok && it.hint && (
                  <span className="text-xs text-muted-foreground">{it.hint}</span>
                )}
              </div>
            ))}
          </div>

          {/* 异常汇总与入口 */}
          {hasIssues && (
            <div className="mt-4 flex flex-col gap-2">
              <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/8 px-4 py-3">
                <AlertIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
                <div className="flex-1">
                  <p className="text-xs font-medium text-destructive">检测到以下系统异常：</p>
                  <ul className="mt-1.5 flex flex-col gap-1">
                    {diagItems.filter((d) => !d.ok).map((d) => (
                      <li key={d.key} className="flex items-center gap-1.5 text-xs text-destructive">
                        <span className="size-1.5 rounded-full bg-destructive" />
                        {d.label} · {d.value}
                        {d.hint && <span className="text-destructive/70">（{d.hint}）</span>}
                      </li>
                    ))}
                  </ul>
                </div>
                <Link
                  href="/settings?section=model"
                  className="flex shrink-0 items-center gap-1 self-start rounded-md border border-destructive/40 px-2.5 py-1 text-xs text-destructive transition-colors hover:bg-destructive/15"
                >
                  <SettingsIcon className="size-3" />
                  进入设置
                </Link>
              </div>
            </div>
          )}

          {/* 正常状态低干扰 */}
          {!hasIssues && (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-moss/30 bg-primary/6 px-4 py-2.5 text-xs text-moss">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-moss/50" />
                <span className="relative inline-flex size-2 rounded-full bg-moss" />
              </span>
              所有系统运行正常，世界树与灵思链路稳定。
            </div>
          )}
        </div>
      )}
    </section>
  )
}
