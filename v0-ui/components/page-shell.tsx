'use client'

import Link from 'next/link'
import { BackIcon, WorldTreeMark, PulseIcon, AlertIcon } from '@/components/icons'

type StatusMode = 'normal' | 'warning'

type PageShellProps = {
  /** 当前世界名，必须从外部传入，不允许写死默认值 */
  worldName: string
  /** 顶部业务状态文字 */
  statusText?: string
  statusMode?: StatusMode
  children: React.ReactNode
  actions?: React.ReactNode
  /** 是否显示左下角连接状态（对话页专用） */
  showConnectionStatus?: boolean
  /** true = 世界连接稳定，false = 有问题 */
  connectionOk?: boolean
  /** 具体异常文案数组，支持多条，如 ['LLM 未连接', 'DM 未载入'] */
  connectionIssues?: string[]
}

export function PageShell({
  worldName,
  statusText = '世界脉象 稳定',
  statusMode = 'normal',
  children,
  actions,
  showConnectionStatus = false,
  connectionOk = true,
  connectionIssues = [],
}: PageShellProps) {
  return (
    <div className="relative flex min-h-screen flex-col bg-background paper-grain">
      {/* 顶部窄栏 */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-border/70 bg-background/88 px-4 py-2.5 backdrop-blur-md md:px-6">
        <div className="flex items-center gap-3">
          {/* 返回主菜单 — 显示文字 */}
          <Link
            href="/"
            className="flex items-center gap-1.5 rounded-lg border border-border/70 bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-gold/60 hover:text-foreground"
          >
            <BackIcon className="size-3.5" />
            <span className="font-serif text-xs">主菜单</span>
          </Link>
          <div className="flex items-center gap-2">
            <WorldTreeMark className="size-5 text-moss" />
            <span className="font-serif text-sm font-medium text-foreground">
              {worldName}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {statusText && (
            <div
              className={`hidden items-center gap-1.5 rounded-full border px-3 py-1 text-xs sm:flex ${
                statusMode === 'warning'
                  ? 'border-destructive/40 bg-destructive/8 text-destructive'
                  : 'border-gold/40 bg-gold/10 text-gold-foreground'
              }`}
            >
              {statusMode === 'warning' ? (
                <AlertIcon className="size-3.5" />
              ) : (
                <PulseIcon className="size-3.5" />
              )}
              <span>{statusText}</span>
            </div>
          )}
          {actions}
        </div>
      </header>

      {/* 内容区 */}
      <div className="relative flex flex-1 flex-col overflow-hidden">
        {children}
      </div>

      {/* 对话页专用左下角连接状态 */}
      {showConnectionStatus && (
        <div className="pointer-events-none fixed bottom-4 left-4 z-20">
          {connectionOk ? (
            <div className="flex items-center gap-2 rounded-full border border-border/50 bg-card/80 px-3 py-1 backdrop-blur-sm">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-moss/50" />
                <span className="relative inline-flex size-2 rounded-full bg-moss" />
              </span>
              <span className="text-xs text-muted-foreground">世界连接稳定</span>
            </div>
          ) : (
            <div className="pointer-events-auto flex flex-col gap-1">
              {connectionIssues.map((issue) => (
                <Link
                  key={issue}
                  href="/observatory?section=diagnostics"
                  className="flex items-center gap-2 rounded-full border border-destructive/40 bg-card/80 px-3 py-1 backdrop-blur-sm transition-colors hover:border-destructive/70"
                >
                  <span className="size-2 rounded-full bg-destructive" />
                  <span className="text-xs text-destructive">{issue}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
