# BenchFlow 技术架构

版本：2.0 前端 MVP
更新：随仓库代码维护

---

## 1. 架构目标

1. 页面不直接操作底层模拟数据，所有业务读写经过 service 层。
2. 统一数据模型，便于未来替换为 NestJS + PostgreSQL。
3. 本地演示具备真实交互：持久化、跨标签页同步、权限可见性、审计。
4. 多端（PC / 移动 / 工位）共享业务数据与服务，仅表现层不同。
5. 构建产物可直接部署到 GitHub Pages 子路径。

---

## 2. 分层

```text
views / layouts（表现层）
   │  只调用 service 与只读 store/db
   ▼
components（通用展示与图表）
   │
   ▼
services（业务层，唯一写入口）
   │  mutate() → 校验 → 持久化 → 广播 → 审计
   ▼
mock seed + db.ts（reactive 内存状态 + LocalStorage）
```

### 2.1 数据层 `services/db.ts`

- `db`：Vue `reactive` 单例，应用生命周期内唯一数据源。
- `createSeedDb()`：每次调用深拷贝种子，避免重置后引用污染。
- `loadDb()`：读取 `benchflow.db.v2`，schema 不匹配或解析失败时回落种子。
- `persist()`：写 LocalStorage，并通过 BroadcastChannel 广播 `{type:'db-changed', writer}`。
- `mutate(fn, auditMeta)`：唯一写入口。执行变更 → `meta.revision++` → 追加审计 → 持久化。
- `initSync()`：BroadcastChannel + `storage` 事件；远端变更后重新 hydrate。
- `resetDb()`：恢复种子并记录 `reset` 审计。

> 页面组件中不存在 `localStorage.setItem` 或直接数组修改；仅测试与数据管理界面通过 db 提供的函数操作。

### 2.2 业务服务

| 服务 | 职责 |
| --- | --- |
| `projectService` / `requirementService` | 项目 CRUD、统计、风险、需求追踪与覆盖率 |
| `productService` | 产品、版本、变更项、版本对比、产品统计 |
| `testCaseService` / `testPlanService` | 用例版本与发布、计划 CRUD、计划进度 |
| `executionService` | RUN 创建、测量判定、提交、CSV 导入、缺陷预填 |
| `defectService` | 生命周期状态机、分派、评论、验证、关闭、回归计划 |
| `deviceService` / `datasetService` / `templateService` | 设备校准、数据集摄取、模板 |
| `reportService` / `shareService` | 数据驱动报告生成、审核、发布、只读分享 |
| `memberService` / `notificationService` / `todoService` / `integrationService` / `auditService` / `orgService` | 组织、通知、待办、集成、审计、设置 |
| `analyticsService` | 工作台、质量分析、样本与 Cpk 聚合 |

`services/index.ts` 统一出口，页面按需具名导入。

### 2.3 状态管理

- `useAppStore`：会话（用户 + 角色）、当前成员、权限 `can()`、访客可见项目、侧栏折叠、紧凑模式。会话持久化键 `benchflow.session.v2`。
- `useWorkspaceStore`：数据修订号、存储用量、跨标签页同步时间与事件数、重置。
- 业务数据本身不入 Pinia，避免“同一份数据两份状态”。

---

## 3. 关键数据流

### 3.1 执行 → 判定 → 缺陷

```text
测试计划详情 / 执行列表 / 移动端 / 工位
   │ executionService.create(planId, caseId, ...)
   ▼
Execution(PENDING) + 按用例参数生成 Measurement[]
   │ setMeasurement() → judgeValue(value, min, max)
   │ finish() → 校验必填 → recalculate()
   ▼
PASS / FAIL
   │ FAIL → defectDraft(runId) 预填标题、超限摘要、版本、证据
   ▼
/defects?create=1&execution=RUN-xxxx → defectService.create()
```

### 3.2 缺陷闭环

```text
transition() 状态机 → 校验根因/修复方案
verify()     要求同用例 PASS 回归
close()      要求 verification 存在
createRegression() → testPlanService.create + 置为 pending
```

### 3.3 版本对比

`productService.compare(left, right)` 合并两版本 `changeItems`，按 item 对比；按硬件版本取各用例最新执行结果；合并关联缺陷；输出 `changedItems / improved / regressed` 摘要。报告服务复用该结果生成对比报告。

---

## 4. 路由与多端

- Hash 路由（`createWebHashHistory`），GitHub Pages 刷新不 404。
- 路由表独立在 `src/router/routes.ts`，测试直接断言 18 模块与详情页存在。
- 守卫：访客仅能进入标记 `meta.guest` 的页面；移动端、工位、分享、登录跳过。
- 布局：
  - `MainLayout`：深色侧栏 236px、工具栏 56px、全局搜索、通知、终端预览、身份切换、演示数据弹窗。
  - `MobileLayout`：独立手机布局 + 底部 5 Tab，不是 PC 缩放。
  - `StationLayout`：全屏工位顶部栏 + 大触控区域。
  - `AuthLayout`：演示身份选择。

---

## 5. 权限模型

```ts
RoleKey = super_admin | org_admin | project_owner | test_lead | test_engineer | dev_engineer | guest
PermissionAction = view | create | edit | delete | execute | review | export | manage
```

- 角色 → 权限集合在 `utils/permission.ts`。
- 页面按钮用 `app.can(action)` 控制显隐/禁用。
- 服务层对关键动作再做业务校验（缺陷关闭、报告自审、删除受引用对象）。
- 前端权限不是安全边界；后端必须重新校验。

---

## 6. 性能与稳定性

- 路由级代码分割；ECharts 按需注册；图表组件在 `onBeforeUnmount` dispose 并移除 resize 监听。
- 表格统一 `useTable`：筛选在 computed，排序 + 分页在组合式函数，避免重复实现。
- `persist()` 默认同步写入（数据量 < 1MB）；预留延迟写入分支。写入失败会捕获并在控制台提示，不阻塞交互。
- 所有列表页对空结果给出 EmptyState；所有按钮均有实际行为或明确禁用原因。
- 详情页使用 `v-if` 守卫缺失实体，避免空引用。

### 已知性能取舍

- Element Plus 全量引入，首屏 chunk 约 1.1MB（gzip 380KB）。后续可按需引入或拆 vendor。
- ECharts 独立 chunk 约 586KB（gzip 196KB），仅分析页与执行详情加载。
- 演示数据规模小，未引入虚拟滚动。

---

## 7. 工程规范

- TypeScript strict；`verbatimModuleSyntax`，类型导入使用 `import type`。
- 禁止在页面写 `any`（ESLint 规则为 warning，当前无告警）。
- 统一使用设计变量（`tokens.css`），不在页面硬编码主色值。
- 服务层返回实体或抛出具业务语义的错误，页面捕获后 `ElMessage.error`。
- 测试只覆盖纯逻辑与服务层，UI 交互通过手动验收矩阵确认（见 TEST_REPORT）。

---

## 8. 演进到真实后端

1. 为每个 service 增加 `api` 实现（Axios），保留相同方法签名，页面不改。
2. `db.ts` 在真实模式下退化为查询缓存；写操作改为调用 API 后失效缓存。
3. WebSocket 事件（execution.updated / defect.status_changed）推送后局部刷新。
4. 文件上传改为对象存储预签名 URL；服务端保存元信息与哈希。
5. 审计日志改为只追加表，前端只读。

详见 `API_DESIGN.md` 与 `../NEXT_STEPS.md`。
