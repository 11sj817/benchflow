# BenchFlow API 设计草案

版本：v1（未实现，供后端接入使用）
风格：REST + JSON；实时事件通过 WebSocket 广播
认证：OAuth2 / OIDC（或组织 SSO）+ Bearer Token
根路径：`/api/v1`

> 当前前端使用 LocalStorage 演示数据。本文件定义未来 NestJS 后端的接口契约，前端 service 方法将按此映射，页面无需改动。

---

## 1. 通用约定

### 分页

```http
GET /api/v1/projects?page=1&pageSize=20&sort=updatedAt:desc
```

```json
{
  "items": [],
  "page": 1,
  "pageSize": 20,
  "total": 42
}
```

### 错误

```json
{
  "error": {
    "code": "DEFECT_VERIFICATION_REQUIRED",
    "message": "缺陷关闭必须存在验证记录",
    "details": { "defectId": "..." },
    "traceId": "..."
  }
}
```

| HTTP | 语义 |
| --- | --- |
| 400 | 参数校验失败 |
| 401 | 未认证 |
| 403 | 无权限 / 数据范围外 |
| 404 | 资源不存在 |
| 409 | 状态冲突（如非法状态流转、受引用不可删除） |
| 422 | 业务规则不满足（如缺少验证记录） |
| 429 | 限流 |

### 幂等与并发

- 写操作支持 `Idempotency-Key`。
- 更新携带 `If-Unmodified-Since` 或 `version` 字段；冲突返回 409 与最新实体。

---

## 2. 资源与端点

### 2.1 项目 / 需求

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | /projects | 列表，支持 status/ownerId/tag/keyword |
| POST | /projects | 创建 |
| GET | /projects/{id} | 详情 |
| PATCH | /projects/{id} | 更新 |
| POST | /projects/{id}/archive | 归档 |
| DELETE | /projects/{id} | 仅无关联数据时允许 |
| GET | /projects/{id}/stats | 通过率 / 覆盖率 / 进度 / 风险 |
| GET/POST | /requirements | 列表 / 创建 |
| PATCH/DELETE | /requirements/{id} | 更新 / 删除 |
| POST | /requirements/{id}/split | 拆分 |
| GET | /requirements/{id}/traceability | 需求 → 用例 → 执行 → 缺陷 |
| GET | /projects/{id}/coverage | 覆盖率统计 |

### 2.2 产品与版本

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET/POST | /products | 产品列表 / 创建 |
| PATCH | /products/{id} | 更新 |
| GET/POST | /products/{id}/versions | 版本列表 / 创建 |
| PATCH | /versions/{id} | 更新状态 / 说明 / 变更项 |
| DELETE | /versions/{id} | 被引用时 409 |
| GET | /products/{id}/versions/compare?left=&right= | 差异（物料/参数/测试/缺陷） |

### 2.3 用例与计划

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET/POST | /test-cases | 列表 / 创建 |
| GET/PATCH/DELETE | /test-cases/{id} | 详情 / 保存 / 删除 |
| POST | /test-cases/{id}/publish | 发布（版本递增 + 修订记录） |
| POST | /test-cases/{id}/duplicate | 复制 |
| POST | /test-cases/import | CSV 批量导入 |
| GET/POST | /test-plans | 列表 / 创建 |
| GET/PATCH | /test-plans/{id} | 详情 / 更新 |
| POST | /test-plans/{id}/transition | 状态流转 |
| GET | /test-plans/{id}/progress | 用例执行矩阵 |

### 2.4 执行与测量

```http
POST /api/v1/executions
{
  "planId": "TP-2401-02",
  "caseId": "TC-1002",
  "testerId": "M-005",
  "deviceIds": ["DEV-001", "DEV-003"],
  "environment": { "temperature": 25, "humidity": 48, "inputVoltage": 48, "load": 50, "note": "" },
  "conditions": "48V 输入 / 12V 输出 / 50A 满载",
  "note": ""
}
```

服务端行为：校验计划与用例、复制用例阈值生成 measurement 占位、分配 RUN 编号、写审计。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | /executions | 列表（project/plan/result/tester/date） |
| PATCH | /executions/{id} | 环境 / 备注 |
| PUT | /executions/{id}/measurements | 批量提交测量值（服务端判定） |
| PATCH | /executions/{id}/steps/{stepId} | 人工步骤结果 |
| POST | /executions/{id}/attachments | 预签名上传后登记 |
| POST | /executions/{id}/finish | 提交（校验必填 + 计算总结果） |
| POST | /executions/{id}/defect-draft | 生成缺陷预填 |
| DELETE | /executions/{id} | 关联缺陷时 409 |

