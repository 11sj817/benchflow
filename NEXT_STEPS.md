# NEXT_STEPS — 下一阶段路线图

当前版本：BenchFlow 2.0 前端 MVP（本地演示模式）
目标：在不改变前端页面结构的前提下，接入真实后端与多端原生能力。

---

## 0. 总览

| 阶段 | 目标 | 关键产出 |
| --- | --- | --- |
| P1 | 后端主链路 | NestJS + PostgreSQL + 鉴权 + 审计 |
| P2 | 文件与报告 | 对象存储、服务端 PDF、异步解析 |
| P3 | 实时协同 | WebSocket 房间、在线状态、冲突处理 |
| P4 | 微信小程序原生 | 扫码、拍照、语音、订阅消息、审批 |
| P5 | 桌面采集 Agent | SCPI/VISA、波形抓取、自动回填 |
| P6 | 企业集成 | GitLab/企业微信/Webhook/Python SDK |

---

## 1. 需要接入的真实后端接口

前端 service 方法签名保持不变，内部切换实现。

### 1.1 必做接口（按优先级）

| 优先级 | 前端 service | 接口 |
| --- | --- | --- |
| P0 | `projectService` | `GET/POST/PATCH /projects`、`GET /projects/{id}/stats` |
| P0 | `requirementService` | `GET/POST/PATCH /requirements`、`/traceability`、`/coverage` |
| P0 | `productService` | `/products`、`/products/{id}/versions`、`/versions/compare` |
| P0 | `testCaseService` | `/test-cases`、`/publish`、`/duplicate`、`/import` |
| P0 | `testPlanService` | `/test-plans`、`/transition`、`/progress` |
| P0 | `executionService` | `/executions`、`/measurements`、`/finish`、`/defect-draft` |
| P0 | `defectService` | `/defects`、`/transition`、`/verify`、`/close`、`/regression-plan` |
| P0 | `orgService` / `auditService` | `/members`、`/roles/permissions`、`/audit-logs` |
| P1 | `reportService` | `/reports`（生成）、`/submit`、`/review`、`/publish`、`/pdf` |
| P1 | `deviceService` | `/devices`、`/calibration-alerts`、`/repairs` |
| P1 | `datasetService` | `/datasets/presign`、`/datasets` |
| P1 | `shareService` | `/shares`、`/public/shares/{token}` |
| P2 | `integrationService` | Webhook 配置、GitLab/企业微信 OAuth |

完整契约见 [`docs/API_DESIGN.md`](docs/API_DESIGN.md)。

### 1.2 鉴权与权限

- OIDC / 账号密码 + JWT 短期 Access Token + Refresh Token。
- 每次请求由后端校验：角色、组织、项目成员关系、资源归属。
- 访客分享使用独立短期 token，只读、限范围、可撤销、记录访问审计。
- 前端 `app.can()` 仅用于 UI，不作为授权依据。

### 1.3 错误与幂等

- 业务错误返回 `422` + 错误码（如 `DEFECT_VERIFICATION_REQUIRED`），前端直接展示 message。
- 写操作支持 `Idempotency-Key`；更新使用版本号或 `If-Unmodified-Since`。

---

## 2. 需要落地的数据库表

建议 PostgreSQL 16，`uuid` 主键，`timestamptz`。

### 2.1 阶段一（主链路）

```text
organizations
members
projects
project_members
requirements
requirement_cases
products
product_versions
version_changes
test_cases
test_case_revisions
test_plans
plan_cases
plan_assignees
plan_devices
executions
measurements
step_results
defects
defect_comments
defect_timeline
defect_verifications
audit_logs
```

### 2.2 阶段二（资产与交付）

```text
attachments
datasets
dataset_cases
devices
device_usage
device_repairs
reports
report_reviews
share_links
notifications
todos
templates
integrations
```

字段、枚举、索引与约束见 [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md)。

### 2.3 迁移与种子

- 使用 Prisma 或 TypeORM migration。
- 将 `src/mock/seed*.ts` 转为后端 seed 脚本，保证演示环境与前端一致。
- 生产环境禁止写入演示数据；通过环境变量控制。

---

## 3. WebSocket 协同能力

### 3.1 连接与房间

```text
wss://host/ws?token=...
房间：org:{orgId} / project:{projectId} / execution:{executionId}
```

### 3.2 事件

| 事件 | 载荷 | 前端行为 |
| --- | --- | --- |
| `execution.created` | id, planId, caseId | 计划详情与执行列表局部刷新 |
| `execution.updated` | id, result | 详情与看板更新 |
| `defect.created` | id, projectId | 缺陷列表、通知 |
| `defect.status_changed` | id, from, to | 详情、看板、通知 |
| `report.reviewed` | id, status | 报告列表与详情 |
| `device.calibration_due` | deviceId, days | 顶部提醒 |
| `presence.changed` | online, members | 显示在线人数（明确为真实在线） |

### 3.3 冲突处理

