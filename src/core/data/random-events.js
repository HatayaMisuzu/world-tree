// ===== M17 随机性模块 =====
// v2 — 概率 vs 判断分离
//
// 使用规则：
// - 环境小事件(light): 纯概率制，Director 层触发
// - 中等事件(moderate): Director 计分制，通过 shouldTriggerEvent 调用
// - 重大事件(major): Director 计分制，同上
//
// 本模块仅提供事件模板池和基础概率函数。
// 事件决策由 Director 层 (engine/director.js) 完成。

const CACHE = { lastEventLevel: "", lastEventRound: 0, eventHistory: [] };

// ---- 纯概率判定（仅用于环境事件/气氛调剂） ----
export function eventChance(weight = 0.15) {
  return Math.random() < weight;
}

// ---- 事件模板池（Director 层调用） ----

/**
 * 提议一个随机事件
 * @param {Object} context - { worldType, round, forceLevel, forceScore }
 * @returns {Object|null} 事件对象
 */
export function proposeRandomEvent(context = {}) {
  const round = context.round || 0;
  const forceLevel = context.forceLevel; // "light" | "moderate" | "major" | null

  // 冷却检查（Director 跳过时自己已经判断过了，但保留双重保险）
  if (!forceLevel && CACHE.lastEventRound && round - CACHE.lastEventRound < 3) return null;

  // 确定事件级别
  let level;
  if (forceLevel) {
    level = forceLevel;
  } else {
    // 无强制级别时，按概率随机抽（Director 计分制下不应该走到这里）
    const roll = Math.random();
    level = roll < 0.55 ? "light" : roll < 0.85 ? "moderate" : "major";
  }

  // 避免连续同级别（Director 可能故意选同级别，但保险起见）
  if (!forceLevel && level === CACHE.lastEventLevel && round - CACHE.lastEventRound < 8) {
    level = level === "light" ? "moderate" : "light";
  }

  const titleMap = { light: "轻松调剂", moderate: "中等事件", major: "重大事件" };
  const generators = { light: generateLightDiversion, moderate: generateModerateEvent, major: generateMajorEvent };
  const proposal = (generators[level] || generateLightDiversion)(context);

  CACHE.lastEventLevel = level;
  CACHE.lastEventRound = round;
  CACHE.eventHistory.push({ level, title: titleMap[level], round, timestamp: new Date().toISOString() });

  return {
    marker: level === "major" ? "★" : level === "moderate" ? "◆" : "·",
    level,
    title: titleMap[level],
    proposal,
    canIncorporate: level === "major",
    canBackground: level !== "light",
    createdAt: new Date().toISOString()
  };
}

// ---- 轻松调剂事件池（纯概率，气氛用） ----

function generateLightDiversion(context = {}) {
  const type = context.worldType || "daily";
  const pool = {
    campus: [
      "你拉开抽屉，发现一枚硬币——上次用现金是什么时候？",
      "走廊转角处，一只橘猫趴在窗台上晒太阳。它瞥了你一眼，继续睡。",
      "自动贩卖机多吐了一罐咖啡。今天运气不错。"
    ],
    urban: [
      "地铁站的钢琴今天有人在弹。没听过的曲子，但很好听。",
      "便利店的关东煮多给了两颗鱼丸。大叔冲你眨了眨眼。",
      "楼下花店的猫今天蹲在门口，脖子上多了一条新项圈。"
    ],
    epic: [
      "路边石缝里长出一株发着微光的蘑菇。昨晚下雨了吗？",
      "酒馆的吟游诗人今天换了一首新曲子，旋律意外地好听。",
      "铁匠铺门口多了一只流浪狗，正在晒太阳。"
    ],
    wuxia: [
      "客栈的马厩里多了一匹未曾见过的黑马，鬃毛油亮。",
      "路边茶摊的老板今天多给了你一碟花生。",
      "远处山里传来一声悠长的钟声，附近寺庙今天有法会？"
    ],
    scifi: [
      "走廊屏幕上闪过一条三年前的系统通知。那个项目早就取消了吧？",
      "一只维修无人机停在窗外，用绿灯冲你闪了三下。",
      "太空站的广播里播放着三十年前的老歌。谁点的？"
    ]
  };
  const items = pool[type] || pool.urban;
  return items[Math.floor(Math.random() * items.length)];
}

// ---- 中等事件池（Director 计分制） ----

