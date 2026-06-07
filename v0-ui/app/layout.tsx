import type { Metadata } from 'next'
import { Geist, Geist_Mono, Cinzel, Noto_Sans_SC, Noto_Serif_SC } from 'next/font/google'
import './globals.css'
import { WorldStateProvider } from '@/components/world-state-provider'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })
const cinzel = Cinzel({
  variable: '--font-cinzel',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
})
const notoSansSC = Noto_Sans_SC({
  variable: '--font-noto-sans-sc',
  subsets: ['latin'],
  weight: ['300', '400', '500', '700'],
})
const notoSerifSC = Noto_Serif_SC({
  variable: '--font-noto-serif-sc',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
})

export const metadata: Metadata = {
  title: 'World Tree Terminal · 世界树终端',
  description: '一个奇幻世界树 AI 叙事终端',
  generator: 'v0.app',
  icons: {
    icon: [
      { url: '/icon-light-32x32.png', media: '(prefers-color-scheme: light)' },
      { url: '/icon-dark-32x32.png', media: '(prefers-color-scheme: dark)' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport = {
  themeColor: '#e9e4d4',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="zh"
      className={`${geistSans.variable} ${geistMono.variable} ${cinzel.variable} ${notoSansSC.variable} ${notoSerifSC.variable} bg-background`}
    >
      <body className="font-sans antialiased">
        <WorldStateProvider>{children}</WorldStateProvider>
      </body>
    </html>
  )
}
