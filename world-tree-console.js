"use strict";

/* ═══════════════════════════════════════════════════════════════
 * World Tree 桌面控制台 — 直连 LLM 版
 * 模组选择 → 模组对话，内容炼金台集成
 * ═══════════════════════════════════════════════════════════════ */

const CFG = {
  version:"2.3.1",
  tabs:[
    {id:"home",label:"🏠 首页",prio:0},
    {id:"chat",label:"💬 对话",prio:5},
    {id:"worlds",label:"🌍 世界",prio:8},
    {id:"archives",label:"📦 存档",prio:10},
    {id:"telemetry",label:"📡 脉象",prio:44},
    {id:"entities",label:"🏛 构成",prio:46},
    {id:"narrative",label:"🧠 深度",prio:48},
    {id:"commands",label:"⌨ 指令",prio:60},
    {id:"health",label:"🔍 体检",prio:75},
  ]
};

/* ── 工具 ── */
const U = {
  qs(s,r){return (r||document).querySelector(s)},
  qsa(s,r){return Array.from((r||document).querySelectorAll(s))},
  esc(v){return String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")},
  date(v){if(!v)return"未知";const d=v instanceof Date?v:new Date(v);if(isNaN(d.getTime()))return String(v);return d.toLocaleString("zh-CN",{hour12:false})},
  rel(v){if(!v)return"未知";const d=v instanceof Date?v:new Date(v);if(isNaN(d.getTime()))return String(v);const diff=Date.now()-d.getTime(),a=Math.abs(diff);if(a<6e4)return"刚刚";if(a<36e5)return Math.round(a/6e4)+" 分钟前";if(a<864e5)return Math.round(a/36e5)+" 小时前";return Math.round(a/864e5)+" 天前"},
  json(v){try{return JSON.stringify(v??null,null,2)}catch{return String(v)}},
  compact(v,m=180){const t=typeof v==="string"?v:U.json(v);const c=t.replace(/\s+/g," ").trim();return c.length>m?c.slice(0,m)+"...":c},
  slug(v,f="item"){return String(v||"").trim().replace(/[^\p{L}\p{N}_.-]+/gu,"_").replace(/^_+|_+$/g,"").slice(0,48)||f},
};

/* ── API 调用 ── */
const API = {
  base:"",
  async call(method,path,body){
    const url = (API.base||"")+path;
    const opts={method,headers:{"Content-Type":"application/json"}};
    if(body)opts.body=JSON.stringify(body);
    const r=await fetch(url,opts);
    if(!r.ok){
      const t=await r.text().catch(()=>"");
      let payload=null;
      try{payload=JSON.parse(t)}catch{}
      if(payload?.detail)console.error("[API detail]",payload.code||r.status,payload.detail);
      throw new Error(payload?.userMsg||payload?.errorMsg||payload?.error||`HTTP ${r.status}: ${t||r.statusText}`);
    }
    return r.json();
  },
  get(path){return API.call("GET",path)},
  post(path,body){return API.call("POST",path,body)},

  async loadModules(){return API.get("/api/modules")},
  async createModule(data){return API.post("/api/modules/create",data)},
  async deleteModule(id){return API.post("/api/modules/delete",{id})},
  async loadExamples(){return API.get("/api/examples")},
  async installExample(id){return API.post("/api/examples/install",{id})},
  async loadConfig(){return API.get("/api/config")},
  async saveConfig(data){return API.post("/api/config",data)},
  async getSecrets(){return API.get("/api/secrets")},
  async saveLlmKey(data){return API.post("/api/secrets/llm",data)},
  async testLlm(data){return API.post("/api/llm/test",data)},
  async chatSend(data){return API.post("/api/llm/chat",data)},
  async alchemyImport(data){return API.post("/api/alchemy/import",data)},
  async getStatus(){return API.get("/api/status")},
  async loadCharacters(){return API.get("/api/characters")},
  async loadCharacter(id){return API.post("/api/characters/load",{id})},
  async dashboardTelemetry(moduleKey){return API.get(`/api/dashboard/telemetry?moduleKey=${encodeURIComponent(moduleKey)}`)},
  async dashboardEntities(moduleKey){return API.get(`/api/dashboard/entities?moduleKey=${encodeURIComponent(moduleKey)}`)},
  async dashboardNarrative(moduleKey){return API.get(`/api/dashboard/narrative?moduleKey=${encodeURIComponent(moduleKey)}`)},
};

/* ── 应用状态 ── */
const AS = {
  activeTab:"home",
  modules:[],
  health:null,
  examples:[],
  onboardingShown:false,
  selectedModule:null,
  config:{},
  hasApiKey:false,
  llmConnected:false,
  llmTestResult:"",
  messages:[],
  historyKey:"",
  busy:false,
  quickStartContent:"",  // 快速开始的上下文内容
  isQuickStart:false,     // 是否快速模式（不保存记录）
  engineState:null,       // 从服务端恢复的引擎状态
  lastScene:"",            // 上次对话的场景
  showStatusPanel:true,    // 状态面板是否展开
  lastStatusSections:{},   // 最新一轮的状态建议+情绪反馈
  dashboardData:{},        // dashboard 数据缓存 {telemetry,entities,narrative}
  _currentCharCard:null,    // 当前选择的角色卡数据（character_card 模式）
};

/* 对话记录持久化 */
const CH = {
  keyPrefix:"wt3-chat-",
  currentKey:"",
  saveKey(m){return CH.keyPrefix+(m?.id||"global")},
  load(m){const k=CH.saveKey(m);if(k===CH.currentKey||AS.isQuickStart)return;CH.currentKey=k;try{AS.messages=JSON.parse(localStorage.getItem(k)||"[]")}catch{AS.messages=[]}},
  persist(){if(!CH.currentKey||AS.isQuickStart)return;localStorage.setItem(CH.currentKey,JSON.stringify(AS.messages.slice(-200)))},
  add(role,content,ext){const msg={id:"m_"+Date.now()+"_"+Math.random().toString(16).slice(2),role,content,ts:new Date().toISOString(),...ext};AS.messages.push(msg);CH.persist();return msg},
  clear(){AS.messages=[];CH.persist()},
  /** 从服务端加载历史 */
  async loadFromServer(m){
    if(!m||m.id==="__quick__")return;
    try{
      const res=await API.get(`/api/modules/${encodeURIComponent(m.id)}/history?limit=50`);
      if(res.status==="ok"&&res.messages?.length){
        let idx=0;
        AS.messages=res.messages.map(r=>({id:"h_"+Date.now()+"_"+idx++,role:r.role,content:r.content,ts:r.ts||"",round:r.round||0,sections:r.sections||null}));
        CH.currentKey=CH.saveKey(m);
        AS.selectedModule.turnCount=res.turnCount||0;
        // 从历史中恢复最新的状态/情绪数据
        for(let i=AS.messages.length-1;i>=0;i--){
          const s=AS.messages[i].sections;
          if(s){AS.lastStatusSections=s;break;}
        }
      }
      // 恢复引擎状态（emotionState 等）
      if(res.engineState) AS.engineState = res.engineState;
      if(res.lastScene) AS.lastScene = res.lastScene;
    }catch(e){console.warn("加载历史失败",e)}
  },
};

/* ═══════════════════════════════════════════════════════════════
 * 视图渲染
 * ═══════════════════════════════════════════════════════════════ */

/* ── 组件函数 ── */
const C = {
  badge(t,k="pending"){return`<span class="badge ${k}">${U.esc(t)}</span>`},
  empty(t,d=""){return`<div class="empty"><strong>${U.esc(t)}</strong>${d?`<div>${U.esc(d)}</div>`:""}</div>`},
  notice(t,k=""){return`<div class="notice ${k}">${U.esc(t)}</div>`},
  stat(l,v,d=""){return`<div class="stat"><strong>${U.esc(v)}</strong><span>${U.esc(l)}</span>${d?`<span>${U.esc(d)}</span>`:""}</div>`},
  dataModeLabel(m){
    const map={worldbook:"📖 世界书",character_card:"🃏 角色卡",preset:"🎲 预设",standalone:"🔍 独立"};
    return map[m?.dataMode]||m?.dataMode||"📖 世界书";
  },
  typeIcon(m){
    if(m?.type==="world")return"🌍";
    if(m?.type==="profile")return"📋";
    if(m?.type==="case")return"🔍";
    return"📦";
  },
  moduleCard(m,selected){
    const isSel=selected&&(selected.id===m.id);
    const isProfile=m.type==="profile";
    return`<div class="module-card ${isSel?"selected":""}" data-module-id="${U.esc(m.id)}" data-mode="${m.dataMode||""}" data-kind="${m.type||""}">
      <div style="display:flex;justify-content:space-between;align-items:start">
        <div class="name">${C.typeIcon(m)} ${U.esc(m.displayName||m.name)}</div>
        <div class="tags">
          ${C.badge(C.dataModeLabel(m),m.dataMode==="worldbook"?"info":m.dataMode==="character_card"?"purple":"cyan")}
          ${m.turnCount>0?C.badge(m.turnCount+"轮","ok"):C.badge("新","warn")}
          ${isProfile?'<span class="badge">模板</span>':''}
          ${m.isPlaceholder?'<span class="badge warn">🙈 未完成</span>':''}
        </div>
      </div>
      ${m.description?`<div class="desc">${U.esc(m.description)}</div>`:""}
      <div class="meta">
        <span>${U.esc(m.subType||"classic")}</span>
        ${m.lastPlayed?`<span>上次: ${U.rel(m.lastPlayed)}</span>`:""}
        ${m.createdAt?`<span>创建: ${U.date(m.createdAt)}</span>`:""}
      </div>
      <div class="actions">
        ${m.type==="world"||m.dataMode==="character_card"
          ? isSel
            ? `<button class="small select-btn" style="background:var(--panel-2);border-color:var(--ok);color:var(--ok)" disabled>✓ 已选择</button><button class="danger small" data-action="delete-module">🗑</button><button class="small" data-action="export-module" title="导出模组数据">📥</button>`
            : `<button class="primary small select-btn" data-action="select-module">选择</button><button class="danger small" data-action="delete-module">🗑</button>`
          : `<button class="primary small select-btn" data-action="create-from-template">从模板创建</button>`}
      </div>
    </div>`;
  },
  configForm(){
    const c=AS.config;
    return`<div class="panel" style="max-width:600px">
      <div class="panel-head"><h2>🔌 LLM 配置</h2><div class="actions"><button class="small" data-action="show-onboarding">启动引导</button><button class="small primary" id="saveLlmBtn">💾 保存</button><button class="small" id="testLlmBtn">🔗 测试</button></div></div>
      <div class="grid" style="gap:8px">
        <div class="config-row"><label>API地址</label><input id="cfgUrl" value="${U.esc(c.llmBaseUrl||"")}" placeholder="https://api.deepseek.com/v1"></div>
        <div class="config-row"><label>模型</label><input id="cfgModel" value="${U.esc(c.llmModel||"")}" placeholder="deepseek-v4-flash"></div>
        <div class="config-row"><label>API Key</label><div style="display:flex;gap:6px;align-items:center;width:100%"><input id="cfgKey" type="password" value="" placeholder="${AS.hasApiKey?"已配置，输入新 key 则覆盖":"sk-..."}" style="flex:1">${AS.hasApiKey?C.badge("已配置","ok"):""}</div></div>
      </div>
      <div style="margin-top:8px;font-size:12px">${AS.llmTestResult}</div>
    </div>`;
  },
  onboardingPanel(){
    return`<div class="panel onboarding-panel">
      <div class="panel-head"><h2>首次启动</h2><div class="actions"><button class="small" data-action="onboarding-dismiss">不再显示</button></div></div>
      <div class="onboarding-grid">
        <button class="onboarding-step" data-action="onboarding-import"><strong>导入素材</strong><span>把你的世界设定、角色描述或文档放进炼金台。</span></button>
        <button class="onboarding-step" data-action="onboarding-create"><strong>新建世界</strong><span>先创建空世界书，再逐步补充内容。</span></button>
        <button class="onboarding-step" data-tab="health"><strong>检查环境</strong><span>确认服务、模型配置和数据目录状态。</span></button>
      </div>
    </div>`;
  },
  examplesPanel(){
    if(!AS.examples?.length)return"";
    return`<div class="panel">
      <div class="panel-head"><h2>素材示例</h2><span class="sub">从 defaults/examples/manifest.json 导入到本地数据目录</span></div>
      <div class="module-grid">${AS.examples.map(e=>`<div class="module-card" data-example-id="${U.esc(e.id)}" data-mode="${U.esc(e.dataMode||"worldbook")}" data-kind="${U.esc(e.type||"example")}">
        <div class="name">${U.esc(e.name||e.id)}</div>
        ${e.description?`<div class="desc">${U.esc(e.description)}</div>`:""}
        <div class="tags">${(e.tags||[]).map(t=>C.badge(t,"info")).join("")}${C.badge(e.type==="character"?"角色卡":"世界书",e.type==="character"?"purple":"cyan")}</div>
        <div class="actions"><button class="primary small" data-action="install-example">导入</button></div>
      </div>`).join("")}</div>
    </div>`;
  },
  chatContent(t){
    const e=U.esc(t||"");
    return e.replace(/【([^】]+)】/g,'<span class="wt-tag">【$1】</span>');
  },
  chatMsg(m){
    const rl=m.role==="user"?"玩家":m.role==="assistant"?"世界树":"系统";
    const cb=m.role==="assistant"?`<button class="small" data-chat-clip="${U.esc(m.id)}">📋</button>`:"";
    return`<div class="chat-message ${U.esc(m.role)}"><div class="chat-meta-line"><strong>${U.esc(rl)}</strong><span>${U.date(m.ts)}</span><span class="actions">${cb}</span></div><div class="chat-content">${C.chatContent(m.content)}</div></div>`;
  },
  /* ── 状态面板组件 ── */
  spCard(title,icon,data){
    if(!data||typeof data!=="object")return"";
    const rows=Object.entries(data).filter(([k])=>!k.startsWith("_")).map(([k,v])=>{const val=Array.isArray(v)?v.join(", "):String(v);return`<div class="sp-row"><span class="sp-label">${U.esc(k)}</span><span class="sp-val">${U.esc(val)}</span></div>`}).join("");
    return rows?`<div class="sp-card"><h4>${icon} ${U.esc(title)}</h4>${rows}</div>`:"";
  },
  spEmotion(data){
    if(!data)return"";
    // data.player 可能是字符串 "engagement=7, tension=4..." 或对象 {engagement:7, tension:4, ...}
    let items=[];
    if(typeof data.player==="string"){
      items=data.player.split(",").map(s=>s.trim());
    }else if(typeof data.player==="object"&&data.player){
      items=Object.entries(data.player).filter(([k])=>!k.startsWith("_")).map(([k,v])=>`${k}=${v}`);
    }else{
      // 尝试从 data 顶层读取情绪字段
      items=Object.entries(data).filter(([k])=>["engagement","tension","fatigue","curiosity"].includes(k)).map(([k,v])=>`${k}=${v}`);
    }
    if(!items.length)return"";
    const labels={engagement:["🎭 投入","#5b9cf5"],tension:["⚡ 紧张","#e8b339"],fatigue:["😴 疲劳","#b388ff"],curiosity:["🔍 好奇","#5cd4ff"]};
    return`<div class="sp-card"><h4>🎯 情绪状态</h4>${items.map(p=>{const[k,v]=p.split("=");const info=labels[k.trim()]||[k,"#7a889b"];const pct=Math.min(100,Math.round((parseInt(v)||0)*10));return`<div class="emotion-bar"><span style="font-size:11px;min-width:36px">${info[0]}</span><div class="eb-track"><div class="eb-fill" style="width:${pct}%;background:${info[1]}"></div></div><span class="eb-val">${U.esc(v)}</span></div>`}).join("")}</div>`;
  },
  statusPanel(sections){
    if(!sections||Object.keys(sections).length===0)return`<div class="sp-empty">暂无状态数据<br><span style="font-size:11px">发送消息后状态会显示在这里</span></div>`;
    const parts=[];
    if(sections["情绪反馈"])parts.push(C.spEmotion(sections["情绪反馈"]));
    const st=sections["状态建议"];
    if(st){if(st["场景状态"])parts.push(C.spCard("场景状态","🌍",st["场景状态"]));if(st["玩家状态"])parts.push(C.spCard("玩家状态","🧙",st["玩家状态"]));if(st["叙事状态"])parts.push(C.spCard("叙事状态","📖",st["叙事状态"]));}
    return parts.join("")||`<div class="sp-empty">暂无状态数据</div>`;
  },
  table(rows,cols){
    if(!rows?.length)return C.empty("无数据");
    return`<table><thead><tr>${cols.map(c=>`<th>${U.esc(c.l||c.k)}</th>`).join("")}</tr></thead><tbody>${rows.map(r=>`<tr>${cols.map(c=>{const v=c.render?c.render(r):r[c.k];return`<td>${U.esc(v??"-")}</td>`}).join("")}</tr>`).join("")}</tbody></table>`;
  },
  dbJson(o){
    if(!o||(typeof o==="object"&&Object.keys(o).length===0))return C.empty("无数据");
    return`<pre class="dash-json">${U.esc(U.json(o))}</pre>`;
  }
};

/* ═══════════════════════════════════════════════════════════════
 * 视图注册
 * ═══════════════════════════════════════════════════════════════ */

const Views = {registry:new Map(),register(v){Views.registry.set(v.id,v)},get(id){return Views.registry.get(id)}};

/* ── 首页：模组选择 + 炼金台 ── */
Views.register({
  id:"home",
  render(){
    const mods=AS.modules;
    const worlds=mods.filter(m=>m.type==="world"||m.dataMode==="character_card"||m.type==="case");
    const templates=mods.filter(m=>m.type==="profile"&&!m.isPlaceholder);
    return`<div class="grid">
      ${C.configForm()}
      ${AS.config.firstRun!==false?C.onboardingPanel():""}
      ${C.examplesPanel()}

      <!-- 快速开始：即用即走 -->
      <div class="panel">
        <div class="panel-head"><h2>🚀 快速开始</h2><span class="sub">导入文件/粘贴文本，直接对话，不创建模组、不保存记录</span></div>
        <div class="alchemy-drop" id="quickStartDrop" title="拖拽文件/文件夹或粘贴文本">
          <div class="icon">📂</div>
          <div class="hint">拖拽文件/文件夹，或粘贴文本，一键开聊</div>
          <div class="supported">支持 .md .txt .json，自动遍历子目录</div>
        </div>
        <textarea id="quickStartText" placeholder="或在此粘贴叙事设定、小说开头、角色描述等内容..." style="margin-top:10px;min-height:100px;width:100%"></textarea>
        <div class="actions" style="margin-top:8px">
          <button class="primary" data-action="quick-start-chat">⚡ 开始对话（即用即走）</button>
        </div>
        <div style="margin-top:8px;font-size:12px;color:var(--warn)">💡 提示：对话不会保存，关闭页面即丢失。如需持久化，请使用炼金台导入后创建模组。</div>
      </div>

      <!-- 已有模组（持久化世界 + 角色卡 + 案例） -->
      <div class="panel">
        <div class="panel-head">
          <h2>📦 已有模组</h2>
          <div class="actions">
            <button class="small primary" data-action="refresh-modules">🔄 刷新</button>
          </div>
        </div>
        ${worlds.length
          ?`<div class="module-grid">${worlds.map(m=>C.moduleCard(m,AS.selectedModule)).join("")}</div>`
          :C.empty("暂无模组","通过炼金台下方的按钮新建世界书、角色卡或预设")}
      </div>

      <!-- 炼金台 + 创建 -->
      <div class="panel">
        <div class="panel-head"><h2>⚗️ 内容炼金台</h2><span class="sub">导入文档 → 自动拆解为世界书条目 → 创建持久化模组</span></div>
        <div class="alchemy-drop" id="alchemyDrop" title="拖拽文件或点击选择">
          <div class="icon">📄</div>
          <div class="hint">拖拽文件到此处，或点击选择</div>
          <div class="supported">支持 .md .txt .json</div>
        </div>
        <textarea id="alchemyText" placeholder="粘贴外部文档内容..." style="margin-top:10px;min-height:80px;width:100%"></textarea>
        <div class="actions" style="margin-top:8px">
          <button class="primary small" data-action="alchemy-import">🔮 分析并生成条目</button>
          <button class="small" data-action="create-worldbook">📖 创建世界书</button>
          <button class="small" data-action="create-character-card">🃏 创建角色卡</button>
          <button class="small" data-action="create-preset">🎲 创建预设</button>
        </div>
        <div id="alchemyResult" style="margin-top:8px;font-size:12px"></div>
      </div>
    </div>`;
  }
});

/* ── 对话 ── */
Views.register({
  id:"chat",
  render(){
    const m=AS.selectedModule;
    if(!m)return`<div class="grid"><div class="panel" style="text-align:center;padding:60px 20px"><h2>💬 未选择模组</h2><p style="color:var(--muted);margin:12px 0">请先在首页选择一个模组</p><button class="primary" data-action="go-home">🏠 返回首页</button></div></div>`;
    const spCollapsed=AS.showStatusPanel?"":"collapsed";
    const spToggleIcon=AS.showStatusPanel?"−":"+";
    return`<div class="chat-layout">
      <section class="panel chat-space">
        <div class="panel-head">
          <div><h2>💬 ${AS.isQuickStart?"⚡ 快速对话":`${C.typeIcon(m)} ${U.esc(m.displayName||m.name)}`}</h2><div class="sub">${AS.isQuickStart?'<span style="color:var(--warn)">⚡ 快速模式 · 不保存记录</span>':`${C.dataModeLabel(m)} · ${U.esc(m.subType||"classic")}`}</div></div>
          <div class="actions">
            <button class="small primary" data-action="chat-send" ${AS.busy?"disabled":""}>发送</button>
            <button class="small danger" data-action="chat-clear">🗑 清空</button>
          </div>
        </div>
        <div id="chatMessages" class="chat-messages">${AS.messages.length?AS.messages.map(C.chatMsg).join(""):C.empty("开始对话","发送消息开始叙事")}</div>
        <div class="chat-input-row">
          <textarea id="chatInput" placeholder="输入你的行动或对话..." style="min-height:100px"></textarea>
        </div>
      </section>
      <aside class="chat-side">
        <!-- 状态面板（可折叠，内嵌在侧栏） -->
        <div class="panel tight">
          <div class="sp-toggle" data-action="toggle-status-panel">
            <h3>📊 状态</h3>
            <span class="sp-toggle-btn">[${spToggleIcon}]</span>
          </div>
          <div class="sp-body ${spCollapsed}">${C.statusPanel(AS.lastStatusSections)}</div>
        </div>
        <!-- 模组信息 -->
        <div class="panel tight">
          <h3>📊 模组信息</h3>
          <div style="font-size:12px;display:grid;gap:4px">
            <div>名称: ${U.esc(m.displayName||m.name)}</div>
            <div>类型: ${C.dataModeLabel(m)}</div>
            <div>子类型: ${U.esc(m.subType||"-")}</div>
            <div>轮次: ${m.turnCount||0}</div>
            ${AS.lastScene?`<div>场景: ${U.esc(AS.lastScene)}</div>`:""}
            <div>${C.badge(AS.llmConnected?"已连接":"未连接",AS.llmConnected?"ok":"pending")}</div>
          </div>
        </div>
        ${m.lastPlayed?`<div class="panel tight"><h3>⏱ 上次</h3><div style="font-size:12px">${U.rel(m.lastPlayed)}</div></div>`:""}
        <div class="panel tight">
          <h3>🔧 操作</h3>
          <div class="actions" style="flex-direction:column;align-items:stretch">
            <button class="small" data-action="go-home">🏠 切换模组</button>
          </div>
        </div>
      </aside>
    </div>`;
  }
});

/* ── 世界列表（保留兼容） ── */
Views.register({
  id:"worlds",
  render(){
    const mods=AS.modules.filter(m=>m.type==="world");
    if(!mods.length)return C.notice("尚无世界","warn");
    return`<div class="grid"><div class="panel"><h2>🌍 世界列表 (${mods.length})</h2>${C.table(mods,[{k:"displayName",l:"名称"},{k:"dataMode",l:"类型",render:r=>C.badge(r.dataMode||"-","info")},{k:"turnCount",l:"轮次"},{k:"subType",l:"子类型"},{k:"lastPlayed",l:"上次",render:r=>r.lastPlayed?U.rel(r.lastPlayed):"-"}])}</div></div>`;
  }
});

/* ── 存档（保留兼容） ── */
Views.register({
  id:"archives",
  render(){return C.empty("存档管理","存档数据在运行时自动保存，当前由引擎管理");}
});

/* ── 📡 世界脉象 ── */
Views.register({
  id:"telemetry",
  render(){
    const d=AS.dashboardData.telemetry;
    if(!d)return`<div class="panel" style="text-align:center;padding:40px"><h2>📡 世界脉象</h2><p style="color:var(--muted)">请先选择一个模组</p></div>`;
    const dims=d.telemetry?.dimensions||{};
    const dimKeys=Object.keys(dims);
    const labels={stability:"稳定度",chaos:"混乱度",mystery:"神秘度",war_risk:"战争风险",character_stress:"角色压力",faction_conflict:"阵营冲突",rule_completeness:"规则完整度",narrative_momentum:"叙事动能",memory_load:"记忆负载"};
    return`<div class="grid">
      <div class="panel"><h2>📡 世界脉象</h2><div class="sub">轮次: ${d.turnCount||0} · 场景: ${U.esc(d.lastScene||"未知")} · 分支: ${U.esc(d.activeBranch||"main")}</div>
        ${dimKeys.length?`<div class="dash-grid">${dimKeys.map(k=>{const v=dims[k];const pct=Math.min(100,Math.max(0,v.value||0));const st=v.status||"normal";return`<div class="dash-card ${st}"><div class="dash-card-head"><strong>${U.esc(labels[k]||v.name||k)}</strong><span>${pct}%</span></div><div class="dash-bar"><div class="dash-fill" style="width:${pct}%;background:${st==="critical"?"var(--bad)":st==="warning"?"var(--warn)":"var(--ok)"}"></div></div><div class="dash-hint">${U.esc(v.description||"")}</div></div>`}).join("")}</div>`:C.empty("暂无脉象数据","运行几轮对话后脉象会自动生成")}
      </div>
      <div class="cols-2">
        <div class="panel"><h3>📊 世界状态</h3>${C.dbJson(d.worldState)}</div>
        <div class="panel"><h3>🎯 追踪</h3>${d.tracking?.length?C.table(d.tracking,[{k:"name",l:"项目"},{k:"count",l:"计数"}],true):C.empty("无追踪数据")}</div>
      </div>
    </div>`;
  }
});

/* ── 🏛 世界构成 ── */
Views.register({
  id:"entities",
  render(){
    const d=AS.dashboardData.entities;
    if(!d)return`<div class="panel" style="text-align:center;padding:40px"><h2>🏛 世界构成</h2><p style="color:var(--muted)">请先选择一个模组</p></div>`;
    const chars=d.characters||[],scenes=d.scenes||[],orgs=d.organizations||[],locs=d.locations||[];
    return`<div class="grid">
      <div class="panel"><h2>🏛 世界构成</h2><div class="sub">${d.turnCount||0} 轮 · ${chars.length} 角色 · ${scenes.length} 场景 · ${orgs.length} 组织 · ${d.worldbookCount||0} 世界书条目</div></div>
      <div class="cols-2">
        <div class="panel"><h3>👤 角色 (${chars.length})</h3>${chars.length?`<div class="dash-list">${chars.map(c=>`<details><summary>${U.esc(c.name||"?")} ${c.role?C.badge(c.role,"info"):""} ${c.status?C.badge(c.status,"warn"):""}</summary><div style="font-size:12px;padding:8px">${c.traits?.length?`<div>性格: ${U.esc(c.traits.join(", "))}</div>`:""}${c.background?`<div>${U.esc(c.background)}</div>`:""}${c.location?`<div>位置: ${U.esc(c.location)}</div>`:""}</div></details>`).join("")}</div>`:C.empty("无角色")}</div>
        <div class="panel"><h3>🎭 场景 (${scenes.length})</h3>${scenes.length?`<div class="dash-list">${scenes.map(s=>`<details><summary>${U.esc(s.title||"?")} ${s.time?C.badge(s.time,"cyan"):""}</summary><div style="font-size:12px;padding:8px">${s.location?`<div>位置: ${U.esc(s.location)}</div>`:""}${s.description?`<div>${U.esc(s.description)}</div>`:""}${s.characters?.length?`<div>角色: ${U.esc(s.characters.join(", "))}</div>`:""}</div></details>`).join("")}</div>`:C.empty("无场景")}</div>
      </div>
      <div class="cols-2">
        <div class="panel"><h3>🏛 组织 (${orgs.length})</h3>${orgs.length?`<div class="dash-list">${orgs.map(o=>`<details><summary>${U.esc(o.name||"?")} ${o.type?C.badge(o.type,"purple"):""}</summary><div style="font-size:12px;padding:8px">${o.description?`<div>${U.esc(o.description)}</div>`:""}${o.goals?`<div>目标: ${U.esc(o.goals)}</div>`:""}${o.members?.length?`<div>成员: ${U.esc(o.members.join(", "))}</div>`:""}</div></details>`).join("")}</div>`:C.empty("无组织")}</div>
        <div class="panel"><h3>📍 地点 (${locs.length})</h3>${locs.length?`<div class="dash-list">${locs.map(l=>`<details><summary>${U.esc(l.name||"?")} ${l.type?C.badge(l.type,"info"):""}</summary><div style="font-size:12px;padding:8px">${l.description?`<div>${U.esc(l.description)}</div>`:""}${l.region?`<div>区域: ${U.esc(l.region)}</div>`:""}${l.features?.length?`<div>特征: ${U.esc(l.features.join(", "))}</div>`:""}</div></details>`).join("")}</div>`:C.empty("无地点")}</div>
      </div>
    </div>`;
  }
});

/* ── 🧠 叙事深度 ── */
Views.register({
  id:"narrative",
  render(){
    const d=AS.dashboardData.narrative;
    if(!d)return`<div class="panel" style="text-align:center;padding:40px"><h2>🧠 叙事深度</h2><p style="color:var(--muted)">请先选择一个模组</p></div>`;
    const mem=d.memory||{},brs=d.branches||[],cau=d.causality||{},rels=d.relations||[];
    return`<div class="grid">
      <div class="panel"><h2>🧠 叙事深度</h2><div class="sub">${d.turnCount||0} 轮 · ${mem.snapshots||0} 条记忆 · ${brs.length} 个分支 · ${cau.totalEvents||0} 个因果事件 · ${d.canonCount||0} 条正史</div></div>
      <div class="cols-2">
        <div class="panel"><h3>🧠 记忆层</h3>${mem.recentEntries?.length?`<div class="dash-list">${mem.recentEntries.map(e=>`<div class="dash-row"><span>${U.esc(e.summary||"")}</span><span style="color:var(--muted);font-size:11px">${U.rel(e.ts)}</span></div>`).join("")}</div>`:C.empty("无记忆快照","对话后自动生成")}</div>
        <div class="panel"><h3>🌿 分支</h3>${brs.length?C.table(brs,[{k:"name",l:"名称"},{k:"status",l:"状态",render:r=>C.badge(r.status||"active",r.isActive?"ok":"pending")}]):C.empty("仅主分支")}</div>
      </div>
      <div class="cols-2">
        <div class="panel"><h3>🔗 因果链</h3>${cau.events?.length?`<div class="dash-list">${cau.events.map(e=>`<details><summary>${U.esc(e.title||"?")} ${e.type?C.badge(e.type,"info"):""} ${e.time?`<span style="color:var(--muted)">${U.esc(e.time)}</span>`:""}</summary><div style="font-size:12px;padding:8px">${e.dependsOn?.length?`<div>依赖事件: ${U.esc(e.dependsOn.join(", "))}</div>`:""}</div></details>`).join("")}</div>`:C.empty("无因果链数据")}</div>
        <div class="panel"><h3>🔗 关系网络</h3>${rels.length?C.table(rels,[{k:"key",l:"关系"},{k:"type",l:"类型",render:r=>C.badge(r.type||"中性","info")},{k:"attitude",l:"态度",render:r=>`<span style="color:${(r.attitude||0)>0?"var(--ok)":(r.attitude||0)<0?"var(--bad)":"var(--muted)"}">${r.attitude||0}</span>`}]):C.empty("无关系数据")}</div>
      </div>
    </div>`;
  }
});

/* ── ⌨ 指令 ── */
Views.register({
  id:"commands",
  render(){
    const groups={
      "引擎":["/引擎 status","/引擎 load [名]"],
      "对话":["/推进","/推进 停止","/摘要链 show [N]","/压缩"],
      "世界":["/世界 list","/世界 new [名]","/世界 load [名]"],
      "存档/分支":["/存档 [名]","/读档 [名]","/存档列表","/分支 list","/分支 switch [名]"],
      "角色":["/角色 list","/角色 create [名]","/角色 show [名]"],
      "场景":["/场景 now","/场景 new [名]","/场景 move [名]","/场景 time [时间]"],
      "追踪":["/追踪 status","/追踪 伏笔","/追踪 冲突"],
      "审查":["/审查 check"],
      "模块":["/模块 list","/模块 on|off [ID]","/模块 preset [类型]"],
      "预设":["/预设 list","/预设 use [名]"],
    };
    return`<div class="grid"><div class="panel"><h2>⌨ 斜杠指令</h2><div class="sub">在对话输入框中输入以下指令来控制引擎行为</div><div class="dash-cmd-grid">${Object.entries(groups).map(([g,cmds])=>`<div class="panel tight"><h3>${U.esc(g)}</h3><div>${cmds.map(c=>`<code style="display:block;margin:2px 0;font-size:12px">${U.esc(c)}</code>`).join("")}</div></div>`).join("")}</div></div></div>`;
  }
});

/* ── 体检 ── */
Views.register({
  id:"health",
  render(){
    const h=AS.health;
    const items=[
      {n:"控制台版本",v:CFG.version,st:"ok"},
      {n:"已连接 LLM",v:AS.llmConnected?"✅":"❌",st:AS.llmConnected?"ok":"bad"},
      {n:"已选择模组",v:AS.selectedModule?.displayName||"无",st:AS.selectedModule?"ok":"pending"},
      {n:"可用模组数",v:AS.modules.length,st:AS.modules.length?"ok":"pending"},
      {n:"对话轮次",v:AS.messages.filter(m=>m.role==="assistant").length,st:"info"},
      {n:"API Key",v:h?.llm?.hasApiKey?"已保存":"未保存",st:h?.llm?.hasApiKey?"ok":"bad"},
      {n:"数据目录可写",v:h?.data?.writable?"✅":"未知",st:h?.data?.writable?"ok":"pending"},
    ];
    return`<div class="grid"><div class="panel"><h2>🔍 诊断</h2><div class="cols-auto">${items.map(i=>C.stat(i.n,i.v)).join("")}</div>${h?`<div class="panel tight"><h3>服务状态</h3><pre>${U.esc(U.json({version:h.version,llm:h.llm,data:h.data,debugMode:h.debugMode}))}</pre></div>`:`<div class="sub">状态正在加载...</div>`}</div></div>`;
  }
});

/* ═══════════════════════════════════════════════════════════════
 * 渲染引擎
 * ═══════════════════════════════════════════════════════════════ */

async function loadDashboardData(){
  const mk=AS.selectedModule?.id;
  if(!mk||mk==="__quick__")return;
  const tabs=AS.activeTab;
  try{
    if(tabs==="telemetry"&&!AS.dashboardData.telemetry){
      AS.dashboardData.telemetry=await API.dashboardTelemetry(mk);
      if(AS.activeTab==="telemetry")render();
    }
    if(tabs==="entities"&&!AS.dashboardData.entities){
      AS.dashboardData.entities=await API.dashboardEntities(mk);
      if(AS.activeTab==="entities")render();
    }
    if(tabs==="narrative"&&!AS.dashboardData.narrative){
      AS.dashboardData.narrative=await API.dashboardNarrative(mk);
      if(AS.activeTab==="narrative")render();
    }
  }catch(e){console.warn("dashboard 加载失败",e)}
}

function renderTabs(active){
  return CFG.tabs.map(t=>`<button class="tab ${active===t.id?"active":""}" data-tab="${U.esc(t.id)}">${U.esc(t.label)}</button>`).join("");
}

async function render(){
  try{
    const tab=AS.activeTab;
    U.qs("#tabs").innerHTML=renderTabs(tab);
    const ctx=AS.selectedModule?AS.selectedModule.displayName||AS.selectedModule.name:"未选择模组";
    U.qs("#contextLine").textContent=ctx;
    U.qs("#statusRight").textContent=`${AS.modules.length||0} 模组 · ${AS.messages.length} 条消息`;
    const st=U.qs("#llmStatus");
    if(st){st.className="badge "+(AS.llmConnected?"ok":"pending");st.textContent=AS.llmConnected?"已连接":"未连接"}
    const view=Views.get(tab);
    if(!view){U.qs("#main").innerHTML=C.empty("未知标签");bindEvents();return}
    U.qs("#main").innerHTML=view.render();
    bindEvents();
    if(["telemetry","entities","narrative"].includes(tab))loadDashboardData();
  }catch(e){
    console.error("render 出错",e);
    U.qs("#main").innerHTML=`<div class="panel" style="text-align:center;padding:40px"><h2>⚠️ 页面渲染出错</h2><p style="color:var(--bad)">${U.esc(e.message)}</p><button class="primary" onclick="location.reload()">🔄 刷新页面</button></div>`;
  }
}

async function selectInstalledModule(moduleId){
  const mod=AS.modules.find(m=>m.id===moduleId);
  if(!mod)return false;
  AS.selectedModule=mod;
  CH.clear();AS.dashboardData={};
  if(mod.dataMode==="character_card"){
    try{
      const res=await API.loadCharacter(mod._characterId||mod.id.replace("char:",""));
      if(res.status==="ok"&&res.card)AS._currentCharCard=res.card;
    }catch(e){}
  }else{
    await CH.loadFromServer(mod);
  }
  AS.activeTab="chat";
  return true;
}

/* ═══════════════════════════════════════════════════════════════
 * 事件绑定
 * ═══════════════════════════════════════════════════════════════ */

function bindEvents(){
  // Tab 切换
  for(const btn of U.qsa("[data-tab]"))
    btn.onclick=()=>{AS.activeTab=btn.dataset.tab;render();if(["telemetry","entities","narrative"].includes(btn.dataset.tab))loadDashboardData()};

  // 首页按钮
  U.qs("#homeBtn").onclick=()=>{AS.activeTab="home";render()};

  for(const btn of U.qsa("[data-action='show-onboarding']")){
    btn.onclick=async()=>{AS.config.firstRun=true;await API.saveConfig({firstRun:true});render()};
  }
  for(const btn of U.qsa("[data-action='onboarding-dismiss']")){
    btn.onclick=async()=>{AS.config.firstRun=false;await API.saveConfig({firstRun:false});render()};
  }
  for(const btn of U.qsa("[data-action='onboarding-import']")){
    btn.onclick=()=>{
      const ta=U.qs("#alchemyText");
      if(ta){ta.focus();ta.scrollIntoView({behavior:"smooth",block:"center"});}
    };
  }
  for(const btn of U.qsa("[data-action='onboarding-create']")){
    btn.onclick=()=>showCreateDialog("worldbook","世界书");
  }
  for(const btn of U.qsa("[data-action='install-example']")){
    const card=btn.closest("[data-example-id]");
    if(!card)continue;
    btn.onclick=async()=>{
      try{
        btn.disabled=true;
        const res=await API.installExample(card.dataset.exampleId);
        if(res.status==="ok"&&res.module){
          await refreshModules();
          await selectInstalledModule(res.module.id);
          AS.config.firstRun=false;
          await API.saveConfig({firstRun:false});
          createToast(`已导入: ${res.module.displayName||res.module.name}`);
          render();
        }
      }catch(e){createToast("导入失败: "+e.message,"bad")}
      finally{btn.disabled=false}
    };
  }

  // ── LLM 配置 ──
  const saveBtn=U.qs("#saveLlmBtn");
  if(saveBtn)saveBtn.onclick=async()=>{
    const url=U.qs("#cfgUrl")?.value;const model=U.qs("#cfgModel")?.value;const key=U.qs("#cfgKey")?.value;
    try{
      if(url)await API.saveConfig({llmBaseUrl:url,llmModel:model||"deepseek-v4-flash"});
      // 只有用户填了新 key 才更新，留空则保留服务端已有 key
      if(key)await API.saveLlmKey({value:key});
      const cfg=await API.loadConfig();Object.assign(AS.config,cfg);
      // 更新 hasApiKey：检查服务端是否还有 key
      try{const sec=await API.getSecrets();AS.hasApiKey=sec?.llm?.items?.length>0}catch{}
      createToast("配置已保存");
      // 自动测试
      AS.llmTestResult="<span class='loading'>测试中...</span>";render();
      try{const t=await API.testLlm({config:AS.config});if(t.status==="ok"){AS.llmConnected=true;AS.hasApiKey=true}else{AS.llmConnected=false};AS.llmTestResult=t.status==="ok"?`<span style="color:var(--ok)">✅ 连接成功 (${t.latencyMs}ms)</span>`:`<span style="color:var(--bad)">❌ ${U.esc(t.errorMsg||"连接失败")}</span>`;updateLlmStatusBadge();render()}catch(e){AS.llmTestResult=`<span style="color:var(--bad)">❌ ${U.esc(e.message)}</span>`;render()}
    }catch(e){createToast("保存失败: "+e.message,"bad")}
  };

  const testBtn=U.qs("#testLlmBtn");
  if(testBtn)testBtn.onclick=async()=>{
    const url=U.qs("#cfgUrl")?.value;
    // 服务端从 secrets.json 读取真实 Key，前端只传配置
    AS.llmTestResult="<span class='loading'>测试中...</span>";render();
    try{const t=await API.testLlm({config:{...AS.config,llmBaseUrl:url}});if(t.status==="ok"){AS.llmConnected=true;AS.hasApiKey=true}else{AS.llmConnected=false};AS.llmTestResult=t.status==="ok"?`<span style="color:var(--ok)">✅ 连接成功 (${t.latencyMs}ms)</span>`:`<span style="color:var(--bad)">❌ ${U.esc(t.errorMsg||"连接失败")}</span>`;updateLlmStatusBadge();render()}catch(e){AS.llmTestResult=`<span style="color:var(--bad)">❌ ${U.esc(e.message)}</span>`;render()}
  };

  // ── 模组操作 ──
  for(const btn of U.qsa("[data-action='select-module']")){
    const card=btn.closest("[data-module-id]");
    if(!card)continue;
    btn.onclick=async()=>{
      const id=card.dataset.moduleId;
      const mod=AS.modules.find(m=>m.id===id);
      if(!mod)return;
      if(mod.dataMode==="character_card"){
        // 角色卡选择：加载角色数据
        AS.selectedModule=mod;
        CH.clear();AS.dashboardData={};
        try{
          const res=await API.loadCharacter(mod._characterId||id.replace("char:",""));
          if(res.status==="ok"&&res.card) AS._currentCharCard=res.card;
        }catch(e){}
        AS.activeTab="chat";
        createToast(`已选择: ${mod.displayName||id} 🃏`);
        render();
      }else{
        // 普通模组选择
        AS.selectedModule=mod;
        CH.clear();AS.dashboardData={};
        await CH.loadFromServer(mod);
        AS.activeTab="chat";
        createToast(`已选择: ${mod.displayName||mod.name}${AS.messages.length?" · "+AS.messages.length+" 条历史":""}`);
        render();
      }
    };
  }

  // 从模板创建
  for(const btn of U.qsa("[data-action='create-from-template']")){
    const card=btn.closest("[data-module-id]");
    if(!card)continue;
    btn.onclick=async()=>{
      const id=card.dataset.moduleId;
      const tmpl=AS.modules.find(m=>m.id===id);
      if(!tmpl)return;
      // 生成模组名
      const baseName=tmpl.displayName||tmpl.name||"新世界";
      const name=prompt(`从「${baseName}」创建新模组，请输入名称:`, baseName);
      if(!name||!name.trim())return;
      try{
        const data={name:name.trim(),displayName:name.trim(),dataMode:tmpl.dataMode||"worldbook",subType:tmpl.subType||"classic",preset:tmpl.preset||"epic"};
        const res=await API.createModule(data);
        if(res.status==="ok"){
          await refreshModules();
          // 自动选中新模组
          const newMod=AS.modules.find(m=>m.id===res.module.id);
          if(newMod){AS.selectedModule=newMod;await CH.loadFromServer(newMod);AS.activeTab="chat";createToast(`✅ 已创建并选择: ${name}`);render()}
        }else{createToast(`创建失败: ${res.errorMsg}`,"bad")}
      }catch(e){createToast("创建失败: "+e.message,"bad")}
    };
  }

  for(const btn of U.qsa("[data-action='delete-module']")){
    const card=btn.closest("[data-module-id]");
    if(!card)continue;
    btn.onclick=async()=>{
      const id=card.dataset.moduleId;
      const mod=AS.modules.find(m=>m.id===id);
      const isChar=mod?.dataMode==="character_card";
      const typeLabel=isChar?"角色卡":"模组";
      if(!confirm(`确定删除${typeLabel}「${mod?.displayName||id}」？${isChar?"\n\n将从 data/engine/characters/ 中永久移除该角色卡。此操作不可恢复！":"\n\n删除后所有对话记录和设定数据将永久丢失。"}`))return;
      try{
        if(isChar){
          const res=await API.post("/api/characters/delete",{id:mod._characterId||id.replace("char:","")});
          if(res.status==="ok"){
            if(AS.selectedModule?.id===id)AS.selectedModule=null;
            createToast("角色卡已删除");
          }else{createToast("删除失败: "+(res.errorMsg||"未知错误"),"bad");return}
        }else{
          await API.deleteModule(id);
          createToast("已删除");
        }
        await refreshModules();
      }catch(e){createToast("删除失败: "+e.message,"bad")}
    };
  }

  const refreshBtn=U.qsa("[data-action='refresh-modules']");
  for(const btn of refreshBtn)btn.onclick=async()=>{await refreshModules();};

  // ── 新建模组 ──
  const createWorldbook=U.qsa("[data-action='create-worldbook']");
  for(const btn of createWorldbook)btn.onclick=()=>showCreateDialog("worldbook","经典");
  const createCharCard=U.qsa("[data-action='create-character-card']");
  for(const btn of createCharCard)btn.onclick=async()=>{
    const textArea=U.qs("#alchemyText");
    const text=textArea?.value?.trim();
    if(!text){createToast("请先输入或拖拽角色内容","bad");return}
    const name=prompt("输入角色卡名称:");
    if(!name||!name.trim())return;
    const resultEl=U.qs("#alchemyResult");
    if(resultEl)resultEl.innerHTML="<span class='loading'>🧬 正在分析角色人格...</span>";
    try{
      const res=await API.post("/api/alchemy/digest",{text,worldName:name.trim(),dataMode:"character_card"});
      if(res.status==="ok"){
        resultEl.innerHTML=`<span style="color:var(--ok)">✅ 角色卡「${U.esc(res.module?.displayName||name)}」已创建</span>`;
        createToast(`角色卡已就绪: ${res.module?.displayName||name}`);
        // 刷新模组列表（含角色卡）并自动选择新角色卡
        await refreshModules();
        const newModId="char:"+(res.module?.id?.replace(/^char:/,""));
        const newMod=AS.modules.find(m=>m.id===newModId);
        if(newMod){AS.selectedModule=newMod;CH.clear();AS.activeTab="chat";createToast(`已选择: ${newMod.displayName||name} 🃏`);render()}
      }else{
        resultEl.innerHTML=`<span style="color:var(--bad)">❌ ${U.esc(res.errorMsg)}</span>`;
      }
    }catch(e){
      if(resultEl)resultEl.innerHTML=`<span style="color:var(--bad)">❌ ${U.esc(e.message)}</span>`;
    }
  };
  const createPreset=U.qsa("[data-action='create-preset']");
  for(const btn of createPreset)btn.onclick=()=>showCreateDialog("preset","预设");

  // ── 对话─
  if(AS.activeTab==="chat")bindChat();

  // ── 炼金台 ──
  bindAlchemy();

  // ── 回到首页 ──
  for(const btn of U.qsa("[data-action='go-home']"))
    btn.onclick=()=>{AS.activeTab="home";render()};

  // ── 状态面板切换 ──
  for(const btn of U.qsa("[data-action='toggle-status-panel']"))
    btn.onclick=()=>{AS.showStatusPanel=!AS.showStatusPanel;render()};

  // ── 快速开始 ──
  const qsDrop=U.qs("#quickStartDrop");
  if(qsDrop){
    qsDrop.ondragover=e=>{e.preventDefault();e.dataTransfer.dropEffect='copy';qsDrop.classList.add("dragover")};
      qsDrop.ondragleave=()=>qsDrop.classList.remove("dragover");
      qsDrop.ondrop=async e=>{
          e.preventDefault();e.stopPropagation();qsDrop.classList.remove("dragover");
          const texts=[];
          const items=e.dataTransfer?.items;
          const files=e.dataTransfer?.files;
          // 诊断信息
          let dbg=[`items:${items?.length||0} files:${files?.length||0}`];
          // 方法1: items + webkitGetAsEntry（唯一支持文件夹递归的方式）
          if(items?.length){
            let fileCount=0,dirCount=0;
            for(let i=0;i<items.length;i++){
              const item=items[i];
              dbg.push(`item[${i}].kind=${item.kind}`);
              if(item.kind!=="file")continue;
              const entry=item.getAsEntry?item.getAsEntry():item.webkitGetAsEntry?item.webkitGetAsEntry():null;
              if(!entry){dbg.push(`item[${i}]: getAsEntry=null`);continue}
              dbg.push(`item[${i}]: ${entry.isDirectory?"📁dir":"📄file"} name=${entry.name||"?"}`);
              if(entry.isDirectory){
                dirCount++;
                // 递归读取目录
                async function readDir(dir,path){
                  const reader=dir.createReader();
                  const all=[];
                  while(true){
                    const batch=await new Promise(rs=>reader.readEntries(rs));
                    if(!batch.length)break;
                    all.push(...batch);
                  }
                  for(const c of all){
                    if(c.isFile){
                      fileCount++;
                      try{
                        const f=await new Promise((rs,rj)=>c.file(rs,rj));
                        const ext=f.name.split('.').pop().toLowerCase();
                        if(['md','txt','json'].includes(ext)){
                          texts.push(`【${path?path+'/':''}${f.name}】\n${await f.text()}\n`);
                        }
                      }catch(e){dbg.push(`读文件错误:${e.message}`)}
                    }else if(c.isDirectory){
                      await readDir(c,path?path+'/'+c.name:c.name);
                    }
                  }
                }
                await readDir(entry,"");
              }else if(entry.isFile){
                fileCount++;
                try{
                  const f=await new Promise((rs,rj)=>entry.file(rs,rj));
                  const ext=f.name.split('.').pop().toLowerCase();
                  if(['md','txt','json'].includes(ext)){
                    texts.push(`【${f.name}】\n${await f.text()}\n`);
                  }
                }catch(e){dbg.push(`读文件错误:${e.message}`)}
              }
            }
            dbg.push(`扫描到 ${fileCount} 个文件, ${dirCount} 个文件夹`);
          }
          // 方法2: 回退 files
          if(!texts.length&&files?.length){
            dbg.push("回退到 files 路径");
            for(let i=0;i<files.length;i++){
              const f=files[i];
              const ext=f.name.split('.').pop().toLowerCase();
              if(['md','txt','json'].includes(ext)){
                texts.push(`【${f.name}】\n${await f.text()}\n`);
              }
            }
          }
        if(texts.length){
          const ta=U.qs("#quickStartText");
          if(ta)ta.value=texts.join("\n---\n");
          createToast(`已读取 ${texts.length} 个文件`)
        }else{createToast(`未找到支持的文本文件 · ${dbg.join(" | ")}`,"warn")}
      };
    qsDrop.onclick=()=>{const inp=document.createElement("input");inp.type="file";inp.accept=".md,.txt,.json";inp.webkitdirectory=true;inp.onchange=async()=>{const files=inp.files;if(!files?.length)return;const texts=[];for(const f of files){const ext=f.name.split('.').pop().toLowerCase();if(['md','txt','json'].includes(ext)){texts.push(`【${f.webkitRelativePath||f.name}】\n${await f.text()}\n`)}}const ta=U.qs("#quickStartText");if(ta)ta.value=texts.join("\n---\n");createToast(`已读取 ${texts.length} 个文件`)};inp.click()};
  }
  const qsBtn=U.qs("[data-action='quick-start-chat']");
  if(qsBtn)qsBtn.onclick=()=>{
    const ta=U.qs("#quickStartText");
    const content=ta?.value?.trim();
    if(!content){createToast("请先粘贴内容或拖拽文件","bad");return}
    AS.quickStartContent=content;
    AS.isQuickStart=true;
    AS.selectedModule={id:"__quick__",name:"快速对话",displayName:"快速对话",dataMode:"worldbook",subType:"classic",turnCount:0};
    CH.clear();
    // 快速模式：不往可见对话塞设定文本，改为在 doSend 里以 system 消息静默传递
    AS.activeTab="chat";
    createToast("⚡ 快速模式 · 不保存记录");
    render();
  };
}

/* ── 对话绑定 ── */
function bindChat(){
  const chatInput=U.qs("#chatInput");
  const sendBtn=U.qs("[data-action='chat-send']");

  async function doSend(){
    if(AS.busy||!chatInput?.value?.trim())return;
    const txt=chatInput.value.trim();chatInput.value="";
    AS.busy=true;sendBtn.disabled=true;
    // 显示进度条
    const msgsEl2=U.qs("#chatMessages");
    if(msgsEl2){const pg=document.createElement("div");pg.className="chat-progress";pg.id="chatProgress";pg.innerHTML='<div class="pg-bar"><div class="pg-fill" style="width:30%"></div></div><div class="pg-stages"><span class="pg-stage active">\u{1F50D} 分析中\u2026</span></div>';msgsEl2.appendChild(pg);msgsEl2.scrollTo(0,msgsEl2.scrollHeight)}
    // 添加用户消息
    CH.add("user",txt);
    // 回显
    const msgs=U.qs("#chatMessages");
    if(msgs)msgs.innerHTML=AS.messages.map(C.chatMsg).join("");
    msgs?.scrollTo(0,msgs.scrollHeight);
    try{
      // 调用 LLM
      let msgPayload=AS.messages.map(m=>({role:m.role,content:m.content})).slice(-40);
      // 快速模式：把设定背景作为 system 消息静默传递，不显示在聊天界面
      if(AS.isQuickStart&&AS.quickStartContent){
        msgPayload=[{role:"system",content:"以下为叙事设定背景：\n"+AS.quickStartContent},...msgPayload];
      }
      const res=await API.chatSend({
        input:txt,
        moduleKey:AS.selectedModule?.id||"",
        dataMode:AS.selectedModule?.dataMode||"worldbook",
        engineState:AS.engineState||{turnCount:AS.selectedModule?.turnCount||0,dataMode:AS.selectedModule?.dataMode||"worldbook",emotionState:{engagement:5,tension:5,fatigue:5,curiosity:5}},
        messages:msgPayload
      });
      if(res.status==="ok"){
        // 更新进度条为完成状态
        const pgEl=U.qs("#chatProgress");
        if(pgEl&&res._progress){
          const stages=res._progress.stages||[];
          const fillPct=90+Math.min(10,stages.filter(function(s){return s.active}).length*2);
          pgEl.innerHTML='<div class="pg-bar"><div class="pg-fill" style="width:'+fillPct+'%"></div></div><div class="pg-stages">'+stages.map(function(s,i){return '<span class="pg-stage '+((s.active?'done':'')+(i===stages.length-1?' active':''))+'">'+(s.active?'\u2705':'\u23F3')+' '+s.name+'</span>'}).join('')+'<span class="pg-ms">'+res._progress.totalMs+'ms</span></div>';
          setTimeout(function(){var e=U.qs("#chatProgress");if(e)e.remove();},3000);
        }else if(pgEl)pgEl.remove();
        CH.add("assistant",res.narrative||"（无回应）");
        // 捕获状态/情绪数据用于侧栏面板
        AS.lastStatusSections=res.parsedSections||{};
        if(res.engineState) AS.engineState = res.engineState;
        if(res.turnCount&&AS.selectedModule) AS.selectedModule.turnCount = res.turnCount;
        // 清除 dashboard 缓存，下次打开时重新加载最新数据
        AS.dashboardData = {};
        // 刷新状态面板内容
        const spc=U.qs(".sp-body");
        if(spc)spc.innerHTML=C.statusPanel(AS.lastStatusSections);
      }else{
        var pgErr=U.qs("#chatProgress");if(pgErr)pgErr.remove();
        CH.add("error",res.errorMsg||"LLM 返回错误");
      }
      if(msgs)msgs.innerHTML=AS.messages.map(C.chatMsg).join("");
      msgs?.scrollTo(0,msgs.scrollHeight);
    }catch(e){
      var pgCatch=U.qs("#chatProgress");if(pgCatch)pgCatch.remove();
      CH.add("error",String(e.message||e));
      if(msgs)msgs.innerHTML=AS.messages.map(C.chatMsg).join("");
    }
    AS.busy=false;if(sendBtn)sendBtn.disabled=false;
  }

  const msgsEl=U.qs("#chatMessages");
  if(msgsEl)msgsEl.onclick=e=>{
    const btn=e.target.closest("[data-chat-clip]");
    if(!btn)return;
    const mid=btn.dataset.chatClip;
    const msg=AS.messages.find(m=>m.id===mid);
    if(msg){navigator.clipboard?.writeText?.(msg.content);createToast("已复制")}
  };

  if(sendBtn)sendBtn.onclick=doSend;
  if(chatInput)chatInput.onkeydown=e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();doSend()}};

  const clearBtn=U.qs("[data-action='chat-clear']");
  if(clearBtn)clearBtn.onclick=()=>{if(confirm("清空当前对话？")){CH.clear();render()}};
}