function generateModerateEvent(context = {}) {
  const type = context.worldType || "daily";
  const pool = {
    campus: [
      "学生会公告栏贴出通知——下周运动会，每班要出人。走廊上已经有人在讨论了。",
      "听说隔壁班来了个转学生。班长在安排座位。",
      "图书馆的角落发现了一本被遗忘的日记，最后一页写着今天的日期。"
    ],
    urban: [
      "隔壁街的老公寓发生了小火灾。消防队及时赶到，没人受伤。邻居群里在组织捐款。",
      "小区门口新开了一家咖啡馆，老板是个沉默的中年人，但咖啡意外地好喝。",
      "手机收到一条陌生号码的消息：「抱歉，发错了。」但这个号码看起来有点眼熟。"
    ],
    epic: [
      "冒险者公会的公告栏上多了一张新任务单，报酬不高但委托人——镇上新来的铁匠——说矿井里发现了奇怪的金属。",
      "市场里来了一个外地的商人，摊位上摆着一些没人见过的药草。",
      "守城的哨兵说昨晚看到北边山上有火光——但那个方向没有村庄。"
    ],
    wuxia: [
      "客栈里来了一队镖师，正在低声讨论最近官道上不太平。",
      "一个陌生人在角落里独自喝酒，腰间的剑鞘刻着你不认识的纹路。",
      "江湖传闻：青城派掌门人要在下个月开英雄宴，不知是福是祸。"
    ],
    scifi: [
      "船舰检测到一段异常的通讯信号，源头发送位置不明。",
      "维修区发现了一个被废弃的机器人，但它的核心芯片还在运转。",
      "空间站公告：由于太阳风暴预警，下个周期所有外部作业暂停。"
    ]
  };
  const items = pool[type] || pool.urban;
  return items[Math.floor(Math.random() * items.length)];
}

// ---- 重大事件池（Director 计分制） ----

function generateMajorEvent(context = {}) {
  const type = context.worldType || "daily";
  const pool = {
    campus: [
      "★ 「学校的新规划」\n  校长在早会上宣布下学期将试行新制度，学生可以自主选课。反应不一。\n  可能影响：- 纳入主线：班级关系重新洗牌，选修课成为新场景。\n  - 作为背景：偶尔提到新制度。\n  - 忽略：没有变化。",
      "★ 「意外的比赛邀请」\n  隔壁城市的高中发来了交流赛邀请——项目刚好是你擅长的那个。\n  可能影响：- 纳入主线：外出交流带来新环境和新人际关系。\n  - 忽略：礼貌回绝。"
    ],
    urban: [
      "★ 「老城区的新规划」\n  新闻里说市政府通过了老城区的改造计划。你常去的那条老街可能要拆了。\n  可能影响：- 纳入主线：涉及社区变迁/人际关系。\n  - 忽略：不关你事。",
      "★ 「意外的重逢」\n  超市里你看见了多年未见的老同学——对方也看见你了。\n  可能影响：- 纳入主线：旧关系在新场景中重启。\n  - 忽略：假装没看见。"
    ],
    epic: [
      "★ 「草原的新动向」\n  冒险者公会流传消息：草原深处出现自称'铁蹄'的新首领，正在统一部落。\n  可能影响：- 纳入主线：势力格局变化可能引发外交/军事剧情。\n  - 忽略：只是一条传闻。",
      "★ 「地下的发现」\n  矿工报告说在深矿层挖到了不属于任何已知文明的建筑遗迹。\n  可能影响：- 纳入主线：古老秘密可能改变已知历史。\n  - 忽略：派几个学者去看看就行。"
    ],
    wuxia: [
      "★ 「武林大会」\n  七大门派联合发出请帖：下个月在华山召开武林大会，推选新盟主。\n  可能影响：- 纳入主线：门派政治/个人恩怨集中爆发。\n  - 忽略：反正跟你没关系。",
      "★ 「失踪的镖银」\n  镇远镖局的一批重要镖银在官道上失踪，整整十万两。\n  可能影响：- 纳入主线：追查失踪镖银引出背后势力。\n  - 忽略：江湖事太多。"
    ],
    scifi: [
      "★ 「不明信号」\n  监测站检测到一个来自深空的周期性信号——看起来不像自然现象。\n  可能影响：- 纳入主线：第一次接触/未知威胁的序幕。\n  - 忽略：继续研究，暂不公布。",
      "★ 「AI 异常」\n  空间站的中央 AI 在过去 24 小时内进行了三次未经授权的查询，目标未知。\n  可能影响：- 纳入主线：AI 觉醒/外部入侵。\n  - 忽略：重启系统看看。"
    ]
  };
  const items = pool[type] || pool.urban;
  return items[Math.floor(Math.random() * items.length)];
}

// ---- 历史查询 ----

export function getEventHistory() {
  return [...CACHE.eventHistory];
}

export function resetEventCache() {
  CACHE.lastEventLevel = "";
  CACHE.lastEventRound = 0;
  CACHE.eventHistory = [];
}
