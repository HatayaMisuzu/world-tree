/**
 * s3-4: minimal demo seed meeting PRD S3 content thresholds + helpers
 * for locationGraph / NPC schedules (s3-2) and director scheme A hooks.
 *
 * Thresholds: ≥2 nations, ≥3 organizations, ≥2 races, ≥5 locations (with
 * travel edges), ≥8 NPCs each with a schedule.
 */
import { createLocationGraph } from "./location-graph.js";
import { createNpcRuntime, recomputeNpcProximity } from "./npc-schedule.js";
import { setRelation, resetRelations, getRecentChanges, findRelation } from "../data/relations.js";
import { normalizeOrganizations } from "../data/organizations.js";
import { normalizeRaces } from "../data/race.js";
import { normalizeCharacterState } from "../data/characters.js";

/** Fixed seed + round used by s3-4 event assertions (scheme A, grounded hooks). */
export const S3_DEMO_EVENT_SEED = "s3-4-demo";
export const S3_DEMO_EVENT_TRIGGER_ROUND = 4;

export const S3_DEMO_THRESHOLDS = Object.freeze({
  nations: 2,
  organizations: 3,
  races: 2,
  locations: 5,
  npcs: 8
});

const NATIONS = [
  {
    id: "cloud-steam-city-state",
    name: "云上蒸汽城邦",
    type: "国家",
    summary: "靠十二座蒸汽锚塔浮在云海之上的主城邦。",
    goals: ["维持锚塔高度", "封锁下层云井消息"]
  },
  {
    id: "rust-harbor-league",
    name: "云下锈港联盟",
    type: "国家",
    summary: "云海下方锈蚀港口结成的贸易与拾荒联盟。",
    goals: ["打通云墙走私航线"]
  }
];

const ORGS = [
  {
    id: "ash-guild",
    name: "灰烬工会",
    type: "公会",
    summary: "维护锅炉、阀门和锚塔的工匠组织。",
    goals: ["控制第七锚塔", "追查旧锚链碎片"]
  },
  {
    id: "wind-court",
    name: "风议会",
    type: "其他",
    summary: "管理航线、风令和浮空安全的城邦议会。",
    goals: ["封锁下层云井"]
  },
  {
    id: "scavenger-company",
    name: "拾荒者商会",
    type: "商会",
    summary: "往来云墙内外的轻型滑翔艇商会。",
    goals: ["垄断雾钟残骸交易"]
  }
];

const RACES = [
  {
    id: "skyfolk",
    name: "浮空人",
    territory: "云上蒸汽城",
    description: "世代生活在锚塔城邦的居民，擅长蒸汽机械。",
    relations: { 云下遗民: "wary" }
  },
  {
    id: "cloud-below-remnants",
    name: "云下遗民",
    territory: "锈港与云井下层",
    description: "云海下方遗民，熟悉旧时代管线与锈港航道。",
    relations: { 浮空人: "wary" }
  }
];

const LOCATION_NODES = [
  { id: "brass-harbor", name: "黄铜港", regionId: "cloud-steam" },
  { id: "fog-bell-tower", name: "雾铃塔", regionId: "cloud-steam" },
  { id: "ash-guild-hall", name: "灰烬会馆", regionId: "cloud-steam" },
  { id: "wind-court-plaza", name: "风议广场", regionId: "cloud-steam" },
  { id: "cloud-well", name: "下层云井", regionId: "cloud-below" }
];

const LOCATION_EDGES = [
  { from: "brass-harbor", to: "fog-bell-tower", durationDays: 1 },
  { from: "brass-harbor", to: "ash-guild-hall", durationDays: 1 },
  { from: "brass-harbor", to: "wind-court-plaza", durationDays: 1 },
  { from: "fog-bell-tower", to: "cloud-well", durationDays: 2 },
  { from: "ash-guild-hall", to: "cloud-well", durationDays: 3 },
  { from: "wind-court-plaza", to: "fog-bell-tower", durationDays: 1 }
];

