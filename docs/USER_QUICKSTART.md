# User Quickstart — World Tree v0.4.0 Pre-V2 Closure

> This guide describes the current implemented project, not future V2 plans.

## What This Is

World Tree is a local-first browser console for AI-assisted world, character, workflow, and mode exploration. Current status: **v0.4.0 Pre-V2 Closure baseline** — not full V2, not a finished commercial game.

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

## Current Modes

| Mode | What it does |
|---|---|
| quick-setting | Rapid world concept testing |
| character | Chat with character cards |
| world-rpg | Free-form world exploration |
| tabletop | Campaign management socket |
| mystery-puzzle | Hidden-truth mystery |
| strategy-sim | Strategy prototyping |
| murder-mystery | Murder mystery |
| creation-forge | Material ingestion & review |

See `docs/PLAY_MODE_GUIDE.md` for mode details and limitations.

## Current Limits

- Full V2 is not implemented.
- Some modes are thin slices or V2-ready sockets.
- Browser UI is monolithic (`world-tree-console.js`).
- Server routes are monolithic (`server.js` if-chain).

## If Something Fails

Check `docs/DEBUGGING_GUIDE.md`, run `npm run check`, `npm run docs:check`, `npm run real-play:smoke`.