/* ── 炼金台绑定 ── */
function bindAlchemy(){
  const drop=U.qs("#alchemyDrop");
  const textArea=U.qs("#alchemyText");
  const importBtn=U.qs("[data-action='alchemy-import']");

  // 拖拽
  if(drop){
    drop.ondragover=e=>{e.preventDefault();e.dataTransfer.dropEffect='copy';drop.classList.add("dragover")};
    drop.ondragleave=()=>drop.classList.remove("dragover");
    drop.ondrop=async e=>{
      e.preventDefault();e.stopPropagation();drop.classList.remove("dragover");
      const files=e.dataTransfer?.files;
      if(files?.length){
        const texts=[];
        for(const f of files){
          const ext=f.name.split('.').pop().toLowerCase();
          if(['md','txt','json'].includes(ext)){
            texts.push(await f.text());
          }
        }
        if(texts.length&&textArea)textArea.value=texts.join("\n---\n");
        createToast(`已读取 ${texts.length} 个文件`);
      }
    };
    drop.onclick=()=>{
      const inp=document.createElement("input");inp.type="file";inp.accept=".md,.txt,.json,.png";
      inp.onchange=async()=>{
        const f=inp.files?.[0];if(!f)return;
        const txt=await f.text();
        if(textArea)textArea.value=txt;
        createToast(`已读取: ${f.name}`);
      };inp.click();
    };
  }

  // 导入按钮 → 炼金台消化：分析内容 → 自动创建模组
  if(importBtn)importBtn.onclick=async()=>{
    const text=textArea?.value?.trim();
    if(!text){createToast("请先输入或拖拽内容","bad");return}
    const resultEl=U.qs("#alchemyResult");
    if(resultEl)resultEl.innerHTML="<span class='loading'>分析并创建模组中...</span>";
    try{
      const res=await API.post("/api/alchemy/digest",{text,worldName:("解析_"+Date.now().toString(36))});
      if(res.status==="ok"){
        resultEl.innerHTML=`<span style="color:var(--ok)">✅ 模组已创建 · ${res.entries} 条目 / ${res.characters} 角色 / ${res.locations} 地点</span>`;
        createToast(`炼金台: "${res.module?.displayName}" 已就绪`);
        await refreshModules();
        // 自动选择新模组 → 跳转对话
        const newMod=AS.modules.find(m=>m.id===res.module?.id);
        if(newMod){AS.selectedModule=newMod;CH.clear();await CH.loadFromServer(newMod);AS.activeTab="chat";createToast(`已选择: ${newMod.displayName||newMod.name}`);render()}
      }else{
        resultEl.innerHTML=`<span style="color:var(--bad)">❌ ${U.esc(res.errorMsg)}</span>`;
      }
    }catch(e){
      if(resultEl)resultEl.innerHTML=`<span style="color:var(--bad)">❌ ${U.esc(e.message)}</span>`;
    }
  };
}

