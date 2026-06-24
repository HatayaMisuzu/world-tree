# API Reference

> 当前真实路由总表见 [`API_ROUTE_INVENTORY.md`](./API_ROUTE_INVENTORY.md)。本文保留详细协议说明；两者不一致时，应以 `server.js` 与 route inventory 的当前验证结果为准。

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

## P0-P2 Kernel Completion APIs

下列端点仅接受本机请求；`:projectId` 解析后仍须位于受管 worlds 根目录。活动分支由服务端解析，客户端不能传任意文件路径。

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/projects/:projectId/kernel/summary` | P0/P1/P2、活动分支、遥测、待审提案、止损窗口和素材候选摘要 |
| GET | `/api/projects/:projectId/branches` | 列出分支 |
| POST | `/api/projects/:projectId/branches/create` | 从当前或指定来源创建隔离分支 |
| POST | `/api/projects/:projectId/branches/:branchId/switch` | 切换活动分支 |
| POST | `/api/projects/:projectId/branches/:branchId/archive` | 归档非活动、非根分支 |
| GET | `/api/projects/:projectId/branches/:branchId/diff?from=main` | 只读差异摘要；不提供 merge |
| GET | `/api/projects/:projectId/telemetry/latest` | 最近一次模糊遥测 |
| POST | `/api/projects/:projectId/telemetry/refresh` | 只读 shared/runtime，写 branch-local telemetry 日志 |
| POST | `/api/projects/:projectId/advance/auto-light` | 仅对“继续”意图预演一个 beat；选择点或风险门会停止 |
| POST | `/api/projects/:projectId/proposals/:proposalId/approve` | 审批；critical 需要 `secondConfirm: true` |
| GET | `/api/projects/:projectId/proposals/stop-loss` | 查询止损窗口 |
| POST | `/api/projects/:projectId/proposals/:proposalId/reverse` | 生成待审逆操作提案，不立即回滚 |
| POST | `/api/projects/:projectId/processing/ingest` | 摄取素材并保留 source label/hash |
| GET | `/api/projects/:projectId/processing/candidates` | 列出 branch-local 候选 |
| POST | `/api/projects/:projectId/processing/candidates/:candidateId/deliver` | 投递候选到 Growth Tree 或 proposal queue |

## Workflow APIs (Current)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/workflow/run` | 执行工作流编排操作 |
| GET | `/api/workflow/types` | 返回活跃 workflow 类型列表（prototype/declared 不暴露） |
| GET | `/api/workflow/status` | 返回工作流层状态与服务列表 |

### POST /api/workflow/run

Request:
```json
{
  "workflowType": "play.turn",
  "modeId": "world-rpg",
  "projectId": "demo",
  "branchId": "main",
  "userInput": "前往酒馆",
  "options": { "disableNetwork": false }
}
```

Response:
```json
{
  "ok": true,
  "workflowType": "play.turn",
  "visibleText": "...",
  "routed": {
    "candidates": [],
    "proposals": [],
    "runtimeUpdates": [],
    "debug": {}
  },
  "warnings": [],
  "errors": [],
  "debugSummary": {}
}
```

重要规则：
- 普通 workflow 不直接写 shared canon；写入必须走 candidate → proposal 或 initialization write
- debug 输出已 redact，不包含 hiddenTruth / private / system_only / 绝对路径
- 真实 LLM 使用 server config，不可用时有安全 fallback
