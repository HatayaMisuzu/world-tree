# WTD vs SillyTavern — 对比分析与产品化建议

> 基于 SillyTavern (成熟开源 AI 前端) 的架构研究，对照 WTD 现状  
> 目标：给出**具体可落地的改进方向**，让 WTD 从「引擎原型」变成「成熟产品」

---

## 一、宏观对比

| 维度 | SillyTavern | WTD | 差距 |
|------|------------|-----|------|
| **代码量** | ~1,700KB (前端) + ~800KB (后端) | ~69KB (HTML内联) + ~200KB (引擎) | WTD 轻量但功能少 |
| **前端架构** | 模块化 JS 文件 (`scripts/` 目录 70+ 文件) | 单 HTML 内联 ~1200 行 JS | WTD 全在一个文件，难维护 |
| **后端架构** | Express + 按功能分 endpoints/ | 原生 http + 单文件 server.js | WTD 单文件路由，简单但扩展难 |
| **多 API 支持** | 15+ API 提供商 | 1 (OpenAI-compatible) | WTD 单一 |
| **插件系统** | 15 个标准扩展 + 第三方 | 无 | ❌ WTD 无 |
| **国际化** | 18 种语言 | 中英混杂 | ❌ |
| **主题** | 亮色/暗色 + 自定义 CSS | 仅暗色 | ❌ |
| **PWA** | manifest.json | 无 | ❌ |
| **用户系统** | 多用户 + 权限控制 | 单用户 | ✅ 够用 |
| **数据管理** | 用户隔离存储 + 备份 | 单目录 JSONL | 持平 |
| **启动方式** | `Start.bat` 一键启动 | `node server.js` | ❌ WTD 门槛高 |
| **包管理** | 丰富的 npm 依赖 | 零依赖 | ✅ WTD 极简 |

---

## 二、SillyTavern 做对了什么（WTD 应借鉴的）

### 2.1 零门槛启动

```
SillyTavern 的 Start.bat:
  @echo off
  pushd %~dp0
  npm install --no-save --no-audit (静默安装)
  node server.js
  pause

用户操作 = 双击 Start.bat ✅
```

**WTD 当前**：要用户自己开命令行、`cd` 到目录、`node server.js`

**建议**：
- 提供 `Start.bat` (Windows) + `start.sh` (macOS/Linux)
- `Start.bat` 自动 `npm install` + 自动打开浏览器 `start http://localhost:3000`
- 可选：用 `pkg` 打包成单 exe

### 2.2 模块化前端架构

```
SillyTavern 前端:
  public/
    index.html          ← 骨架(734KB,含模板)
    script.js           ← 主逻辑(494KB)
    style.css            ← 主样式(121KB)
    scripts/
      chats.js          ← 聊天逻辑
      characters.js     ← 角色管理
      group-chats.js    ← 群聊
      extensions.js     ← 扩展系统
      power-user.js     ← 高级设置
      ... 70+ 文件
    css/
      themes/            ← 主题
      ... 各组件样式
    locales/
      zh-cn.json        ← 中文
      en.json           ← 英文
      ... 18 种语言
```

**WTD 当前**：全部在 `world-tree-console.html` 一个文件，1218 行 JS + CSS + HTML 混杂

**问题**：
- 无法分工协作（一个文件多人改冲突）
- 无法按需加载（打开页面就要加载全部代码）
- 调试定位慢（`Ctrl+F` 搜 1200 行）
- 扩展性差（加一个新功能就要往 1200 行里塞）

**建议**：

前端拆分方案（渐进式，不一次性重写）：

```
world-tree-console.html    ← 保留为入口，减少到 ~300 行骨架
public/
  js/
    app.js                ← 应用状态 + 初始化
    api.js                ← API 调用封装 (从 HTML 抽出)
    views/
      home.js             ← 首页视图
      chat.js             ← 聊天视图
      dashboard.js        ← 仪表盘视图
    components/
      toast.js            ← Toast 组件
      status-panel.js     ← 状态面板
      module-card.js      ← 模组卡片
  css/
    base.css              ← 基础变量 + 布局
    chat.css              ← 聊天样式
    dashboard.css         ← 仪表盘样式
    themes/
      dark.css            ← 暗色主题
      light.css           ← 亮色主题
  locales/
    zh-cn.json            ← 中文
    en.json               ← 英文
```

