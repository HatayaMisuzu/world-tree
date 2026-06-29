# Alchemy API Contract

## GET /api/alchemy/capabilities

返回功能入口地图。  
不写磁盘。  
不需要用户确认。

## POST /api/alchemy/plan

根据用户输入生成创作地图。  
不写磁盘。  
不需要用户确认。  
LLM 只推荐路线，不决定最终交付目标。

Request:

```json
{
  "text": "用户想法或设定",
  "userPreference": {},
  "previousPlan": null,
  "moduleKey": ""
}
```

Response:

```json
{
  "status": "ok",
  "planVersion": "alchemy-plan.v1",
  "intakeType": "quick_create",
  "entrypointMap": [],
  "userDecisionNeeded": {
    "allowedTargets": []
  }
}
```

## POST /api/alchemy/preview

保留旧接口，同时允许 quick_create / localize_existing 模式。  
不直接写正式入口。

## POST /api/alchemy/refine

基于旧 preview 和用户自由补充继续完善。  
不写正式入口。

## POST /api/alchemy/localize

将 preview 转成本地文件夹草案。  
不写磁盘。

Request:

```json
{
  "preview": {},
  "selectedTargets": []
}
```

## POST /api/alchemy/deliver

用户确认后交付到目标入口。  
会写磁盘。  
必须 `userConfirmed: true`。

Request:

```json
{
  "previewId": "preview id",
  "preview": {},
  "selectedTargets": ["world_module", "worldbook"],
  "userConfirmed": true,
  "deliveryMode": "install_new_module"
}
```

Error:

```json
{
  "status": "error",
  "code": "ALCHEMY_DELIVERY_CONFIRMATION_REQUIRED"
}
```

### POST /api/alchemy/generate-preview

Input:

```json
{
  "text": "用户灵感或完整设定",
  "plan": {},
  "selectedTargets": ["world_module", "worldbook"],
  "userSupplement": "用户自由补充"
}
```

Output:

```json
{
  "status": "ok",
  "previewVersion": "alchemy-quick-create-preview.v1",
  "mode": "quick_create",
  "title": "世界标题",
  "playableWorld": {},
  "worldbookEntries": [],
  "characters": [],
  "mechanismDrafts": [],
  "deliveryPlan": []
}
```

Rules:

- LLM may recommend content.
- User must choose delivery targets.
- Preview does not write files.
- Delivery requires `/api/alchemy/deliver` with `userConfirmed: true`.

## GET /api/alchemy/deliveries

查看交付日志。  
不写磁盘。
