# User Quickstart — World Tree v0.4.2 First-Playable Candidate

> This guide describes the current implemented project, not future V2 plans.

## What This Is

World Tree is a local-first browser console for AI-assisted world, character, workflow, and mode exploration.
Current status: **v0.4.2-v2-engineering-foundation-truth.0**. Full V2 is not complete. Several entries have engineering/service closure, while product-wide playable closure is still incomplete.

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
2. Configure LLM settings (Settings panel → API Key, Base URL, Model).
3. Test LLM connection via the UI or `POST /api/llm/test`.
4. Create a world or load a character.
5. Select a mode (world-rpg, character, quick-setting, etc.).
6. Send a message and observe the response.
7. Save state persists across reloads.
8. Current built-in first-play example: `demo-world-cloud-steam-city` / 云上蒸汽城.
9. Character-card and scriptkill demo content packs are not complete yet; prepare your own character/world/case/script material for entries that require content.

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
- Browser UI is monolithic (`world-tree-console.js`).
- Server routes are monolithic (`server.js` if-chain).

## If Something Fails

Check `docs/DEBUGGING_GUIDE.md`, run `npm run check`, `npm run docs:check`, `npm run real-play:smoke`.