**工作量估算**：3-5 天  
**收益**：可维护性提升 10x，为插件系统打基础

### 2.3 丰富的 API 提供商支持

```
SillyTavern 支持:
  OpenAI / Anthropic / Google Gemini
  Azure / OpenRouter / Together AI
  NovelAI / KoboldAI / TextGenWebUI
  Ollama (本地) / vLLM / TabbyAPI
  ... 15+ 提供商
```

**WTD 当前**：只支持 OpenAI-compatible API

**建议**：
- 新增 `server.js` 中 `API 适配器模式`
- 每个提供商一个适配文件（参考 ST 的 `endpoints/openai.js`）
- 至少支持：OpenAI / Anthropic Claude / Google Gemini / Ollama（本地）

```
src/adapters/
  provider/
    openai.js      ← 当前 deepseek 走的就是这个
    anthropic.js   ← Claude API
    google.js      ← Gemini API
    ollama.js      ← 本地模型
    openrouter.js  ← 多模型路由
  llm.js           ← 统一入口，按 provider 分发
```

**工作量估算**：2-3 天  
**收益**：用户可以选择任意模型，不锁死 DeepSeek

### 2.4 扩展/插件系统

```
SillyTavern 扩展规范:
  public/scripts/extensions/<name>/
    manifest.json   ← 元数据（名称/版本/脚本/样式/依赖）
    index.js        ← 主逻辑
    style.css       ← 样式
    settings.html   ← 设置面板（弹出式）

  内置扩展:
  ├─ regex          ← 正则替换/格式化输出
  ├─ memory         ← 长期记忆/摘要
  ├─ tts            ← 文字转语音（15+ 引擎）
  ├─ stable-diffusion ← AI 绘图
  ├─ translate      ← 翻译
  ├─ quick-reply    ← 快捷回复
  └─ ...
```

**WTD 当前**：无扩展系统

**建议**：不要一次性做大而全的插件系统。先用「内部模块化」替代：

1. **阶段一**（2天）：把引擎各子模块（世界书/情绪/导演/守护者）的调用标准化
2. **阶段二**（3天）：加一个简单的「钩子系统」——`onBeforeChat` / `onAfterChat` / `onRender`
3. **阶段三**（5天）：参考 ST manifest 规范，允许加载外部插件目录

```
src/core/plugins/
  loader.js         ← 扫描 plugins/ 目录，加载 manifest
  hooks.js          ← onBeforeChat/onAfterChat/onRender 钩子
  api.js            ← 插件可以调用的 API 白名单

plugins/
  example-plugin/
    manifest.json
    index.js
```

**最应该先做的两个"插件"**（直接用内置模块实现）：
- **正则替换器**：用户自定义输入/输出正则，替换敏感词或格式化
- **自动摘要**：每 N 轮自动对历史对话做摘要，塞入上下文

### 2.5 多语言支持

```
SillyTavern:
  public/locales/
    zh-cn.json    ← "Chat": "聊天"
    en.json       ← "Chat": "Chat"
    ... 18 种语言
  i18n.js         ← 翻译加载 + 字符串替换引擎
```

**WTD 当前**：硬编码中英文混杂

```
现存的中英混杂问题:
  - server.js 英文注释: "Build module model"
  - src/adapters/llm.js 英文: "No world-tree module is loaded"
  - HTML 中文: "启动中..."
  - 引擎 prompt 中文: 【绝对规则·必须遵守】
  - 库函数注释: 英文 JSDoc
```

**建议**：
1. 前端做一个简单的 `t()` 函数（甚至不需要 i18n 库）
2. 所有用户可见字符串集中到 `locales/zh-cn.json`
3. 引擎 prompt 保留中文（用户是中文用户）
4. 代码注释可以英文保持国际可读性

```js
// 极简 i18n（50 行）
const LOCALE = {};
async function loadLocale(lang) {
  const res = await fetch(`/locales/${lang}.json`);
  LOCALE.all = await res.json();
}
function t(key, ...args) {
  let s = LOCALE.all?.[key] || key;
  args.forEach((a, i) => s = s.replace(`{${i}}`, a));
  return s;
}
```

**工作量估算**：1-2 天  
**收益**：用户看到的是完整中文界面，开发者能看到英文技术文档

