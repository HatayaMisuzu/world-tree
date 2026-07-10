# User Quickstart — World Tree v0.5 Product Experience Rebuild

> This guide describes the current implemented project, not future V2 plans.

## What This Is

World Tree is a local-first browser console for AI-assisted world, character, workflow, and mode exploration.
Current status: **v0.5.0-product-experience-rebuild.0**. Full V2 is not complete. Automated product-shell and selected provider paths pass; human-signed playable closure is still incomplete.

## Install

```bash
npm install
```

## Start

```bash
npm start
```

Then open: `http://localhost:3000`

## First Use Checklist

1. Open `http://localhost:3000` in a browser.
2. Open 设置 → 模型连接, configure API Key, Base URL, and model, then test the connection.
3. Return to 首页 and choose “从示例开始”, or open 体验 / 创作.
4. Send an action and observe the streamed world response and current-world state.
5. Review pending changes before allowing them into formal world state.
6. Completed turns save automatically; return Home and continue to verify history.
7. Current built-in first-play example: `demo-world-cloud-steam-city` / 云上蒸汽城.
8. Character-card and ScriptKill demo packs remain incomplete; bring your own lawful content for entries that require it.

## Current Modes

| Mode | What it does |
|---|---|
| quick-setting | Rapid world concept testing (thin loop) |
| character | Chat with characters; Character V2 long-term slice available |
| world-rpg | Free-form world exploration; Worldbook V2 engineering foundation complete, product closure incomplete |
| tabletop | Tabletop narrative with dice/clocks (experimental slice; service closure complete) |
| mystery-puzzle | Hidden-truth mystery (experimental slice; Detective V2 service closure complete) |
| strategy-sim | Strategy prototyping (engineering foundation complete; product closure incomplete) |
| murder-mystery | Murder mystery (experimental slice; ScriptKill V2 service closure complete) |
| creation-forge | Material ingestion & review (producer tool, not a normal play entry) |

See `docs/PLAY_MODE_GUIDE.md` for mode details and limitations.

## Current Limits

- Full V2 is not implemented.
- Product-wide playable closure is not complete.
- V2 Entry Closure means engineering/service closure, not full product closure.
- Advanced editors and complete game systems remain incomplete for several modes.
- Human playtest and screen recording are still required before `PLAYABLE` can be human-signed.

## If Something Fails

Check `docs/DEBUGGING_GUIDE.md`, run `npm run check`, `npm run docs:check`, `npm run real-play:smoke`.