/** ≥8 NPCs; each has a non-empty schedule keyed by calendar totalDays. */
const NPC_DEFS = [
  {
    id: "mira-valvewright",
    name: "米拉·阀匠",
    role: "灰烬工会见习工程师",
    race: "浮空人",
    nationId: "cloud-steam-city-state",
    orgId: "ash-guild",
    locationId: "ash-guild-hall",
    motive: "查清压力记录被谁改过",
    description: "熟悉第七锚塔的年轻工程师，担心工会高层隐瞒雾铃塔故障范围。",
    relationDistance: 0.2,
    schedule: [
      { atDay: 0, locationId: "ash-guild-hall" },
      { atDay: 3, locationId: "fog-bell-tower" },
      { atDay: 7, locationId: "brass-harbor" }
    ]
  },
  {
    id: "captain-luo",
    name: "罗船长",
    role: "黄铜港巡云船长",
    race: "浮空人",
    nationId: "cloud-steam-city-state",
    orgId: "wind-court",
    locationId: "brass-harbor",
    motive: "确认来人不是风议会密探",
    description: "掌握云墙外航线，愿意帮忙但先要证明来意。",
    relationDistance: 0.3,
    schedule: [
      { atDay: 0, locationId: "brass-harbor" },
      { atDay: 5, locationId: "wind-court-plaza" }
    ]
  },
  {
    id: "ash-foreman",
    name: "灰烬工头",
    role: "锅炉工头",
    race: "浮空人",
    nationId: "cloud-steam-city-state",
    orgId: "ash-guild",
    locationId: "ash-guild-hall",
    motive: "保住工会对第七锚塔的管辖权",
    description: "嗓门大、护短，不喜欢议会插手锅炉房。",
    schedule: [
      { atDay: 0, locationId: "ash-guild-hall" },
      { atDay: 4, locationId: "brass-harbor" }
    ]
  },
  {
    id: "wind-clerk",
    name: "风令书记",
    role: "议会书记",
    race: "浮空人",
    nationId: "cloud-steam-city-state",
    orgId: "wind-court",
    locationId: "wind-court-plaza",
    motive: "压下雾铃塔异常的公开议论",
    description: "记录风令的文官，对下层云井讳莫如深。",
    schedule: [
      { atDay: 0, locationId: "wind-court-plaza" },
      { atDay: 6, locationId: "fog-bell-tower" }
    ]
  },
  {
    id: "scavenger-yen",
    name: "拾荒者燕",
    role: "商会跑单",
    race: "云下遗民",
    nationId: "rust-harbor-league",
    orgId: "scavenger-company",
    locationId: "brass-harbor",
    motive: "高价收旧锚链齿轮",
    description: "带着锈港口音的滑翔艇跑单人。",
    schedule: [
      { atDay: 0, locationId: "brass-harbor" },
      { atDay: 2, locationId: "cloud-well" },
      { atDay: 8, locationId: "brass-harbor" }
    ]
  },
  {
    id: "bell-keeper",
    name: "雾钟守望",
    role: "雾铃塔看守",
    race: "浮空人",
    nationId: "cloud-steam-city-state",
    orgId: "wind-court",
    locationId: "fog-bell-tower",
    motive: "弄清为何连续七次敲响",
    description: "独居钟楼的看守，夜里很少睡觉。",
    schedule: [
      { atDay: 0, locationId: "fog-bell-tower" },
      { atDay: 10, locationId: "ash-guild-hall" }
    ]
  },
  {
    id: "dock-hand-kai",
    name: "码头工凯",
    role: "黄铜港装卸工",
    race: "浮空人",
    nationId: "cloud-steam-city-state",
    orgId: "scavenger-company",
    locationId: "brass-harbor",
    motive: "多挣一笔雾钟残骸搬运费",
    description: "熟悉码头缆绳与飞艇泊位。",
    schedule: [
      { atDay: 0, locationId: "brass-harbor" },
      { atDay: 1, locationId: "ash-guild-hall" },
      { atDay: 3, locationId: "brass-harbor" }
    ]
  },
  {
    id: "rust-envoy",
    name: "锈港使者",
    role: "联盟密使",
    race: "云下遗民",
    nationId: "rust-harbor-league",
    orgId: "rust-harbor-league",
    locationId: "cloud-well",
    motive: "试探城邦是否会开放云墙",
    description: "代表锈港联盟的密使，偶尔现身云井。",
    schedule: [
      { atDay: 0, locationId: "cloud-well" },
      { atDay: 4, locationId: "brass-harbor" },
      { atDay: 9, locationId: "cloud-well" }
    ]
  }
];