### 2.6 用户数据隔离与备份

```
SillyTavern:
  data/
    default-user/
      characters/      ← 角色卡
      chats/           ← 对话记录
      settings.json    ← 用户设置
      stats.json       ← 使用统计
    _cache/            ← 缓存
    _storage/          ← 用户上传
    _uploads/          ← 临时上传
```

**WTD 当前**：
```
data/
  engine/
    worlds/            ← 世界模组
    characters/        ← 角色卡
    runs/              ← 运行记录
```

数据目录合理，但缺少：
- **无用户隔离**：多用户共用目录
- **无设置存储**：`config.json` 在 `userData/`，和 engine 数据分离
- **无导出 UI**：只能手动复制目录

**建议**：
- 数据路径统一到 `data/` 下（当前 `userData/` 和 `data/` 分离，应该合并）
- 增加「导出模组」按钮：打包成 `.wtpack` (ZIP)
- 增加「导入模组」按钮：拖拽 `.wtpack` 自动解压
- 对话导出为 Markdown 小说格式

**工作量估算**：2-3 天  
**收益**：用户能备份/分享自己的世界

### 2.7 配置系统(feature parity)

```
SillyTavern config.yaml 包含:
  - 服务器设置: 端口/SSL/白名单/认证
  - API 设置: 多 API Key + 多模型
  - 界面设置: 主题/语言/热键
  - 功能开关: 语音/图片/扩展
```

**WTD** 的 config.json：
```json
{
  "llmBaseUrl": "https://api.deepseek.com/v1",
  "llmModel": "deepseek-v4-flash",
  "theme": "dark",
  "language": "zh-CN"
}
```

配置灵活度不足，但胜在简单。**建议保持简单**——不要变成 config.yaml 那种庞然大物。

只需加：
- `provider` 字段（API 提供商类型，默认为 `openai`）
- 允许多个 API Key 配置（当前已有 secrets 多 key 支持，但前端只显示一个）

---

## 三、WTD 独有的优势（ST 没有，要坚持）

### 3.1 零外部依赖

```
WTD:  零 npm 依赖（纯 Node.js 原生 API）
ST:   ~100+ npm 包

优势: 
  - 安装极快（`npm install` 瞬间完成）
  - 无安全漏洞风险
  - 文件体积小（不打包的话 < 1MB）
  - 可读性强（不需要理解第三方库的细节）
```

**建议**：**保持零依赖**——这是 WTD 最大的差异化优势。  
如果要加功能，优先用原生 API 实现，不要轻易引入 npm 包。

### 3.2 内置叙事引擎

```
WTD:  世界书匹配 + 情绪追踪 + 叙事导演 + 邻近环 + 记忆系统
ST:   无原生引擎（依赖用户配置 prompt 模板 + instruct 模式）

优势:
  - 开箱即有「类 DM」体验
  - 世界书自动匹配关键词
  - 情绪驱动的叙事节奏
  - 无需用户配置复杂的 prompt
```

**建议**：**强化这个优势**——让 WTD 的引擎智能成为卖点，而不是和 ST 比"谁的 UI 功能多"。

### 3.3 极简架构

```
WTD:  1 个 server.js + 1 个 HTML = 全部
ST:   Express + webpack + jquery + 100+ 依赖

优势:
  - 全栈通读只需 2 个文件
  - 容易修改和调试
  - 部署简单
```

**建议**：保持极简风格，但适度拆分前端（见 2.2 节），不要一次性推到 ST 的复杂度。

---

## 四、分阶段实施路线

### Phase 1：降低门槛（1 周）

```
目标: 让用户双击就能用

改动量: 极小，但用户体验提升最大

1. Start.bat + start.sh                  [0.5天]
   双击启动，自动打开浏览器
   参考 SillyTavern 的 Start.bat 模式

2. 启动时自动检测端口 + 自动打开浏览器   [0.5天]
   server.js 启动后调用 start http://...

3. 首次运行检测 + 引导提示               [1天]
   检测到 config.json 是默认值 →
   首页显示「欢迎！请先配置 API Key」
   参考 ST 的 config-init.js

4. 内置示例模组                          [1天]
   defaults/examples/ 放 2 个预制角色卡
   首次启动自动检测无模组 → 提示「要不要试试示例？」

5. 所有错误信息中文化                    [1天]
   替换 server.js 中所有英文错误提示
```

