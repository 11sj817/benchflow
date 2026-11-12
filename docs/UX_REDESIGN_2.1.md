# BenchFlow 2.1 · 交互体验重构报告

> 目标不是增加页面，而是减少完成同一任务所需的步骤，并保证 PC、手机、平板工位之间切换时不丢失上下文。

## 1. 验收结论

| 任务 | 2.0 路径 | 2.1 路径 | 步骤变化 |
| --- | --- | --- | --- |
| 从项目进入某计划开始测试 | 工作台 → 项目 → 计划 → 执行 → 选择用例 → 逐项录入 | 项目 → 扫码/计划卡「开始测试」→ 分步录入 | 约 7 步 → 3 步 |
| 现场发现异常建缺陷 | 记录 → 复制 RUN 编号 → 缺陷列表 → 新建 → 回填 | 执行详情「创建缺陷」→ 自动带入项目/版本/用例/执行 | 约 8 步 → 2 步 |
| 找到某个执行记录 | 项目 → 计划 → 执行列表 → 筛选项目 | `Ctrl+K` 输入 RUN 编号直接打开 | 约 5 步 → 1 步 |
| 手机查看缺陷 | 手机点缺陷 → 跳回 PC 缺陷详情 | 手机缺陷详情页，底部导航保留 | 不再跳出移动布局 |
| 平板开始工位执行 | 选择计划/用例/设备/环境分散 | 单屏选择计划+用例，开始后步骤占据主区域 | 约 5 步 → 2 步 |

自动化结果：`typecheck` / `lint` / `test` / `build` 全部通过；测试 52 条（原 37 条 + 新增 15 条）。

## 2. PC 导航与工作台

- 侧边栏固定为六个一级区域：工作台、项目中心、测试中心、研发资产、分析与交付、组织管理。
- 支持组展开/收起、整栏收起、当前路由自动展开所属组；展开状态写入 `benchflow.nav.openGroups.v1`，整栏状态写入 `benchflow.sidebar.collapsed`。
- 单一菜单组（工作台）不再显示重复子项。
- 「我的工作台」按角色显示不同重点：
  - 测试负责人 / 项目负责人：待审核报告、项目未关闭缺陷、今日待办；
  - 测试工程师：我的执行、今日待办、我上报/负责的缺陷；
  - 研发工程师：分派给我的缺陷、待办；
  - 访客：共享项目与报告，只读。
- 工作台包含今日待办、待处理缺陷、待审核报告、最近访问、最近一次执行、继续上次测试、项目风险、快捷操作和近 7 天质量摘要。
- 最近访问由 `MainLayout` 统一记录项目、计划、执行、缺陷、用例、报告、产品详情，写入 `benchflow.recents.v1`（最多 12 条）。

## 3. 全局搜索与快捷操作（Ctrl+K）

`Ctrl+K` / `⌘K` 打开命令面板，支持：

- 搜索 10 类对象：项目、需求、计划、用例、执行、缺陷、产品、设备、数据集、报告；
- 支持编号精确命中（如 `RUN-0017`）与名称/描述关键词；
- 访客仅返回项目与报告；
- 键盘 ↑/↓ 选择、Enter 打开、Esc 关闭；
- 空关键词时显示 8 个快捷操作：创建项目/需求/计划/用例、创建测试记录、提交缺陷、上传数据、生成报告；
- 快捷操作按权限过滤。

实现：`src/utils/search.ts`、`src/components/layout/CommandPalette.vue`、`src/layouts/MainLayout.vue`。

## 4. 列表页统一体验

已覆盖项目、需求、计划、用例、缺陷、执行六类主列表：

- 基础筛选保留最常用 2–4 项，其余进入可折叠「高级筛选」；
- 高级筛选展开状态按页面记忆；
- 表格 / 卡片视图切换；
- 筛选条件自动记忆（`benchflow.listview.<module>.filters`）；
- 可将当前条件保存为命名方案（最多 8 个/页），支持应用与删除；
- 表格支持多选与批量导出；项目支持批量归档，执行支持批量删除，缺陷支持批量分派，用例支持批量停用；
- 项目与执行提供右侧「速览」抽屉，不离开列表即可看进度、风险、测量值；
- 空状态、加载骨架、状态色统一使用设计令牌。

实现：`src/composables/useListView.ts`、`src/components/common/ListViewControls.vue`、`src/components/common/EntityCard.vue`。

## 5. 移动端

### 5.1 布局与导航