const INITIAL_RELATIONS = [
  {
    source: "米拉·阀匠",
    target: "罗船长",
    type: "friend",
    attitude: 1,
    description: "港口委托让两人有过一面之缘",
    origin: "s3-demo-seed"
  },
  {
    source: "米拉·阀匠",
    target: "灰烬工头",
    type: "mentor",
    attitude: 2,
    description: "工头带米拉入行",
    origin: "s3-demo-seed"
  },
  {
    source: "罗船长",
    target: "风令书记",
    type: "rival",
    attitude: -1,
    description: "航线审批上的旧怨",
    origin: "s3-demo-seed"
  }
];

/**
 * Build the canonical s3-4 demo seed (in-memory). Also mirrors defaults/examples
 * demo-world-cloud-steam-city shared JSON.
 */
export function buildS3DemoSeed() {
  const nations = NATIONS.map((n) => ({ ...n }));
  const organizations = normalizeOrganizations({
    organizations: [...nations, ...ORGS.map((o) => ({ ...o }))]
  }).map((org, i) => {
    const raw = [...nations, ...ORGS][i];
    return { ...org, type: raw.type, summary: raw.summary, goals: raw.goals ? [...raw.goals] : [] };
  });
  const races = normalizeRaces({ races: RACES.map((r) => ({ ...r })) });
  const locations = LOCATION_NODES.map((n) => ({
    id: n.id,
    name: n.name,
    regionId: n.regionId,
    summary: n.name
  }));
  const locationGraph = createLocationGraph({
    nodes: LOCATION_NODES.map((n) => ({ ...n })),
    edges: LOCATION_EDGES.map((e) => ({ ...e }))
  });
  const characters = normalizeCharacterState(
    NPC_DEFS.map((d) => ({
      id: d.id,
      name: d.name,
      role: d.role,
      race: d.race,
      location: d.locationId,
      nationId: d.nationId,
      orgId: d.orgId,
      motive: d.motive,
      description: d.description,
      status: "正常"
    }))
  ).map((c, i) => ({
    ...c,
    race: NPC_DEFS[i].race,
    nationId: NPC_DEFS[i].nationId,
    orgId: NPC_DEFS[i].orgId,
    motive: NPC_DEFS[i].motive,
    description: NPC_DEFS[i].description
  }));
  const npcStates = NPC_DEFS.map((d) =>
    createNpcRuntime({
      id: d.id,
      name: d.name,
      locationId: d.locationId,
      relationDistance: d.relationDistance,
      schedule: d.schedule.map((s) => ({ ...s }))
    })
  );
  const proximityScope = recomputeNpcProximity({
    npcs: npcStates,
    totalDays: 0,
    currentLocationId: "brass-harbor",
    protagonistId: "player"
  }).scope;

  const worldState = {
    currentScene: "brass-harbor-opening",
    publicTension: "雾铃塔连续异常鸣响，港口传闻增多。",
    openThreads: ["第七锚塔失压", "匿名委托来源", "旧锚链齿轮用途"],
    nations: nations.map((n) => ({ id: n.id, name: n.name, type: n.type }))
  };

  const moduleData = {
    characters,
    organizations,
    races,
    locations,
    worldState,
    scenes: [
      {
        id: "brass-harbor-opening",
        title: "黄铜港开场",
        summary: "雾钟声从第七锚塔传来，飞艇的缆绳在云风里震动，玩家收到匿名委托。"
      }
    ],
    relations: { seed: INITIAL_RELATIONS.map((r) => ({ ...r })) }
  };

  return {
    nations,
    organizations,
    races,
    locations,
    locationGraph,
    characters,
    npcStates,
    proximityScope,
    currentLocationId: "brass-harbor",
    worldState,
    moduleData,
    initialRelations: INITIAL_RELATIONS.map((r) => ({ ...r })),
    counts: countDemoSeed({
      nations,
      organizations,
      races,
      locations,
      locationGraph,
      npcStates
    })
  };
}

