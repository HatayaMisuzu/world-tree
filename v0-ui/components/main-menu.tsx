'use client'

import Image from 'next/image'
import Link from 'next/link'
import {
  LeafIcon,
  BookIcon,
  CompassIcon,
  ObserveIcon,
  SpiralIcon,
} from '@/components/icons'
import { useWorldState } from '@/components/world-state-provider'

type MenuItem = {
  label: string
  hint: string
  href: string
  asset: string
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
}

const items: MenuItem[] = [
  {
    label: '开始旅程',
    hint: '踏入世界树的新章',
    href: '/dialogue',
    asset: '/04_leaf_icon_alpha.png',
    Icon: LeafIcon,
  },
  {
    label: '读取记忆',
    hint: '回到往昔的记忆点',
    href: '/memory',
    asset: '/05_memory_book_icon_alpha.png',
    Icon: BookIcon,
  },
  {
    label: '世界设定',
    hint: '编织世界的根脉',
    href: '/settings',
    asset: '/06_world_setting_icon_alpha.png',
    Icon: CompassIcon,
  },
  {
    label: '观测终端',
    hint: '凝视世界的脉象',
    href: '/observatory',
    asset: '/07_observation_terminal_icon_alpha.png',
    Icon: ObserveIcon,
  },
]

export function MainMenu() {
  const { worldName } = useWorldState()
  return (
    <main className="relative min-h-screen w-full overflow-hidden">
      {/* 背景图 */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: 'url(/world-tree-hero.png)' }}
        aria-hidden
      />
      {/* 右侧渐隐 */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(90deg, color-mix(in oklch, var(--background) 15%, transparent) 0%, transparent 40%, color-mix(in oklch, var(--background) 82%, transparent) 100%)',
        }}
        aria-hidden
      />
      {/* 纸张质感 */}
      <div className="absolute inset-0 paper-grain opacity-15 mix-blend-multiply" aria-hidden />

      {/* 右上角藤蔓装饰 */}
      <div className="pointer-events-none absolute right-0 top-0 size-48 opacity-20" aria-hidden>
        <Image
          src="/02_corner_vine_ornament_alpha.png"
          alt=""
          fill
          className="object-contain object-right-top"
        />
      </div>

      {/* 内容 */}
      <div className="relative z-10 flex min-h-screen flex-col">
        <div className="flex flex-1 items-center justify-center px-6 py-12 md:justify-end md:px-16 lg:px-28">
          <div className="flex w-full max-w-md flex-col items-center text-center md:items-start md:text-left">

            {/* 世界树纹章 */}
            <div className="relative mb-5 size-20">
              <Image
                src="/01_world_tree_badge_alpha.png"
                alt="世界树纹章"
                fill
                className="object-contain drop-shadow-sm"
                priority
              />
            </div>

            {/* 副标题 */}
            <p className="font-serif text-sm tracking-[0.5em] text-bark/80">
              世 界 树 终 端
            </p>

            {/* 主标题 */}
            <h1
              className="mt-2 text-5xl font-semibold leading-none tracking-wide text-foreground drop-shadow-sm md:text-6xl lg:text-7xl"
              style={{ fontFamily: 'var(--font-cinzel), serif' }}
            >
              WORLD
              <br />
              TREE
            </h1>

            {/* 当前世界 */}
            <p className="mt-3 font-serif text-sm text-muted-foreground">
              {worldName}
            </p>

            {/* 主入口 */}
            <nav className="mt-8 flex w-full flex-col gap-2.5" aria-label="主入口">
              {items.map(({ label, hint, href, asset }) => (
                <Link
                  key={href}
                  href={href}
                  className="group flex items-center gap-4 rounded-xl border border-border/70 bg-card/80 px-5 py-3.5 text-left shadow-sm backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-gold/70 hover:bg-card hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="relative flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary/80 transition-colors group-hover:bg-gold/15">
                    <Image
                      src={asset}
                      alt=""
                      fill
                      className="object-contain p-1.5"
                    />
                  </span>
                  <span className="flex flex-col">
                    <span className="font-serif text-base font-medium text-foreground">
                      {label}
                    </span>
                    <span className="text-xs text-muted-foreground">{hint}</span>
                  </span>
                </Link>
              ))}
            </nav>
          </div>
        </div>

        <footer className="relative z-10 flex items-center justify-end px-6 py-4 md:px-10">
          {/* 低存在感专家入口 */}
          <Link
            href="/settings?section=advanced"
            aria-label="专家设置入口"
            className="flex size-9 items-center justify-center rounded-full border border-border/50 bg-card/50 text-muted-foreground/70 backdrop-blur-sm transition-colors hover:border-gold/60 hover:text-foreground"
          >
            <SpiralIcon className="size-4" />
          </Link>
        </footer>
      </div>
    </main>
  )
}
