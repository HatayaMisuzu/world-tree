export function normalizeOrganizations(data = {}) {
  const organizations = Array.isArray(data.organizations) ? data.organizations : Object.values(data.organizations || data || {});
  return organizations.map((item, index) => ({
    id: item.id || item.name || `org-${index + 1}`,
    name: item.name || item.id || `Organization ${index + 1}`,
    hierarchy: item.hierarchy || item.rank || "",
    relations: item.relations || {},
    keyFigures: item.keyFigures || item.figures || []
  }));
}

export function organizationSummary(data = {}) {
  return normalizeOrganizations(data).map((item) => `${item.name}${item.hierarchy ? ` / ${item.hierarchy}` : ""}`).join("\n");
}
