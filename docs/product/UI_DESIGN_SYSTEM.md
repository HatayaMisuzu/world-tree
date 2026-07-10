# World Tree UI Design System — Living Archive

## Visual source

The v0.5 visual specification is [living-archive-product-concept.png](../../design/v0.5/living-archive-product-concept.png). It contains the 1440×900 home, 1440×900 experience workspace, and 390×844 mobile continuation states.

The product idea is **Living Archive / 生长中的世界档案**: the interface should feel like entering, continuing, and tending a persistent world. It must not read as an engineering control panel.

## Color lock

- Canvas: warm paper `#f4f0e6`.
- Surfaces: `#fffdf7` and true white elevated controls.
- Sidebar: near-black forest `#102f25` → `#0d291f`.
- Primary action: forest `#174c38`.
- Secondary accent: moss `#6f8f68`.
- Warning: amber `#c4832d`.
- Information: river `#547f98`.
- Text: ink `#1d2822`; muted `#758078`.

Implementation tokens live in `browser/styles/tokens.css` and use the required `--wt-*` namespace. Business views should not add standalone colors when an existing token communicates the same meaning.

## Typography

- UI chrome and controls: system Chinese sans (`--wt-font-ui`), explicit weight and size.
- Narrative titles and reading passages: restrained Chinese serif (`--wt-font-reading`).
- Diagnostics only: `--wt-font-mono`.

## Container model

Use open rails, ruled lists, a narrative canvas, a single contextual sidebar, and occasional bounded panels. Avoid nested cards and default bento grids. Modest 6/10/14px radii and thin borders keep the product archival rather than toy-like.

## Component families

- Primary, secondary, ghost, danger, small, disabled, busy buttons.
- Inputs, textareas, selects, drop zones, validation states.
- Status badges for saved/connected/loading/warning/error; color never carries meaning alone.
- Ruled list rows, open sections, timelines, narrative messages, proposal rows.
- Tabs as an underline rail, not filled pills.
- Drawer/dialog with `aria-modal`, initial focus, Escape close, and labeled close action.
- Toast host uses polite live-region semantics.

## Responsive behavior

- 1440: dark global sidebar, sticky context topbar, open workspace.
- 1024/768: narrower sidebar, stacked context panels where required.
- 390: sidebar disappears; five-item bottom navigation remains reachable; content receives safe bottom padding; no normal horizontal page scrolling.
- Complex context moves into a drawer rather than compressing into unreadable columns.

## Motion and accessibility

- Focus uses the `--wt-focus-ring` token and is visible on every keyboard-operable element.
- `prefers-reduced-motion: reduce` removes non-essential transitions and animation.
- Main text/control contrast targets WCAG AA.
- Toasts, save state, model state, drawers, and dialogs expose accessible status or names.

## Above-the-fold copy lock

The home may use: `首页`, `继续探索`, `安装示例世界并开始`, `进入一个世界`, `与一个角色互动`, `从自己的内容开始`, `最近打开的项目`, `待确认的世界变化`, `配置模型`.

The experience workspace may use: project/scene name, `已保存`, model status, `你的行动`, AI character/narration label, `系统事件`, `待确认的世界变化`, `已确认的设定`, `建议行动`, `发送`, `停止`, `当前角色`, `世界状态`, `线索与资源`, `历史与分支`.

Do not add engineering labels such as V2, candidate, canon, service loop, closure, or spec seal to the ordinary product surface.
