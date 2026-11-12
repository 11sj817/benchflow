# BenchFlow 数据模型

版本：schema 2
代码定义：`src/types/index.ts`（前端唯一类型来源）

---

## 1. 实体总览

| 实体 | 关键字段 | 说明 |
| --- | --- | --- |
| Member | id, name, title, role, email, color, status, joinedAt | 组织成员与演示角色 |
| Project | code, name, type, ownerId, memberIds, start/plannedEnd/actualEnd, status, priority, productIds, tags | 项目主数据 |
| Requirement | code, projectId, parentId?, name, acceptance, source, status, caseIds, defectIds | 需求与追踪 |
| Product | code, name, type, projectId, ownerId | 产品 |
| ProductVersion | productId, kind, version, label, changeItems[], status, releasedAt, attachmentNames | 硬件/固件/软件/基线版本 |
| VersionChange | item, from, to, category(material/parameter/firmware/structure), note? | 版本变更项 |
| TestCase | code, category, purpose, precondition, environment, steps[], priority, productIds, status, version, revisions[] | 用例与版本历史 |
| TestStep | name, action, expected, param? | 步骤；param 为测量参数 |
| MeasureParam | name, unit, min?, max?, target?, required | 阈值配置（判定依据） |
| TestPlan | code, projectId, productId, hardwareVersionId, firmwareVersionId?, requirementIds, caseIds, assigneeIds, deviceIds, acceptance, status | 计划 |
| Execution | code(RUN), planId, projectId, productId, hardwareVersionId, firmwareVersionId?, caseId, testerId, deviceIds, environment, conditions, measurements[], stepResults[], result, startedAt, finishedAt?, attachments[], defectIds | 执行记录 |
| Measurement | param, unit, value, min?, max?, result? | 实测值与判定 |
| Defect | code(BUG), title, severity, priority, status, ownerId, reporterId, executionId?, caseId?, steps, evidence[], rootCause, fixPlan, fixVersionId?, regressionExecutionIds[], comments[], timeline[], verification?, closedAt? | 缺陷闭环 |
| Device | code, category, model, serial, vendor, station, ownerId, calibrationDate/Due, status, usage[], repairs[] | 设备资产 |
| Dataset | code, name, kind, category, sizeBytes, projectId, executionId?, caseIds, version, uploadedBy, previewHeaders/Rows | 数据集 |
| Report | code, title, type, projectId, planId?/executionId?/versionIds?, status, authorId, reviewerId?, sections[], metrics[] | 报告 |
| Template | code, name, category, description, disclaimer, params[], steps[], builtin | 测试模板 |
| ShareLink | token, projectId, reportIds, expiresAt, status, accessCount | 只读分享 |
| AuditLog | at, actorId, actorName, action, entity, entityId, entityLabel, summary, projectId? | 审计 |
| Notification / Todo / Integration | 通知、待办、集成 | 组织协作 |

---

## 2. 关系图

```text
Project 1 ── N Requirement ── N:M ── TestCase
Project 1 ── N Product 1 ── N ProductVersion
ProductVersion 1 ── N TestPlan（hardwareVersionId / firmwareVersionId）
TestPlan 1 ── N Execution ── N Measurement
Execution 0..1 ── N Defect（executionId）
TestCase 1 ── N Defect（caseId）
Defect 1 ── 0..1 Verification（executionId → Execution）
Project 1 ── N Device / Dataset / Report / ShareLink
Member N:M Project（memberIds）
```

---

## 3. 关键约束

1. **执行必绑版本**：`Execution.projectId / productId / hardwareVersionId` 非空；固件版本可选。
2. **阈值来自用例**：`Measurement.min/max` 在创建执行时从 `TestStep.param` 复制，之后不随用例变更影响历史记录。
3. **缺陷验证**：`Defect.verification.executionId` 指向的执行必须 `caseId === Defect.caseId` 且 `result === 'PASS'`。
4. **关闭条件**：`status === 'closed'` 必须存在 `verification` 与 `closedAt`。
5. **受引用对象禁止删除**：项目（有需求/计划/执行/缺陷/数据集/报告）、计划（有执行）、用例（被计划引用）、版本（被计划/执行/缺陷引用）、设备（被计划/执行引用）、执行（关联缺陷）均只允许归档/停用/废弃。
6. **访客可见性**：只可见 `ShareLink.status === 'active'` 且未过期的项目与指定报告。
7. **审计只追加**：删除操作本身也记录审计。

---

## 4. 枚举

