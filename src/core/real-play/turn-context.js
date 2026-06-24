import { formatDicePromptContext, parseDiceNotation, rollDice } from "../tabletop/dice.js";
import { addDiscoveredClue, addHypothesis, buildVisibleClueContext, createClueBoard } from "../mystery-puzzle/clue-board.js";
import { applyStrategyChoice, buildStrategyResourceContext, createResourcePanel, STRATEGY_CHOICES } from "../strategy-sim/resource-panel.js";
import { createFallbackChapterRecap, shouldCreateChapterRecap } from "../narrative/chapter-recap.js";
import { createQuestTracker, getPlayerVisibleGoals } from "../narrative/quest-tracker.js";
import { inferRhythmTag, rhythmInstruction } from "../narrative/rhythm-tags.js";

function commandValue(input, command) {
  const match = String(input || "").trim().match(new RegExp(`^/${command}\\s+(.+)$`, "i"));
  return match?.[1]?.trim() || "";
}
export function buildRealPlayTurnContext({ modeId = "world-rpg", input = "", engineState = {}, messages = [], rng = Math.random } = {}) {
  const previous = engineState.realPlay || {};
  const state = { ...previous };
  const promptBlocks = [];
  let commandResult = null;

  if (modeId === "tabletop") {
    if (/^\/roll\b/i.test(input)) {
      const parsed = parseDiceNotation(input);
      if (!parsed.ok) return { ok: false, error: parsed.error, state, publicState: {} };
      const diceResult = rollDice(parsed, rng);
      state.tabletop = { ...(previous.tabletop || {}), lastDiceResult: diceResult, diceLog: [...(previous.tabletop?.diceLog || []), diceResult].slice(-50) };
      promptBlocks.push(formatDicePromptContext(diceResult));
      commandResult = { type: "dice", diceResult, authority: "runtime", canonWrites: [] };
    } else if (previous.tabletop?.lastDiceResult) {
      promptBlocks.push(formatDicePromptContext(previous.tabletop.lastDiceResult));
    }
  }

  if (modeId === "mystery-puzzle" || modeId === "murder-mystery") {
    let clueBoard = createClueBoard(previous.mystery?.clueBoard);
    const clueName = commandValue(input, "clue");
    const hypothesis = commandValue(input, "hypothesis");
    if (clueName) {
      const added = addDiscoveredClue(clueBoard, { id: `clue_${Date.now()}`, name: clueName, foundAtTurn: Number(engineState.turnCount || 0) + 1 });
      clueBoard = added.board;
      commandResult = { type: "clue", clue: added.clue, authority: "runtime", canonWrites: [] };
    } else if (hypothesis) {
      const added = addHypothesis(clueBoard, { id: `hyp_${Date.now()}`, statement: hypothesis });
      clueBoard = added.board;
      commandResult = { type: "hypothesis", hypothesis: added.hypothesis, authority: "candidate", canonWrites: [] };
    }
    state.mystery = { clueBoard };
    const visible = buildVisibleClueContext(clueBoard);
    promptBlocks.push(`【调查白板】只可使用以下玩家已知线索与假设：${JSON.stringify(visible)}。不得补入 hidden truth。`);
  }

  if (modeId === "strategy-sim") {
    let resources = createResourcePanel(previous.strategy?.resources);
    const choice = String(input || "").trim().replace(/^\//, "");
    if (STRATEGY_CHOICES.includes(choice)) {
      const applied = applyStrategyChoice(resources, choice);
      resources = applied.resources;
      commandResult = applied.runtimeUpdate;
    }
    state.strategy = { resources };
    promptBlocks.push(`【策略资源】${buildStrategyResourceContext(resources)}。资源变化属于 runtime/candidate，不得直接写 shared canon。`);
  }

  const goalName = commandValue(input, "goal");
  const tracker = createQuestTracker(previous.narrative?.questTracker);
  if (goalName) {
    tracker.activeQuests.push({ id: `quest_${Date.now()}`, name: goalName.slice(0, 120), description: "", progress: 0, discoveredAt: new Date().toISOString(), milestones: [], visibility: "public" });
    commandResult = { type: "quest", quest: tracker.activeQuests.at(-1), authority: "runtime", canonWrites: [] };
  }
  const turn = Number(engineState.turnCount || 0) + 1;
  const recap = shouldCreateChapterRecap({ turn, sceneChanged: engineState.lastSceneChanged === true })
    ? createFallbackChapterRecap({ chapterId: `chapter-${Math.max(1, Math.ceil(turn / 25))}`, startTurn: Math.max(1, turn - 24), endTurn: turn, messages, currentSituation: input })
    : previous.narrative?.latestRecap || null;
  const rhythm = rhythmInstruction(inferRhythmTag({ tension: engineState.emotionState?.tension, sceneChanged: engineState.lastSceneChanged === true, revealRequested: /揭示|真相/.test(input) }));
  state.narrative = { questTracker: tracker, latestRecap: recap, rhythmTag: rhythm.tag };
  const visibleGoals = getPlayerVisibleGoals(tracker);
  if (visibleGoals.activeQuests.length) promptBlocks.push(`【当前目标】${JSON.stringify(visibleGoals)}。未揭示暗线不得进入玩家文本。`);
  promptBlocks.push(`【叙事节奏 ${rhythm.tag}】${rhythm.instruction}`);

  return {
    ok: true,
    state,
    promptBlock: promptBlocks.filter(Boolean).join("\n"),
    commandResult,
    publicState: {
      tabletop: state.tabletop ? { lastDiceResult: state.tabletop.lastDiceResult || null } : null,
      mystery: state.mystery ? buildVisibleClueContext(state.mystery.clueBoard) : null,
      strategy: state.strategy || null,
      narrative: { latestRecap: recap, goals: visibleGoals, rhythmTag: rhythm.tag }
    }
  };
}