### 2.5 缺陷

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET/POST | /defects | 列表 / 创建 |
| GET/PATCH | /defects/{id} | 详情 / 更新（根因、方案） |
| POST | /defects/{id}/assign | 分派 |
| POST | /defects/{id}/transition | 状态流转（服务端状态机） |
| POST | /defects/{id}/comments | 评论 / @ |
| POST | /defects/{id}/verify | 提交验证（校验同用例 PASS 执行） |
| POST | /defects/{id}/close | 关闭（要求 verification） |
| POST | /defects/{id}/reopen | 重开（必填原因） |
| POST | /defects/{id}/regression-plan | 创建回归计划 |

### 2.6 设备 / 数据集 / 模板

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET/POST | /devices | 列表 / 新增 |
| PATCH | /devices/{id} | 更新（校准等） |
| POST | /devices/{id}/repairs | 维修记录 |
| GET | /devices/calibration-alerts | 到期 / 过期 |
| POST | /datasets/presign | 获取对象存储上传地址 |
| POST | /datasets | 登记元信息 |
| GET/DELETE | /datasets/{id} | 详情 / 删除 |
| GET/POST | /templates | 模板列表 / 创建 |
| POST | /templates/{id}/duplicate | 复制 |

### 2.7 报告 / 分享 / 组织

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET/POST | /reports | 列表 / 生成（type + 目标 id） |
| GET/PATCH | /reports/{id} | 详情 / 编辑 |
| POST | /reports/{id}/submit | 提交审核 |
| POST | /reports/{id}/review | 通过/驳回（禁止作者自审） |
| POST | /reports/{id}/publish | 发布 |
| GET | /reports/{id}/pdf | 服务端 PDF（后续） |
| GET/POST | /shares | 分享列表 / 创建 |
| DELETE | /shares/{id} | 撤销 |
| GET | /public/shares/{token} | 无需登录的只读视图 |
| GET/PATCH | /members | 成员列表 / 邀请 |
| PATCH | /members/{id}/role | 角色变更（审计） |
| GET | /roles/permissions | 权限矩阵 |
| GET | /audit-logs | 审计查询（仅管理员） |
| GET/PATCH | /settings/org | 组织资料 |

---

## 3. 状态机（服务端权威）

### 缺陷

```text
new → assigned | in_progress
assigned → in_progress | new
in_progress → resolved | assigned
resolved → verified | in_progress | reopened
verified → closed | reopened
closed → reopened
reopened → assigned | in_progress
```

附加约束：

- `resolved` 需要 `rootCause` 与 `fixPlan` 非空。
- `verified` 需要 verification（同用例 PASS 执行）。
- `closed` 需要 verification；记录 `closedAt`。

### 计划

```text
draft → pending → running → review → completed
任意状态 → cancelled（有执行记录时仍需保留）
```

---

## 4. WebSocket

连接：`wss://<host>/ws?token=...`（短期 token）
房间：`org:{id}`、`project:{id}`、`execution:{id}`

事件示例：

```json
{ "event": "execution.updated", "room": "project:P-2401", "data": { "id": "RUN-0017", "result": "FAIL" } }
{ "event": "defect.status_changed", "room": "org:BFL-DEMO", "data": { "id": "BUG-0021", "from": "verified", "to": "closed" } }
{ "event": "presence.changed", "room": "project:P-2401", "data": { "online": 3 } }
```

前端收到事件后失效对应查询缓存，不直接拼装业务状态。

---

## 5. 上传

1. `POST /datasets/presign` 获取 `{ url, fields, key }`。
2. 前端直传对象存储。
3. `POST /datasets` 提交 `key / filename / size / sha256 / projectId / executionId`。
4. 服务端异步解析 CSV 预览、生成缩略图、病毒扫描。
5. 下载使用短期签名 URL，权限与数据集可见性一致。

限制：单文件默认 200MB（后端可配），CSV 预览仅解析前 N 行；浏览器演示环境为 2MB。

---

## 6. 前端 service → API 映射

| 前端方法 | HTTP |
| --- | --- |
| `projectService.list()` | GET /projects |
| `projectService.create(input)` | POST /projects |
| `executionService.setMeasurement(id, mid, v)` | PATCH /executions/{id}/measurements/{mid} |
| `executionService.finish(id)` | POST /executions/{id}/finish |
| `defectService.verify(id, {executionId,note})` | POST /defects/{id}/verify |
| `reportService.generateFromPlan(id)` | POST /reports `{type:'plan',planId}` |
| `analyticsService.dashboard(range)` | GET /analytics/dashboard?from&to |

建议为每个 service 提供 `local` 与 `remote` 两个实现，通过环境变量切换，保留同一接口。

---

## 7. 安全

- 所有写操作服务端校验角色 + 项目成员关系 + 数据范围。
- 访客 token 只允许 GET 指定分享范围。
- 审计日志仅追加，管理员可查，不可改。
- 敏感字段（序列号、客户信息）按组织策略脱敏。
- 限流：登录、分享访问、批量导入分别限流；上传校验 MIME 与大小。
