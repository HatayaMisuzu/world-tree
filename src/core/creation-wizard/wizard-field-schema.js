// wizard-field-schema.js — Field definitions for each wizard stage
// Part of M1 Creation Wizard v2

export const STAGE_FIELDS = {
  foundation: {
    hard: [
      { key: "worldName", label: "世界名称", hint: "给这个世界取个名字" },
      { key: "genre", label: "风格/类型", hint: "奇幻/科幻/都市/武侠/校园/日常/混合" },
      { key: "tone", label: "整体基调", hint: "严肃/轻松/黑暗/治愈/悬疑/热血" },
      { key: "playerRole", label: "玩家角色定位", hint: "冒险者/侦探/学生/领主/普通人" }
    ],
    soft: [
      { key: "worldHook", label: "世界钩子", hint: "一句话吸引人的独特设定" },
      { key: "startingLocation", label: "起始地点", hint: "故事从哪开始" },
      { key: "historicalContext", label: "时代背景", hint: "中世纪/近未来/现代/古代" }
    ],
    optional: [
      { key: "inspirationSources", label: "灵感来源", hint: "参考了哪些作品" },
      { key: "targetPlayTime", label: "预计游戏时长", hint: "短篇/中篇/长篇" }
    ]
  },
  characters: {
    hard: [
      { key: "protagonistName", label: "主角名字" },
      { key: "protagonistRole", label: "主角身份/职业" }
    ],
    soft: [
      { key: "protagonistPersonality", label: "主角性格" },
      { key: "keyNPC", label: "关键NPC", hint: "最重要的配角" }
    ],
    optional: [
      { key: "characterCount", label: "预计NPC数量" },
      { key: "factionAffiliation", label: "阵营归属" }
    ]
  },
  world: {
    hard: [],
    soft: [
      { key: "geography", label: "地理概况" },
      { key: "politicalStructure", label: "政治结构" },
      { key: "magicTechLevel", label: "魔法/科技水平" }
    ],
    optional: [
      { key: "races", label: "种族/物种" },
      { key: "religions", label: "宗教/信仰" },
      { key: "economy", label: "经济体系" }
    ]
  },
  rules: {
    hard: [],
    soft: [
      { key: "coreRule", label: "核心规则/世界观法则" },
      { key: "limitations", label: "重大限制/禁忌" }
    ],
    optional: [
      { key: "magicSystem", label: "魔法/能力系统" },
      { key: "technologyRules", label: "科技规则" }
    ]
  },
  opening: {
    hard: [
      { key: "openingScene", label: "开场场景", hint: "玩家第一眼看到什么" }
    ],
    soft: [
      { key: "initialConflict", label: "初始冲突/驱动力" },
      { key: "openingHook", label: "开场钩子" }
    ],
    optional: [
      { key: "moodBoard", label: "氛围参考" }
    ]
  },
  events: {
    hard: [],
    soft: [
      { key: "earlyEvents", label: "早期事件方向" }
    ],
    optional: [
      { key: "longTermThreat", label: "长期威胁" },
      { key: "sideQuests", label: "支线方向" }
    ]
  },
  review: {
    hard: [],
    soft: [],
    optional: [
      { key: "notes", label: "补充说明" }
    ]
  }
};

export function getStageFields(stage) { return STAGE_FIELDS[stage] || { hard: [], soft: [], optional: [] }; }
export function getHardFields(stage) { return (STAGE_FIELDS[stage]?.hard || []).map(f => f.key); }
