# World Tree Engine Help

Desktop 版世界树引擎把 Hermes skill 的功能面拆成四层：

1. 代码层：确定性状态机、命令、overlay、检索、解析。
2. 知识卡层：M1-M19 和 M-创作的 LLM 运行规则。
3. 全文库层：完整 skill 文档本地检索。
4. 帮助层：用户可读文档。

所有写入默认进入数据根的 `_desktop_engine`，不覆盖原核心 JSON。