/* ── 创建模组对话框 ── */
function showCreateDialog(dataMode,label){
  const name=prompt(`输入新${label}的名称:`);
  if(!name||!name.trim())return;
  (async()=>{
    try{
      const data={name:name.trim(),displayName:name.trim(),dataMode};
      data.subType=dataMode==="worldbook"?"classic":"default";
      data.preset=dataMode==="worldbook"?"epic":"minimal";
      const res=await API.createModule(data);
      if(res.status==="ok"){
        createToast(`✅ 已创建: ${name}`);
        await refreshModules();
      }else{
        createToast(`创建失败: ${res.errorMsg}`,"bad");
      }
    }catch(e){createToast("创建失败: "+e.message,"bad")}
  })();
}

/* ── 刷新模组列表 ── */
async function refreshModules(){
  try{
    const mods=await API.loadModules();
    // 同时加载角色卡，合并到模组列表
    let chars=[];
    try{chars=await API.loadCharacters();}catch{}
    const charModules=(chars||[]).map(c=>({
      id:"char:"+c.id,
      name:c.displayName||c.name,
      displayName:c.displayName||c.name,
      dataMode:"character_card",
      subType:"default",
      preset:"minimal",
      turnCount:0,
      description:c.description||"",
      _characterId:c.id
    }));
    AS.modules=[...mods,...charModules];
    // 如果当前选中的模组还在，保留选择
    if(AS.selectedModule){
      const stillExists=AS.modules.find(m=>m.id===AS.selectedModule.id);
      if(!stillExists)AS.selectedModule=null;
    }
    render();
    const worldCount=mods.filter(m=>m.type==="world").length;
    const charCount=charModules.length;
    const extra=charCount?` + ${charCount} 个角色卡`:"";
    createToast(`已刷新 · ${worldCount} 个模组${extra}`);
  }catch(e){createToast("刷新失败: "+e.message,"bad")}
}

