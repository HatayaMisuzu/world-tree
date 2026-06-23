# Scripts & Checks

## 可用脚本

| 脚本 | 命令 | 用途 | 何时运行 |
| --- | --- | --- | --- |
| start | npm start | 启动本地服务 | 开发时 |
| test | npm test | 主集成/语法测试 | 修改后 |
| test:unit | npm run test:unit | 所有单元测试 | 每次修改 |
| test:integration | npm run test:integration | 所有集成测试 | 发布前 |
| audit | npm run audit | 项目审计（依赖安全） | 发布前 |
| interface-audit | npm run interface-audit | API 与文件 IO 联动检查 | 修改 API 后 |
| preflight | npm run preflight | 发布前总检查 | 每次提交前 |
| docs:check | npm run docs:check | 文档完整性检查 | 文档修改后 |

## Scripts 目录

- scripts/check.mjs — 项目语法与结构检查
- scripts/test.mjs — 测试入口
- scripts/audit.mjs — 安全审计
- scripts/interface-audit.mjs — 接口联动审计
- scripts/check-docs.mjs — 文档完整性检查

## preflight 覆盖

`npm run preflight` 依次运行: audit → check → test:unit → test:integration → interface-audit
