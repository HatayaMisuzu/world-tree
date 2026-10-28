/**
 * S4-4: wire keepable timeline-causality.js into the main turn path.
 *
 * Records worldTick / LOD offscreen / random (director) world events into the
 * existing causality DAG. Does NOT invent a parallel event bus and does NOT
 * bypass proposal-bus / overlay WRITE_POLICY — this is recording only.
 */
import {
  createTimelineEvent,
  EVENT_TYPE,
  EVENT_STATUS,
  getCausalGraph
} from "../data/timeline-causality.js";

const OFFSCREEN_MODES = new Set(["far", "catchup", "dormant"]);

function timeLabel(calendar, round) {
  if (calendar && Number.isFinite(Number(calendar.totalDays))) {
    return `day-${Number(calendar.totalDays)}`;
  }
  return `turn-${Number(round) || 0}`;
}

function safeEvent(opts) {
  const ev = createTimelineEvent(opts);
  return ev && !ev.error ? ev : null;
}

/**
 * @param {object} bag
 * @param {object|null} [bag.tickDelta] worldTick delta
 * @param {object|null} [bag.calendar]
 * @param {object[]} [bag.lodReports] from evolveNpcsByLod
 * @param {object|null} [bag.randomEvent] director / overlay random event
 * @param {number} [bag.round]
 * @param {string} [bag.branchId]
 * @returns {{ eventIds: string[], tickEventId: string|null, graph: object }}
 */
export function recordTurnCausality({
  tickDelta = null,
  calendar = null,
  lodReports = [],
  randomEvent = null,
  round = 0,
  branchId = "main"
} = {}) {
  const eventIds = [];
  const time = timeLabel(calendar, round);
  let tickEventId = null;

  if (tickDelta && typeof tickDelta === "object") {
    const reason = tickDelta.reason || "tick";
    const title = reason === "travel"
      ? `旅行 ${tickDelta.from || "?"} → ${tickDelta.to || "?"}`
      : `世界推进 (${reason}, Δ${tickDelta.amount ?? 1}${tickDelta.unit || ""})`;
    const ev = safeEvent({
      title,
      time,
      type: EVENT_TYPE.PRESENT,
      status: EVENT_STATUS.CONFIRMED,
      description: `worldTick:${reason}`,
      relatedEntities: {
        locations: [tickDelta.from, tickDelta.to].filter(Boolean)
      },
      branchId
    });
    if (ev) {
      tickEventId = ev.id;
      eventIds.push(ev.id);
    }
  }

  for (const report of Array.isArray(lodReports) ? lodReports : []) {
    if (!report || !(Number(report.days) > 0)) continue;
    const mode = String(report.mode || "");
    // Offscreen / wake only — skip near/core fine steps (on-screen-ish).
    if (mode === "near") continue;
    if (!OFFSCREEN_MODES.has(mode) && !report.wake) continue;

    const npcId = report.id || "npc";
    const title = report.wake || mode === "catchup"
      ? `LOD wake补算 ${npcId} (+${report.days}d)`
      : mode === "far"
        ? `LOD 远距摘要 ${npcId} (+${report.days}d)`
        : `LOD 离屏 ${npcId} (${mode}, +${report.days}d)`;

    const ev = safeEvent({
      title,
      time,
      type: EVENT_TYPE.PRESENT,
      status: EVENT_STATUS.CONFIRMED,
      description: `lod:${mode}`,
      dependsOn: tickEventId ? [tickEventId] : [],
      relatedEntities: { characters: [npcId] },
      branchId
    });
    if (ev) eventIds.push(ev.id);
  }

  if (randomEvent && typeof randomEvent === "object") {
    const title = randomEvent.title || randomEvent.name || "世界事件";
    const chars = randomEvent.characters
      || randomEvent.relatedCharacters
      || randomEvent.relatedEntities?.characters
      || [];
    const locs = randomEvent.location
      ? [randomEvent.location]
      : (randomEvent.relatedEntities?.locations || []);
    const ev = safeEvent({
      title,
      time,
      type: EVENT_TYPE.PRESENT,
      status: EVENT_STATUS.CONFIRMED,
      description: randomEvent.description || randomEvent.summary || "world-event",
      dependsOn: tickEventId ? [tickEventId] : [],
      relatedEntities: {
        characters: Array.isArray(chars) ? chars : [],
        locations: Array.isArray(locs) ? locs : []
      },
      branchId
    });
    if (ev) eventIds.push(ev.id);
  }

  return {
    eventIds,
    tickEventId,
    graph: getCausalGraph()
  };
}

export default { recordTurnCausality };
