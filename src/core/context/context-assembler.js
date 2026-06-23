export function assembleContextBlocks(input = {}) {
  const living = input.livingWorldPacket || {};
  const worldbook = living.worldbookContext || {};
  const proximity = living.proximityScope?.rings || {};
  return {
    scene: living.scene ? [living.scene] : input.modeState?.currentScene ? [input.modeState.currentScene] : [],
    recentSceneSummaries: living.sceneSummaries || [], trackingDigest: living.trackingDigest?.recentChanges || [],
    worldState: Object.values(living.worldState?.states || {}), worldbookBase: worldbook.base || [], worldbookContext: worldbook.context || [], worldbookInstant: worldbook.instant || [],
    proximityEntities: [...(proximity.core || []), ...(proximity.near || [])], emotionalInertia: input.characterInertia?.summaries || [], activeWarnings: living.warnings || []
  };
}