| 枚举 | 值 |
| --- | --- |
| RoleKey | super_admin, org_admin, project_owner, test_lead, test_engineer, dev_engineer, guest |
| Priority | P0, P1, P2, P3 |
| ProjectStatus | planning, active, paused, completed, archived |
| RequirementStatus | draft, reviewing, approved, implemented, verified, rejected |
| VersionKind | hardware, firmware, software, baseline |
| VersionStatus | draft, released, deprecated |
| TestCategory | functional, performance, electrical, environment, reliability, security, compatibility, regression |
| CaseStatus | draft, published, deprecated |
| PlanStatus | draft, pending, running, review, completed, cancelled |
| RunResult | PASS, FAIL, BLOCKED, SKIPPED, PENDING |
| DefectStatus | new, assigned, in_progress, resolved, verified, closed, reopened |
| Severity | blocker, critical, major, minor, trivial |
| DeviceCategory | oscilloscope, multimeter, dc_power, electronic_load, power_analyzer, signal_generator, thermal, other |
| ReportType | plan, execution, product, version_compare, defect, acceptance |
| ReportStatus | draft, review, approved, rejected, published |

---

## 5. 演示数据关系（可验证）

- `RUN-0017`：`caseId=TC-1002`，`hardwareVersionId=VER-1002`，满载纹波 `65mV`，`result=FAIL`。
- `BUG-0021`：`executionId=RUN-0017`，`fixVersionId=VER-1003`，`status=closed`，`verification.executionId=RUN-0019`。
- `RUN-0019/0025/0028`：`hardwareVersionId=VER-1003`，TC-1002，全部 PASS。
- `BUG-0020`：`executionId=RUN-0004`，回归 `RUN-0022` PASS，状态 `verified`（待关闭）。
- `BUG-0022`：`executionId=RUN-0020`（TC-3001 FAIL），状态 `in_progress`。
- `RPT-2025-001` 关联 `TP-2401-01`；`RPT-2025-002` 关联 `RUN-0017`；`RPT-2025-003` 对比 `VER-1002/1003`。
- `SHARE-001` 分享 `P-2401` 与报告 `RPT-2025-001/003`，有效期 7 天。

对应的自动化断言见 `tests/seed-integrity.spec.ts`。

---

## 6. PostgreSQL 表设计建议

> 主键统一 `uuid`，业务编号（code）唯一索引；时间统一 `timestamptz`。

| 表 | 关键列 / 约束 |
| --- | --- |
| organizations | id, name, code UNIQUE, settings JSONB |
| members | id, org_id, email UNIQUE(org_id,email), role, status |
| projects | id, org_id, code UNIQUE, status, priority, owner_id, planned_end |
| project_members | project_id, member_id, PK(project_id, member_id) |
| requirements | id, project_id, parent_id, code, status, acceptance |
| requirement_cases | requirement_id, case_id |
| products | id, project_id, code, type |
| product_versions | id, product_id, kind, version, status, released_at; UNIQUE(product_id, kind, version) |
| version_changes | id, version_id, item, from_value, to_value, category |
| test_cases | id, org_id, code, category, status, version, steps JSONB（或拆 test_steps） |
| test_case_revisions | id, case_id, version, summary, created_by, created_at |
| test_plans | id, project_id, product_id, hw_version_id, fw_version_id, status |
| plan_cases / plan_assignees / plan_devices | 关联表 |
| executions | id, code UNIQUE, plan_id, case_id, hw_version_id, fw_version_id, tester_id, result, started_at, finished_at, environment JSONB |
| measurements | id, execution_id, param, unit, value NUMERIC, min/max, result |
| attachments | id, owner_type, owner_id, filename, size, sha256, storage_key |
| defects | id, code UNIQUE, project_id, product_id, hw_version_id, execution_id, case_id, status, severity, root_cause, fix_plan, fix_version_id, closed_at |
| defect_comments / defect_timeline | 缺陷讨论与流转 |
| defect_verifications | defect_id, execution_id, verified_by, note, created_at |
| devices | id, code, calibration_due, status |
| device_usage / device_repairs | 使用与维修 |
| datasets | id, project_id, execution_id, storage_key, size, sha256, version |
| reports | id, code, type, status, author_id, reviewer_id, payload JSONB |
| report_reviews | report_id, reviewer_id, decision, note |
| share_links | id, token UNIQUE, project_id, expires_at, revoked_at, access_count |
| audit_logs | id, at, actor_id, action, entity, entity_id, summary, project_id; 仅 INSERT |
| notifications | id, user_id, read_at, link |
| templates | id, org_id, category, payload JSONB, builtin |

### 索引建议

- `executions(project_id, started_at desc)`、`executions(case_id, started_at desc)`
- `defects(project_id, status)`、`defects(execution_id)`
- `measurements(execution_id)`、`measurements(param)`
- `audit_logs(project_id, at desc)`
- `share_links(token)` 唯一
- 报告全文检索可后续引入 `tsvector`。

---

## 7. 迁移策略

1. 先落 `organizations / members / projects / products / versions / cases / plans / executions / measurements / defects` 主链路。
2. 前端保持 service 方法签名，内部从 LocalStorage 切换到 REST。
3. 将 `db` 种子作为后端 seed 脚本的数据来源（字段一一对应）。
4. `schema` 版本升级时，本地演示数据自动重置；后端用迁移脚本。