export function countDemoSeed(seed = {}) {
  const orgs = seed.organizations || [];
  const nationsFromOrgs = orgs.filter((o) => o.type === "国家" || o.type === "nation");
  const nations = (seed.nations && seed.nations.length)
    ? seed.nations
    : nationsFromOrgs;
  const npcs = seed.npcStates || seed.characters || [];
  const withSchedule = (seed.npcStates || []).filter(
    (n) => Array.isArray(n.schedule) && n.schedule.length > 0
  );
  const edges = seed.locationGraph?.edges || seed.edges || [];
  return {
    nations: nations.length,
    organizations: orgs.length,
    races: (seed.races || []).length,
    locations: (seed.locations || seed.locationGraph?.nodes || []).length,
    locationEdges: edges.length,
    npcs: npcs.length,
    npcsWithSchedule: withSchedule.length || npcs.length
  };
}

/** Throw / return list of unmet PRD thresholds. */
export function unmetDemoThresholds(seed = buildS3DemoSeed()) {
  const counts = seed.counts || countDemoSeed(seed);
  const gaps = [];
  if (counts.nations < S3_DEMO_THRESHOLDS.nations) {
    gaps.push(`nations ${counts.nations} < ${S3_DEMO_THRESHOLDS.nations}`);
  }
  if (counts.organizations < S3_DEMO_THRESHOLDS.organizations) {
    gaps.push(`organizations ${counts.organizations} < ${S3_DEMO_THRESHOLDS.organizations}`);
  }
  if (counts.races < S3_DEMO_THRESHOLDS.races) {
    gaps.push(`races ${counts.races} < ${S3_DEMO_THRESHOLDS.races}`);
  }
  if (counts.locations < S3_DEMO_THRESHOLDS.locations) {
    gaps.push(`locations ${counts.locations} < ${S3_DEMO_THRESHOLDS.locations}`);
  }
  if ((counts.locationEdges || 0) < 1) {
    gaps.push("locations missing travel edges");
  }
  if (counts.npcs < S3_DEMO_THRESHOLDS.npcs) {
    gaps.push(`npcs ${counts.npcs} < ${S3_DEMO_THRESHOLDS.npcs}`);
  }
  if ((counts.npcsWithSchedule || 0) < S3_DEMO_THRESHOLDS.npcs) {
    gaps.push(`npcsWithSchedule ${counts.npcsWithSchedule} < ${S3_DEMO_THRESHOLDS.npcs}`);
  }
  return gaps;
}

/**
 * Seed relations.js store from demo initial relations (product path: data/relations.js).
 * Returns changeLog entries created (create does not log; we force an assertable update).
 */
export function applyDemoRelationSeed(seed = buildS3DemoSeed(), { bumpPair = true } = {}) {
  resetRelations();
  for (const r of seed.initialRelations || []) {
    setRelation({ ...r, type: r.type === "acquainted" ? "friend" : r.type });
  }
  if (bumpPair) {
    // Assertable affinity/type change on the product ledger path
    setRelation({
      source: "米拉·阀匠",
      target: "罗船长",
      type: "ally",
      attitude: 3,
      description: "共同调查第七锚塔后成为盟友",
      origin: "s3-demo-seed-turn"
    });
  }
  return {
    relation: findRelation("米拉·阀匠", "罗船长"),
    recentChanges: getRecentChanges(10)
  };
}

/** Engine-state slice for /api/llm/chat (s3-2/3 wiring). */
export function demoEngineStateSlice(seed = buildS3DemoSeed(), extra = {}) {
  return {
    dataMode: "worldbook",
    mode: "world-rpg",
    directorMode: "hybrid",
    preset: "epic",
    emotionState: { engagement: 6, tension: 5, fatigue: 4, curiosity: 7 },
    locationGraph: seed.locationGraph,
    npcStates: seed.npcStates,
    proximityScope: seed.proximityScope,
    currentLocationId: seed.currentLocationId,
    protagonistId: "player",
    ...extra
  };
}
