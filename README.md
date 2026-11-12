# BenchFlow 2.0

**Hardware R&D Test Management & Collaboration Platform**
硬件研发测试管理与多端协作平台 · 企业级 SaaS 前端 MVP

> BenchFlow 为暂定项目代号，仅用于内部产品讨论，未声明商标、域名或已完成任何认证。

**在线演示：** <https://11sj817.github.io/benchflow/> · 仓库：<https://github.com/11sj817/benchflow>

BenchFlow 把「项目 → 产品版本 → 需求 → 测试计划 → 测试用例 → 测试执行 → 测量数据 → 缺陷闭环 → 报告交付」放在同一条可追溯链路上，面向电子硬件、电力电子、嵌入式团队、高校实验室、中小研发企业以及外部供应商 / 客户。

当前仓库是**可运行、可操作、可部署**的前端产品，不是静态设计稿；但仍然是**无后端的本地演示模式**，不提供真实云端多人协同。

---

## 1. 在线演示与本地运行

```bash
# Node.js 20+
npm install
npm run dev        # http://127.0.0.1:5178
```

构建与预览：

```bash
npm run build      # vue-tsc --noEmit && vite build → dist/
npm run preview
```

质量门禁：

```bash
npm run typecheck  # vue-tsc --noEmit
npm run lint       # eslint .
npm run test       # vitest run（35 个用例）
```

GitHub Pages 部署见 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)，工作流已配置在 `.github/workflows/deploy.yml`。

---

## 2. 功能模块（18 个）

| 分组 | 模块 | 关键能力 |
| --- | --- | --- |
| 工作空间 | 总览 | 时间筛选、执行/通过率/缺陷指标、质量趋势、项目执行情况、关注项、待办、待审核报告、最近活动、严重程度分布 |
| 工作空间 | 项目管理 | 搜索/状态/负责人/标签筛选、排序、分页、创建/编辑/归档/受控删除；项目详情 9 个 Tabs（概览/需求/产品版本/计划/执行/缺陷/文件/团队/活动） |
| 工作空间 | 需求管理 | 需求追踪矩阵、覆盖率统计、需求 ↔ 用例 ↔ 执行 ↔ 缺陷追踪抽屉、需求拆分、编辑/删除、CSV 导出 |
| 工作空间 | 测试计划 | 计划绑定项目/产品/硬件版本/固件版本/需求/用例/人员/设备；状态流转；计划详情含用例执行矩阵与执行创建 |
| 工作空间 | 测试执行 | 筛选/排序/分页/日期范围、RUN 编号、执行详情：步骤、测量值实时 PASS/FAIL、环境参数、附件、曲线、缺陷、历史、CSV 导入 |
| 工作空间 | 缺陷管理 | 新建/分派/处理/修复/验证/关闭/重开全流程，服务层强校验（无根因不能提交修复、无 PASS 回归不能验证、无验证不能关闭）、评论 @ 提及、回归计划 |
| 研发资产 | 产品与版本 | 产品 CRUD；硬件/固件/软件/测试基线版本；变更记录、附件、发布状态；V1.1 → V1.2 版本对比（物料/参数/测试/缺陷差异）与对比报告 |
| 研发资产 | 测试用例库 | 多分类、搜索/筛选/排序/分页、CSV 批量导入与导出、复制、停用、受控删除；完整用例编辑器（基础信息/条件/多步骤/测量参数阈值/版本历史/发布） |
| 研发资产 | 设备资产 | 7 类设备、校准到期提醒、使用记录、维修记录、设备二维码、使用次数统计 |
| 研发资产 | 数据集管理 | 上传与 2MB 限制、CSV 预览与曲线、文件分类、关联执行/用例、版本、下载/删除、存储用量提示 |
| 研发资产 | 模板中心 | 10 个预置参考模板（Buck/Boost/DC-DC/PFC/LLC/三相整流/嵌入式/通用/高低温/可靠性）、查看/复制/自定义/导入导出/一键建用例 |
| 分析与交付 | 质量分析 | 趋势、版本对比、缺陷分布、关闭周期、人员工作量、产品通过率、直方图、箱线图、Cpk 适用性判断 |
| 分析与交付 | 报告中心 | 6 类报告、由真实演示数据生成、审核（作者不可自审）、发布、打印/PDF、CSV 导出、只读分享 |
| 分析与交付 | 外部协作 | 创建只读分享、指定项目与报告、有效期、撤销、访问计数、`#/share/:token` 只读页面 |
| 组织管理 | 团队与权限 | 7 种角色、权限矩阵、邀请、角色切换、停用、项目成员分配、数据可见性演示 |
| 组织管理 | 集成中心 | GitHub/GitLab/企业微信/Webhook/REST API/CSV·Excel/Python SDK/SCPI·VISA 的接入说明与路线图 |
| 组织管理 | 审计日志 | 关键操作留痕、操作人/类型/对象/摘要筛选、日期范围、CSV 导出 |
| 组织管理 | 系统设置 | 组织资料、个人资料、通知偏好、项目默认、数据管理（导出/重载/恢复演示数据）、紧凑密度、系统信息 |

### 多端

- **PC Web**：完整研发管理（左侧 236px 导航 + 56px 工具栏 + 专业表格 + 详情分栏 + 抽屉）。
- **移动端**：`#/mobile` 独立路由与布局，工作台、我的任务、创建测试记录（测量值/拍照入口/语音模拟）、扫码模拟、异常上报、消息中心、我的项目。
- **平板工位模式**：`#/station` 大尺寸触控录入、步骤与阈值、设备校准状态、环境参数、本计划执行记录。
- PC 顶部提供「终端预览」入口，可新窗口打开移动端 / 工位模式。

