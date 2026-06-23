# API Reference

## Health

| Method | Path | Purpose |
| --- | --- | --- |
| GET | /api/health | 健康检查 |

## Routes

| Method | Path | Purpose |
| --- | --- | --- |
| GET | /api/routes | 列出所有可用模式入口 |

## Projects

| Method | Path | Purpose |
| --- | --- | --- |
| POST | /api/modules/create | 创建新项目（支持所有 8 个模式） |
| GET | /api/projects/:projectId/summary | 项目摘要 |
| POST | /api/projects/:projectId/turn | 运行一轮模式 |
| GET | /api/projects/:projectId/proposals | 列出待审核提案 |
| POST | /api/projects/:projectId/proposals/:proposalId/approve | 批准提案 |
| POST | /api/projects/:projectId/proposals/:proposalId/reject | 拒绝提案 |

## Import / Export

| Method | Path | Purpose |
| --- | --- | --- |
| POST | /api/world-pack/export | 导出 .worldtree |
| POST | /api/world-pack/import | 导入 .worldtree |

## Character

| Method | Path | Purpose |
| --- | --- | --- |
| GET | /api/characters/:projectId/profile | 获取角色资料 |
| POST | /api/characters/:projectId/profile | 更新角色资料 |
| POST | /api/characters/:projectId/import | 导入角色卡 |
| POST | /api/characters/:projectId/export | 导出角色卡 |
| POST | /api/characters/:projectId/ooc-check | OOC 检查 |

## Worldbook / Grand World

| Method | Path | Purpose |
| --- | --- | --- |
| GET | /api/worldbook/:projectId | 获取世界书 |
| POST | /api/worldbook/:projectId | 更新世界书 |
| POST | /api/worldbook/:projectId/activate | 激活上下文 |
| GET | /api/grand-world/:projectId/summary | 大世界摘要 |
| POST | /api/grand-world/:projectId/turn | 大世界 turn |

## Creation Forge

| Method | Path | Purpose |
| --- | --- | --- |
| GET | /api/creation-forge/:projectId/summary | 炼金台摘要 |
| POST | /api/creation-forge/:projectId/intake | 分析输入 |
| POST | /api/creation-forge/:projectId/blueprint | 生成蓝图 |
| POST | /api/creation-forge/:projectId/instantiate | 实例化项目 |
| POST | /api/creation-forge/:projectId/export | 导出 |

## Response Format

```json
{ "ok": true, "data": {}, "error": "message if failed" }
```

## Security

- 所有路径经过 path-security 校验
- 写入经过 persistence-service
- 不直接拼接用户输入路径
- 错误不抛裸异常