/* ── Toast ── */
let toastTimer;
let currentToast=null;
function createToast(msg,tone=""){
  if(currentToast)currentToast.remove();
  const t=document.createElement("div");
  t.style.cssText=`position:fixed;bottom:60px;left:50%;transform:translateX(-50%);z-index:999;padding:10px 20px;border-radius:8px;border:1px solid ${tone==="bad"?"rgba(229,77,77,.5)":"rgba(62,207,142,.4)"};background:${tone==="bad"?"#1f1212":"#0f1f18"};color:${tone==="bad"?"#ffadad":"#b8f0d0"};font-size:13px;box-shadow:0 4px 20px rgba(0,0,0,.5);max-width:80vw;text-align:center`;
  t.textContent=msg;document.body.appendChild(t);
  currentToast=t;
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>{t.remove();if(currentToast===t)currentToast=null},3500);
}

/* ═══════════════════════════════════════════════════════════════
 * 初始化
 * ═══════════════════════════════════════════════════════════════ */

async function refreshDebugLogs(){
    try{
      var d=await API.call("GET","/api/debug/logs?limit=50");
      var el=U.qs("#debugLogContent");
      if(el&&d.logs)el.innerHTML=d.logs.map(function(l){return '<div class="dp-entry"><span class="dp-ts">'+(l.ts||"").slice(11,19)+'</span><span class="dp-cat">'+(l.category||"")+'</span><span class="dp-msg">'+U.esc(l.message)+(l.data?' <span style="color:var(--muted)">'+U.esc(l.data)+'</span>':'')+'</span></div>'}).join("")||"无日志";
    }catch(e){}
  }
  // Ctrl+Shift+D 切换调试面板
  document.addEventListener("keydown",function(e){
    if(e.ctrlKey&&e.shiftKey&&e.key==="D"){
      e.preventDefault();
      var dp=document.querySelector(".debug-panel");
      if(dp){dp.classList.toggle("open");if(dp.classList.contains("open"))refreshDebugLogs()}
    }
  });

  async function exportModule(id){try{const w=window.open("","_blank");if(!w){createToast("请允许弹出窗口以下载导出文件","warn");return}const res=await API.call("GET","/api/data/export?moduleKey="+encodeURIComponent(id));const blob=new Blob([JSON.stringify(res,null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);w.location.href=url;setTimeout(()=>{URL.revokeObjectURL(url);w.close()},1000)}catch(e){createToast("导出失败: "+e.message,"bad")}}

function updateLlmStatusBadge(){var b=U.qs("#llmStatus");if(!b)return;b.className="badge "+(AS.llmConnected?"ok":"bad");b.textContent=AS.llmConnected?"已连接":"未连接"}

async function init(){
  // 检测 API base
  const bases=["http://localhost:3000",window.location.origin];
  for(const b of bases){
    try{
      const r=await fetch(b+"/api/status");
      if(r.ok){API.base=b;break}
    }catch{}
  }

  // 加载配置
  try{
    const cfg=await API.loadConfig();
    Object.assign(AS.config,cfg);
  }catch(e){console.warn("配置加载失败",e)}

  try{
    const ex=await API.loadExamples();
    AS.examples=Array.isArray(ex?.examples)?ex.examples:[];
  }catch(e){AS.examples=[]}

  // 获取密钥状态
  try{
    const sec=await API.getSecrets();
    AS.hasApiKey=sec?.llm?.items?.length>0;
  }catch(e){}

  // 自动测试 LLM 连接（如果有已保存的 key）
  if(AS.hasApiKey&&AS.config.llmBaseUrl){
    try{
      const t=await API.testLlm({config:AS.config});
      if(t.status==="ok"){AS.llmConnected=true}
      updateLlmStatusBadge();
    }catch(e){}
  }

  // 加载模组+角色卡（合并列表）
  try{
    await refreshModules();
  }catch(e){console.warn("模组+角色卡加载失败",e)}

  render();
  createToast("🌳 世界树桌面已启动");
  async function updateStatusBar(){
    try{
      var h=await API.call("GET","/api/health");
      AS.health=h;
      var left=U.qs("#statusLeft");
      var right=U.qs("#statusRight");
      if(h&&h.llm){
        var icon=h.llm.status==="connected"?"🟢":"🔴";
        if(left)left.innerHTML="World Tree v"+h.version+" · "+icon+" "+h.llm.model;
        if(right)right.innerHTML="⏱ "+h.uptime+"s · 💾 "+Math.round((h.data&&h.data.sizeBytes||0)/1024)+"KB · 🌍 "+(h.data&&h.data.worldsCount||0)+"世界 · "+((h.data&&h.data.totalTurns)||0)+"轮";
        if(h.debugMode){var dt=U.qs(".debug-toggle");if(dt)dt.style.display="block"}
      }
    }catch(e){}
    setTimeout(updateStatusBar,30000);
  }
  updateStatusBar();
}

init();