---

## 3. 技术栈

- Vue 3.5 + TypeScript（strict）+ Vite 6
- Vue Router 4（**hash 路由**，GitHub Pages 刷新不 404）
- Pinia
- Element Plus（中文 locale）
- Apache ECharts（按需注册 Line/Bar/Pie/Boxplot/Scatter）
- Day.js、Lucide Vue Next、qrcode
- Vitest（纯逻辑与服务层测试）
- ESLint 9 flat config + typescript-eslint + eslint-plugin-vue

没有为了复杂度引入无用途依赖；没有使用随机数据生成图表。

---

## 4. 目录结构

```text
src/
  assets/            静态资源（本项目以 CSS 设计变量为主）
  components/
    common/          PageHeader / KpiCard / StatusPill / SectionPanel / DataPager / EmptyState / UserAvatar
    charts/          BaseChart（ECharts 封装，自动 resize + dispose）
    dialogs/         IdentityDialog / SyncInfoDialog
    forms/ tables/   由 Element Plus 组合，页面内复用统一模式
  composables/       useTable（筛选后排序 + 分页）
  layouts/           MainLayout / AuthLayout / MobileLayout / StationLayout
  mock/              seedCore / seedRuns / seedDefects / seedAssets / seed（组装）
  router/            routes.ts（可测试路由表）+ index.ts（hash history + 守卫）
  services/          db.ts（持久化）+ 12 个业务 service + analyticsService
  stores/            app（会话/角色/可见项目）、workspace（修订号/跨标签页同步）
  styles/            tokens.css（设计变量）+ global.css
  types/             统一业务数据模型
  utils/             csv / stats / permission / format / id
  views/             18 个模块 + 移动端 / 工位 / 分享 / 登录 / 404
docs/                产品、架构、数据模型、API、设计系统、测试、部署
tests/               数据完整性 / 持久化 / 缺陷闭环 / CSV / 统计 / 路由权限 / 交付物
```

---

## 5. 数据与演示模式

- **LocalStorage 持久化**：键 `benchflow.db.v2`，刷新页面不丢数据。
- **BroadcastChannel + storage 事件**：同一浏览器多标签页同步本地数据；界面明确标注「本地演示模式」，不宣称云端同步。
- **审计日志**：所有写操作经 `mutate()`，自动追加审计；恢复演示数据也记录。
- **恢复演示数据**：顶部用户菜单 / 系统设置 / 数据同步弹窗，二次确认后覆盖。
- **演示组织**：BenchFlow Demo Lab；成员陈工、张工、李工、王工、刘工、客户访客。
- **演示闭环**：`RUN-0017` 纹波 65mV 失败 → `BUG-0021` → PCB V1.2 / FW V0.8 整改 → `RUN-0019/0025/0028` 回归 PASS → 缺陷关闭；`BUG-0020` 回归通过待关闭；`BUG-0022` 处理中；`BUG-0023` 新建。
- **容量边界**：单文件 ≤ 2MB，仅 CSV 保存预览（前 30 行）；大型示波器波形、照片原件需对象存储。

### 明确的能力边界

| 已实现 | 未实现 / 待接入后端 |
| --- | --- |
| 全部页面与业务闭环、表单校验、CSV 导入导出、打印、图表联动、角色可见性、本地持久化、多标签页同步 | 真实账号认证、服务端授权、多人实时协同、文件对象存储、微信小程序原生包、SCPI/VISA 自动采集、第三方 OAuth |

前端角色模拟**不是**生产级安全认证，真实授权必须由后端逐请求校验。

---

## 6. GitHub Pages 部署（已上线）

- **在线演示**：<https://11sj817.github.io/benchflow/>
- **GitHub 仓库**：<https://github.com/11sj817/benchflow>
- **Actions**：<https://github.com/11sj817/benchflow/actions>

推送 `main` 后，`.github/workflows/deploy.yml` 自动执行 typecheck → lint → test → build → 上传 → 部署。
Pages 的 Source 已设置为 **GitHub Actions**；Vite `base: './'` + hash 路由，资源与刷新在子路径下均可用。

```bash
git remote add origin https://github.com/11sj817/benchflow.git
git push -u origin main
```

最近一次部署验证：commit `dee59ef`，工作流成功，线上页面 HTTP 200，无头浏览器实拍确认工作台、图表与演示数据正常渲染。
详细说明与故障排查见 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)。

---

## 7. 文档索引

- [产品需求文档](docs/PRODUCT_REQUIREMENTS.md)
- [技术架构](docs/ARCHITECTURE.md)
- [数据模型](docs/DATA_MODEL.md)
- [API 设计草案](docs/API_DESIGN.md)
- [UI 设计系统](docs/UI_DESIGN_SYSTEM.md)
- [测试报告](docs/TEST_REPORT.md)
- [部署说明](docs/DEPLOYMENT.md)
- [下一阶段计划 NEXT_STEPS](NEXT_STEPS.md)

---

## 8. 已知限制

- 无后端，所有数据在本浏览器；跨设备 / 跨浏览器不共享。
- 报告 PDF 依赖浏览器打印，不生成服务端 PDF。
- Excel 导出使用 `.xls` 的 HTML 表格实现，复杂样式与多 Sheet 不支持。
- 移动端是响应式 Web，不是已发布的微信小程序原生包；相机与录音为浏览器能力 / 模拟。
- 质量分析中的 Cpk 仅在样本量 ≥ 25、存在变异且规格完整时给出结论，并明确正态性与过程受控假设。
- 预置测试模板仅为参考起点，不代表任何认证或标准符合性。
