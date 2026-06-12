export function filterKnownFacts(facts = [], character = {}) {
  const known = new Set(character.knownFactIds || character.known || []);
  return facts.filter((fact) => !fact.secret || known.has(fact.id));
}

export function cognitionBoundary(character = {}) {
  return {
    name: character.name || character.id || "unknown",
    known: character.known || [],
    secrets: character.secrets || [],
    rule: "角色只能表达自己已知事实，秘密和上帝视角不得泄露。"
  };
}
