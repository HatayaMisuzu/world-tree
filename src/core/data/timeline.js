export function advanceTime(timeline = {}, step = "scene") {
  const events = Array.isArray(timeline.events) ? timeline.events : [];
  return {
    ...timeline,
    step,
    updatedAt: new Date().toISOString(),
    events: [...events, { type: "advance", step, at: new Date().toISOString() }]
  };
}

export function timeSummary(timeline = {}) {
  return timeline.current || timeline.time || timeline.updatedAt || "时间未设定";
}