- 表单保存携带 `version`；服务端冲突返回 409 + 最新实体。
- 执行测量值以“字段级最后写入 + 版本校验”处理，避免整行覆盖。
- 断线重连使用 lastEventId 补拉增量（服务端事件表）。

### 3.4 明确不做

- 不在前端伪造在线人数或“云端同步成功”。
- 未连接后端时，界面继续显示“本地演示模式”。

---

## 4. 微信小程序原生能力

当前 `#/mobile` 是响应式 Web 演示，**不是**已发布的小程序原生包。

### 4.1 页面规划

| 页面 | 能力 | 对应 Web 演示 |
| --- | --- | --- |
| 工作台 | 我的任务、待办、消息红点 | `/mobile/home` |
| 扫码 | `wx.scanCode` 识别项目/设备二维码 | `/mobile/scan` |
| 测试记录 | 测量值表单、结果判定、提交 | `/mobile/record` |
| 拍照 | `wx.chooseMedia` + 上传 | 记录页照片入口 |
| 语音 | `RecorderManager` 录音 + 上传/转写 | 记录页语音模拟 |
| 异常上报 | 创建缺陷、拍照、定位 | 记录页异常 Tab |
| 消息 | 订阅消息、审核提醒 | `/mobile/messages` |
| 项目 | 项目卡片、进度 | `/mobile/projects` |

### 4.2 需要后端提供

- 小程序登录：`wx.login` → code → `code2session` → 绑定成员 → 自定义 token。
- 上传：预签名或后端中转；图片压缩与病毒扫描。
- 订阅消息模板与发送任务（报告待审核、缺陷待验证、校准到期）。
- 审批：报告审核、缺陷关闭审核的移动端操作与权限校验。

### 4.3 工程

- 独立 `miniprogram/` 源码目录，不与 PC 前端混编。
- 统一请求封装、401 重登、环境配置（参考仓库外的既有微信工程经验，但不得复用其业务与品牌）。
- 与 PC 共用 API 契约与枚举，不共享组件实现。

---

## 5. 桌面采集 Agent

目标：实验室电脑连接仪器，自动采集并回填测量值，减少手工录入。

### 5.1 能力

- PyVISA / SCPI 连接示波器、直流电源、电子负载、功率分析仪。
- 按用例参数定义执行测量序列（如纹波峰峰值、效率、温升）。
- 抓取波形 CSV/PNG 并上传对象存储。
- 通过 REST 创建执行、提交测量值、附上原始文件。
- 本地缓存与断网重试；设备序列号与校准状态校验。

### 5.2 接口

```text
POST /api/v1/executions
PUT  /api/v1/executions/{id}/measurements
POST /api/v1/datasets/presign → 直传 → POST /api/v1/datasets
```

### 5.3 安全

- Agent 使用设备级 token，仅允许写入指定项目。
- 不上传仪器原始网络地址；命令白名单。
- 采集脚本与用例绑定，禁止任意脚本执行。

---

## 6. 企业集成

| 集成 | 下一步 |
| --- | --- |
| GitHub | OAuth App、commit 关联版本、Actions 产物归档 |
| GitLab | Base URL + Token、MR 关联需求、Pipeline 回填 |
| 企业微信 | 应用凭证、消息模板、审批流 |
| Webhook | 签名（HMAC-SHA256）、重试、事件订阅管理 |
| REST API | OpenAPI 3.1 文档、客户端凭证、限流 |
| Python SDK | `benchflow-sdk`：创建执行、提交测量、上传波形 |
| SCPI/VISA | 与桌面 Agent 共用驱动层 |

---

## 7. 前端需要同步改造的点

1. `services/*` 增加 remote 实现与统一错误处理；环境变量切换 `VITE_DATA_MODE=local|remote`。
2. 列表查询改为服务端分页/排序/筛选（当前 `useTable` 为本地实现）。
3. 增加加载态、重试、离线提示；当前演示数据为同步读取。
4. 文件上传改为分片/预签名；进度与失败重试。
5. 报告 PDF 改为服务端生成，保留打印作为兜底。
6. 审计日志改为只读服务端数据，前端不再本地追加。
7. E2E 测试（Playwright）覆盖核心闭环：执行失败 → 缺陷 → 回归 → 关闭 → 报告。

---

## 8. 验收标准（后端接入后）

- [ ] 两个浏览器、两台设备看到同一项目数据，刷新与重连不丢状态。
- [ ] 未授权用户无法通过直接调用 API 读写项目数据。
- [ ] 执行提交在服务端完成判定，前端仅展示。
- [ ] 缺陷关闭在服务端强制校验验证记录。
- [ ] 文件上传可追溯到执行、用例、项目与上传人。
- [ ] 审计日志不可修改，可按项目与操作人检索。
- [ ] 分享链接过期/撤销后立即失效，访问有审计。
- [ ] 小程序可扫码、拍照、录音、提交记录并收到审核通知。
- [ ] Agent 采集的测量值与手工录入使用同一数据模型。
