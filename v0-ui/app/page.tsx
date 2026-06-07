import { MainMenu } from '@/components/main-menu'

/**
 * 世界状态由 <WorldStateProvider>（app/layout.tsx）统一提供，
 * 页面不再传任何业务 props，组件内部用 useWorldState() 消费。
 */
export default function Page() {
  return <MainMenu />
}
