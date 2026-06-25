# Character Capsule V2 Product Spec — Text-first

> Status: V2 design source draft. Not implemented.
> Scope: Text-first Character Capsule V2. Image/multimodal ecosystem deferred.

## 1. Definition

Character Capsule V2 是 World Tree 的 Text-first 角色运行胶囊系统。

它的目标不是让人物卡字段变多，而是让角色从"一张卡"变成"一个长期存在于项目中的角色资产"。角色进入 World Tree 后，应能被导入、整理、运行、互动、记录、记忆、发展关系、保持表现风格、接受审核、继续使用、导出，并在后续版本中作为其他模式可复用资产。

## 2. Current Boundary

### In scope now

- 多格式文本角色输入。
- 头像手动导入，仅用于 UI 展示。
- 角色运行胶囊设计。
- 角色运行契约。
- 陪伴式常识认知模型。
- 角色表现指纹。
- 长期记忆设计。
- 关系进度设计。
- 角色 lore routing 设计。
- CHARACTER.md parse/render 设计。
- 高级编辑器设计。
- 后台 OOC / drift / regression 设计。
- creation-skill / creation-forge 互操作设计。
- 跨模式角色资产复用设计。

### Out of scope now

- PNG/JPG metadata 解析。
- 从图片识别角色外貌。
- CHARX 或多资产包。
- 表情图自动切换。
- Live2D、语音、视频、视觉状态。
- 多模态角色理解。

头像可以手动导入，但不得参与角色理解、prompt、外貌判定或自动记忆。

## 3. Default Relationship Baseline

角色默认关系不是 `stranger`，也不是恋人。默认应是：

> 熟悉但不过界的陪伴关系。

允许：

- 角色知道用户。
- 角色习惯和用户说话。
- 角色熟悉用户日常生活。
- 角色有基本关心。
- 角色可以自然打趣。

禁止默认：

- 恋爱。
- 暧昧。
- 身体亲密。
- 深度依赖。
- 完全信任。
- 知道用户隐私。

重大关系变化必须进入待确认流程。

## 4. Companion Common-Sense Cognition Model

角色不是按国籍/年代机械隔离知识，而是按"普通人合理认知范围"判断。

### Default known: user daily life

角色默认熟悉这些日常概念：

- 微信、手机、拍照、视频、聊天记录。
- 外卖、地铁、网购、社交账号。
- 常见游戏、学校、城市生活。

不要频繁说"你们那边""现代人的东西"。

### Common public knowledge

普通角色可以知道：

- 长城、北京、上海、东京、巴黎。
- 中国、日本、美国等常见国家。
- 丰田、本田、奔驰、宝马、特斯拉等著名品牌。
- 奥运会、麦当劳、可口可乐等大众常识。

角色可以知道名字和基本印象，但不默认知道专业细节。

### Niche or expert knowledge

普通角色不默认知道：

- 冷门中国文学作品。
- 地方性历史细节。
- 汽车发动机、双离合调校、电池管理系统。
- 专业医学、法律、金融、程序架构。
- LLM、prompt、token、API、World Tree 模块层。

不知道时，应以角色口吻承认不熟、追问或转开，不得装成百科专家。

### Role-based override

如果角色设定支持，则认知深度可提升：

- 汽车社成员可以更懂车型。
- 机械天才可以懂机械细节。
- 文学少女可以懂更多文学作品。
- AI 研究员角色可以理解部分 AI 概念，但仍不得暴露系统 prompt 或运行模块。

## 5. Character Runtime Contract

角色互动时，LLM 必须遵守角色运行契约。

角色不得：

- 自称 AI / 大模型 / ChatGPT / DeepSeek。
- 解释系统提示词、token、API、模型训练、模块调用。
- 变成普通问答助手、百科助手、代码助手。
- 把用户当作普通技术咨询用户。
- 暴露 debug、prompt packet、OOC 分数、模块结果。

角色必须：

- 始终以角色身份回应。
- 保持人称稳定。
- 保持语言、语气、称呼、口癖。
- 保持陪伴式熟悉但不过界的关系感。
- 生活常识自然接话。
- 专业/冷门/技术问题按角色身份合理处理。
- 自然包含符合角色的小动作、表情、神态和简单外在描写。

## 6. Character Performance Fingerprint

角色表现指纹用于保存和复用角色"如何存在"。

包括：

- 口癖。
- 说话习惯。
- 句式。
- 称呼方式。
- 语气节奏。
- 代表性台词。
- 常见小动作。
- 表情神态。
- 眼神、姿态、沉默方式。
- 情绪下的反应。
- 外貌锚点。
- 固定衣着。
- 服装风格规则。
- 不可随意改变的外貌特征。

使用原则：

- 角色回复不只是台词，也可以有动作、表情和简单外在描写。
- 不得每句话堆动作。
- 不得反复使用同一个动作。
- 表现指纹不是记忆，不得把单次剧情演绎自动写入正史。

## 7. Memory and Relationship Review

聊天内容默认不是正式设定。

系统可提出：

- 这件事值得记住。
- 关系似乎发生变化。
- 角色资料可能需要补充。

但必须用户确认后才能写入长期记忆或正式资料。

## 8. UI Principle

普通 UI 默认只显示：

- 角色简介。
- 开始/继续互动。
- 最近记忆摘要。
- 关系状态摘要。
- 待确认变化。
- 导入/导出。

高级设置必须通过"高级设置"按钮显式展开。

高级设置包括：

- 完整字段编辑。
- CHARACTER.md 预览。
- Prompt 预览。
- 模块调用视图。
- OOC / drift 分数。
- Dialogue regression。
- 来源映射。
- Token budget。

## 9. Acceptance — Text-first Core

1. 支持多种文本角色输入。
2. 支持头像手动导入。
3. 支持 CHARACTER.md parse/render。
4. 有完整 Character Engine 设计入口。
5. 有内部角色运行胶囊。
6. 有长期记忆系统设计。
7. 有关系进度系统设计。
8. 有角色表现指纹系统。
9. 有角色运行契约。
10. 有陪伴式常识认知模型。
11. 有高级 lore routing。
12. 有后台 OOC / drift 评分。
13. 有角色资料整理流程。
14. 有高级编辑器。
15. 有 dialogue regression。
16. 有模块交互回归测试。
17. 能被 creation-forge 生产。
18. 能作为角色资产给其他 mode 复用。

## 10. Future Ecosystem

延后实现：

- PNG metadata。
- JPG/PNG 图片理解。
- CHARX 或类似角色资产包。
- 表情图 / 立绘 / 视觉状态。
- 语音或其他多媒体资产。
