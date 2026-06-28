export function createWorldbookUsageLog(input={}) {
  return { version:2, worldId:String(input.worldId || ""), records:Array.isArray(input.records) ? [...input.records] : [], createdAt:input.createdAt || new Date().toISOString() };
}
export function appendWorldbookUsage(log, pack, options={}) {
  const target = log || createWorldbookUsageLog(options);
  const record = Object.freeze({ id:`wbusage_${Date.now()}_${Math.random().toString(36).slice(2,8)}`, contextPackId:pack.contextPackId, modeId:pack.modeId, taskId:pack.taskId, turnId:pack.turnId || options.turnId || "", activatedCount:pack.activationLog?.length || 0, omittedCount:pack.omitted?.length || 0, visibilityWarningCount:pack.visibilityWarnings?.length || 0, activatedEntries:(pack.activationLog || []).map(x=>({ entryId:x.entryId, title:x.title, reason:x.reason, contextSlot:x.contextSlot })), omitted:pack.omitted || [], tokenUsage:pack.tokenUsage || {}, createdAt:options.now || new Date().toISOString() });
  target.records.push(record);
  return { ok:true, record, log:target };
}
export function summarizeWorldbookUsage(log={}) {
  const records = log.records || [];
  return { totalRecords:records.length, totalActivated:records.reduce((s,x)=>s+Number(x.activatedCount||0),0), totalOmitted:records.reduce((s,x)=>s+Number(x.omittedCount||0),0), totalVisibilityWarnings:records.reduce((s,x)=>s+Number(x.visibilityWarningCount||0),0) };
}