**交付物**：双击 Start.bat → 自动装依赖 → 自动打开浏览器 → 看到引导页

### Phase 2：体验打磨（2 周）

```
目标: 让用户愿意日常使用

6. 前端模块化拆分                       [3-5天]
   HTML 从 1200 行拆分到多个 JS 文件
   参考 ST 的 scripts/ 目录结构

7. 对话操作升级                         [2天]
   消息复制/删除/引用
   对话搜索（Ctrl+F）

8. 状态面板升级                         [2天]
   情绪变化曲线（Canvas 迷你图）
   状态更新动画

9. 数据导出                             [2天]
   模组导出 .wtpack
   对话导出 .md
   参考 ST 的 content-manager.js

10. PWA 支持                            [1天]
    manifest.json + service worker
    可安装为桌面应用（参考 ST 的 manifest.json）
```

### Phase 3：功能扩展（2 周）

```
目标: 从"能用"到"好用"

11. 多 API 提供商                        [2-3天]
    Ollama / Anthropic / OpenAI 适配器

12. 国际化                               [1-2天]
    locales/zh-cn.json + t() 函数

13. 亮色/暗色双主题                      [1-2天]
    CSS 变量 + 切换按钮

14. 插件系统 v1                          [3-5天]
    钩子系统 → 正则替换插件 → 记忆插件

15. 响应式布局                           [2天]
    平板/手机可用
```

---

## 五、关键决策点

### 要学 SillyTavern 的：

| 要学的 | 原因 |
|--------|------|
| ✅ `Start.bat` 一键启动 | 零门槛 |
| ✅ 前端模块化拆分 | 维护性 |
| ✅ 国际化（极简版） | 体验一致性 |
| ✅ 数据导出 UI | 用户信任 |
| ✅ PWA manifest.json | 像正经应用 |
| ✅ 多 API 提供商 | 用户选择权 |

### 不要学 SillyTavern 的：

| 不要学的 | 原因 |
|---------|------|
| ❌ 100+ npm 依赖 | 违背 WTD 零依赖哲学 |
| ❌ jQuery（ST 大量用） | 过时技术 |
| ❌ 多用户/权限系统 | 本地工具不需要 |
| ❌ 复杂的 prompt 模板系统 | WTD 引擎已做 |
| ❌ webpack 构建 | 增加复杂度 |
| ❌ 图片生成/语音合成 | 偏离核心叙事体验 |

### WTD 应该走自己的路

```
WTD ≠ 另一个 SillyTavern

SillyTavern = 通用 AI 聊天前端（万能但复杂）
WTD         = 专注 AI 叙事的引擎（精巧但智能）

WTD 的核心竞争力:
  1. 开箱即用的叙事引擎（ST 要用户自己配 prompt）
  2. 零依赖、极简、易懂（ST 复杂到新手望而却步）
  3. 本地优先、数据自主（ST 偏向在线 API）

所以 WTD 的目标用户是:
  「想用 AI 写故事/跑团，但不想折腾配置的人」
  而不是:
  「想跟各种 AI 模型聊天的高级用户」
```

---

## 六、推荐优先做的三件事（一两周内）

如果只有一周时间，不要碰模块化拆分、不要碰插件系统、不要碰多 API。**做这三件**：

### 1️⃣ Start.bat + 自动打开浏览器（半天）

```batch
@echo off
pushd %~dp0
npm install --no-save --no-audit --loglevel=error --no-progress
echo 正在启动世界树桌面...
start http://localhost:3000
node server.js
pause
```

**效果**：从「找文档→装Node→敲命令」变成「双击」

### 2️⃣ 首次运行引导 + 示例模组（1-2天）

**效果**：从「空白配置页」变成「有引导、有示例、知道下一步」

### 3️⃣ 中文错误信息 + 导出对话按钮（1天）

**效果**：用户遇到问题知道怎么办，写完故事能导出来保存

---

**这三件事做完，普通用户就能自己完成：**

```
下载 → 双击 Start.bat → 浏览器自动打开 → 引导配置 API Key
→ 点击"试试示例模组" → 开始对话
→ 聊完点"导出对话" → 得到一篇 Markdown 小说
```

**而这一切只需要改动 ~200 行代码。**
