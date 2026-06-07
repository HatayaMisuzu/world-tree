// ===== M10 种族维度模块 =====
// v12.19: 从世界书skill移植。管理种族/亚种/能力/关系。
// 史诗/科幻类型激活，轻量模式在校园/都市关闭。

// ---- 种族规范化 ----
export function normalizeRaces(data = {}) {
  const races = Array.isArray(data.races) ? data.races : Object.values(data.races || data || {});
  return races.map((item, index) => ({
    id: item.id || item.name || `race-${index + 1}`,
    name: item.name || item.id || `种族${index + 1}`,
    subraces: Array.isArray(item.subraces) ? item.subraces : [],
    traits: item.traits || {},
    abilities: Array.isArray(item.abilities) ? item.abilities : [],
    relations: item.relations || {},
    territory: item.territory || "",
    population: item.population || "",
    culture: item.culture || "",
    language: item.language || "",
    lifespan: item.lifespan || "",
    description: item.description || ""
  }));
}

// ---- 种族摘要（用于引擎注入） ----
export function raceSummary(races = []) {
  const list = normalizeRaces(races);
  if (!list.length) return "";
  return list.map((r) => {
    const parts = [r.name];
    if (r.subraces.length) parts.push(`亚种: ${r.subraces.join(", ")}`);
    if (r.territory) parts.push(`领地: ${r.territory}`);
    if (r.population) parts.push(`人口: ${r.population}`);
    if (r.culture) parts.push(`文化: ${r.culture.slice(0, 80)}`);
    return parts.join(" | ");
  }).join("\n");
}

// ---- 种族关系矩阵 ----
export function raceRelationMatrix(races = []) {
  const list = normalizeRaces(races);
  const matrix = {};
  for (const race of list) {
    matrix[race.name] = {};
    for (const other of list) {
      if (race.name === other.name) {
        matrix[race.name][other.name] = "self";
      } else {
        matrix[race.name][other.name] = race.relations?.[other.name] ||
          other.relations?.[race.name] || "neutral";
      }
    }
  }
  return matrix;
}

// ---- 种族能力检查 ----
export function checkRacialAbility(character = {}, ability = "", races = []) {
  const race = races.find((r) =>
    r.name === character.race || r.name === character.species ||
    (r.subraces && r.subraces.includes(character.race || character.subspecies))
  );
  if (!race) return { has: false, reason: "角色种族未定义或不在已知种族列表中" };
  const hasAbility = (race.abilities || []).some((a) =>
    a.toLowerCase().includes(ability.toLowerCase())
  );
  return { has: hasAbility, race: race.name, ability };
}

// ---- 种族冲突检测 ----
export function detectRacialTension(races = [], involvedCharacters = []) {
  const tensions = [];
  for (let i = 0; i < involvedCharacters.length; i++) {
    for (let j = i + 1; j < involvedCharacters.length; j++) {
      const a = involvedCharacters[i];
      const b = involvedCharacters[j];
      if (a.race && b.race && a.race !== b.race) {
        const relation = a.race in (races.find((r) => r.name === a.race)?.relations || {}) ?
          (races.find((r) => r.name === a.race)?.relations || {})[b.race] : "neutral";
        if (relation && relation !== "neutral" && relation !== "friendly") {
          tensions.push({
            between: [a.name || a.id, b.name || b.id],
            races: [a.race, b.race],
            relation
          });
        }
      }
    }
  }
  return tensions;
}

// ---- 轻量模式（校园/都市类型）----
export function raceLightMode(worldType = "urban") {
  return {
    mode: "light",
    active: false,
    note: `${worldType} 类型下种族维度以轻量模式运行，仅保留角色背景中的种族标记，不注入种族关系/冲突矩阵。`
  };
}