- 所有移动页面都在 `MobileLayout` 内，底部 5 个 Tab：工作台、任务、记录（主按钮）、消息、项目。
- 新增 5 个移动详情页，均保留底部导航：
  - `#/mobile/projects/:id`
  - `#/mobile/executions/:id`
  - `#/mobile/defects/:id`
  - `#/mobile/tasks/:id`
  - `#/mobile/reports/:id`
- 详情路由激活对应 Tab：执行/缺陷/报告/任务 → 任务；项目详情 → 项目。
- 旧 PC 通知链接通过 `src/utils/mobileLink.ts` 转换为移动路由，不再把用户甩回 PC 布局。
- 触控目标 ≥ 44px，底部安全区 `env(safe-area-inset-bottom)`。
- 修正首页统计口径：今日执行只统计 `testerId === 当前用户`，最近记录不再误用 `db.projects[0]`。

### 5.2 首页

- 继续上次测试（草稿或扫码上下文）；
- 扫码、创建记录、我的任务、提交异常四个快捷入口；
- 今日执行/待办/待处理异常；
- 今日任务、待执行计划、待审核事项、待处理异常、最近测试记录、最近项目；
- 角色数据范围与 PC 一致。

### 5.3 扫码

`src/utils/scanContext.ts` 支持：

- `benchflow://project/P-2401`、`benchflow://device/DEV-001` 等协议；
- `https://.../#/projects/P-2401`、`#/mobile/executions/RUN-0017`；
- 纯编号（PRD-/RUN-/TP-/DEV-/TC-/RPT-/P-）；
- JSON `{ "type": "device", "id": "DEV-001" }`。

扫码后按类型展示不同面板：

- 项目：概况、当前计划、开始测试；
- 产品：版本、关联项目、创建记录；
- 设备：校准状态、最近使用、关联项目、用该设备测试；
- 计划：用例数、版本、开始测试；
- 执行：结果、版本、再测一次 / 查看详情。

演示环境明确标注无摄像头调用，可模拟或手动输入；真实小程序后续使用 `wx.scanCode`。

### 5.4 三步测试记录

1. 选择测试对象：项目、产品、硬件/固件版本、计划、用例、设备、工况；扫码/项目/计划进入时自动带入。
2. 测量与记录：环境参数、参数步骤实时判定、人工步骤 PASS/FAIL/BLOCKED/SKIPPED、照片、真实录音、备注。
3. 检查与提交：汇总、未完成项、当前判定、确认勾选、自动建缺陷、BLOCKED/SKIPPED 人工标记。

- 草稿写入 `benchflow.draft.mobile-record:<userId>`，500ms 防抖，退出后恢复；
- 照片与语音使用 IndexedDB（`benchflow.attachments`），上限 2MB，展示缩略图/文件名/大小并支持删除；
- 录音仅在 `MediaRecorder` + `getUserMedia` 可用时启用，否则明确提示不可用，不使用假计时器；
- 提交走 `executionService`，由统一的 `evaluateExecution` 决定 PASS/FAIL/PENDING/BLOCKED/SKIPPED。

## 6. 判定规则（唯一实现）

`src/utils/measurement.ts`：

1. 人工强制 BLOCKED / SKIPPED 优先保留；
2. 任一必填测量超限或人工 FAIL → FAIL；
3. 存在必填测量缺失或人工步骤未判定 → PENDING；
4. 人工 BLOCKED → BLOCKED；
5. 无 PASS 且人工 SKIPPED → SKIPPED；
6. 所有必填测量通过 + 人工步骤完成 → PASS。

`executionService.finish()` 在 PENDING 时拒绝提交，并列出缺失参数与未判定步骤。PC 执行详情、移动记录、工位模式共用该函数与统计口径。

## 7. 平板工位模式

- 独立全屏布局，移除重复头栏；
- 横屏优先，1024×768 / 1280×800 / 1920×1080 下步骤区占主列；
- 左侧步骤、右侧设备/校准/环境/附件/实时判定；
- 大号测量输入、触控按钮、`Ctrl+Enter` 提交；
- RUN 编号常驻，草稿可中断恢复；
- CSV 测量导入（param,unit,value），支持附件；
- 明确标注「仪器连接：未接入（人工录入演示）」，CSV 导入后显示「未接入 · CSV 数据已导入」，不会伪装成真实仪器连接。

## 8. 数据与适配层

- 继续使用 LocalStorage `benchflow.db.v2`，唯一写入口 `mutate()`；
- 新增 `src/services/runtime.ts`：`localAdapter`、`remoteAdapter`（未配置时明确报 `REMOTE_NOT_CONFIGURED`）、身份、权限、loading/error 统一入口；
- BroadcastChannel 仅做同浏览器多标签同步，界面与文档均明确「非云端同步」。

