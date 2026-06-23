const CRITICAL = ["death", "character_death", "truth_reveal", "world_rule_rewrite", "faction_destruction", "canon_overwrite"];
const MAJOR = ["relationship_break", "alliance", "organization_change", "location_destroyed", "important_clue"];
const LIGHT = ["description", "tag", "metadata", "formatting", "note"];

export function classifyImpact(change = {}) {
  const category = String(change.changeCategory || change.type || "").toLowerCase();
  const text = `${category} ${change.summary || ""}`.toLowerCase();
  let impactLevel = change.impactLevel;
  if (!impactLevel) {
    if (CRITICAL.some((key) => text.includes(key))) impactLevel = "critical";
    else if (MAJOR.some((key) => text.includes(key))) impactLevel = "major";
    else if (LIGHT.some((key) => text.includes(key))) impactLevel = "light";
    else impactLevel = "medium";
  }
  const reversible = change.reversible !== false && (change.oldValue !== undefined || change.rollbackPatch);
  return {
    impactLevel,
    reversible,
    requiresSecondConfirm: impactLevel === "critical",
    autoApproveAllowed: impactLevel === "light" && change.canonical !== true,
    stopLossTurns: impactLevel === "critical" ? 5 : impactLevel === "major" ? 3 : 0
  };
}

export function applyImpactClassification(proposal = {}) { return { ...proposal, ...classifyImpact(proposal) }; }