## 9. 测试与浏览器验证

- 自动化：7 个测试文件、50 条测试全部通过；
- 新增覆盖：判定纯函数、扫码解析、移动详情路由、旧链接转换、草稿恢复、附件校验、全局搜索、角色相关路由；
- 浏览器矩阵（headless Chrome，本地 preview）：
  - PC 1366×768、1440×900、1920×1080；
  - 手机 375×812、390×844、430×932（通过 CDP `Emulation.setDeviceMetricsOverride` 设置真实视口，非窗口裁切）；
  - 平板 1024×768、1280×800；
- 截图目录：`docs/screenshots/ux-2.1/`（PC 1366/1440/1920、项目列表、手机 375/390/430、移动首页/记录/项目/执行/缺陷/扫码、工位 1024 选择态与执行态、工位 1280）。

## 10. 已知问题

1. 本地演示数据只在同一浏览器共享；换设备/换浏览器不同步。真正多端协同需要后端与鉴权。
2. 附件二进制存在 IndexedDB，执行记录只保存元数据；清理浏览器数据会丢失附件。
3. 仅支持单设备选择；一条执行绑定多设备的数据结构已保留，移动端暂未做多选。
4. 工位模式未接入真实仪器协议（SCPI/Modbus），CSV 导入与人工录入是当前唯一数据源。
5. 语音格式依赖浏览器 `MediaRecorder`，Safari/iOS 可能产出 mp4，附件类型统一记为 audio。
6. 打印/PDF 导出仍沿用浏览器打印；小程序端需要单独的分享卡片与 PDF 服务。
7. 列表卡片视图不参与批量选择（批量操作在表格视图完成）。

## 11. 后续：后端与微信小程序

### 后端

- REST/GraphQL：projects、requirements、plans、cases、executions、defects、reports、devices、datasets、attachments；
- 鉴权：OIDC / 企业微信 / 手机号验证码；角色与项目成员双重校验；
- 附件对象存储 + 预签名上传；执行记录只存 object key；
- 实时协作：WebSocket 或 SSE 推送执行/缺陷变更；
- 审计与幂等：所有写操作带 requestId、revision，冲突返回 409；
- 扫码短链服务：`/s/:token` 解析为 `{type,id}`，支持过期与权限校验。

### 微信小程序

- `wx.scanCode` 获取二维码内容后复用 `parseScanPayload`；
- 复用同一套 service 契约与判定函数；
- 相机、录音使用小程序 API，附件上传对象存储；
- 订阅消息：待办到期、缺陷分派、报告审核；
- 离线草稿存入 `wx.setStorage`，联网后同步；
- 不复制 PC 页面，只保留工作台、任务、记录、消息、项目与 5 个详情页。

## 12. 主要变更文件

新增：

- `src/utils/measurement.ts`、`scanContext.ts`、`draftStore.ts`、`attachmentStore.ts`、`recents.ts`、`testContext.ts`、`search.ts`、`mobileLink.ts`
- `src/services/runtime.ts`
- `src/composables/useListView.ts`
- `src/components/layout/CommandPalette.vue`
- `src/components/common/ListViewControls.vue`、`EntityCard.vue`
- `src/views/mobile/MobileProjectDetail.vue`、`MobileExecutionDetail.vue`、`MobileDefectDetail.vue`、`MobileTaskDetail.vue`、`MobileReportDetail.vue`
- `tests/ux21.spec.ts`

重写/修改：

- `src/router/nav.ts`、`routes.ts`
- `src/layouts/MainLayout.vue`、`MobileLayout.vue`、`StationLayout.vue`
- `src/views/dashboard/DashboardView.vue`
- `src/views/mobile/MobileHome.vue`、`MobileTasks.vue`、`MobileScan.vue`、`MobileRecord.vue`、`MobileMessages.vue`、`MobileProjects.vue`
- `src/views/station/StationView.vue`
- `src/views/projects/ProjectListView.vue`、`requirements/RequirementListView.vue`、`test-plans/TestPlanListView.vue`、`test-cases/TestCaseListView.vue`、`defects/DefectListView.vue`、`test-executions/ExecutionListView.vue`、`ExecutionDetailView.vue`
- `src/services/executionService.ts`
- `src/types/index.ts`（FileKind 增加 audio）
- `src/utils/format.ts`（audio 附件标签）
- `README.md`、`docs/TEST_REPORT.md`
