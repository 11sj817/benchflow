import type { Report, ReportStatus, ReportType, ShareLink } from '@/types'
import { db, mutate } from './db'
import { getActor } from './actor'
import { nextReportCode } from '@/utils/id'
import { defectService } from './defectService'
import { projectService } from './projectService'
import { productService } from './productService'

const nowIso = () => new Date().toISOString()
const pct = (part: number, total: number) => (total === 0 ? 0 : Math.round((part / total) * 1000) / 10)

export interface ReportInput {
  title: string
  type: ReportType
  projectId: string
  productId?: string
  planId?: string
  executionId?: string
  versionIds?: string[]
  summary: string
  sections: { title: string; body: string }[]
  metrics: { label: string; value: string }[]
}

function runsOfPlan(planId: string) {
  return db.executions.filter((e) => e.planId === planId)
}

export const reportService = {
  list(): Report[] {
    return db.reports
  },

  get(id: string): Report | undefined {
    return db.reports.find((r) => r.id === id)
  },

  create(input: ReportInput): Report {
    const actor = getActor()
    const report: Report = {
      id: nextReportCode(db.reports.map((r) => r.code)),
      code: nextReportCode(db.reports.map((r) => r.code)),
      ...input,
      status: 'draft',
      authorId: actor.id,
      createdAt: nowIso(),
    }
    mutate(
      (draft) => {
        draft.reports.unshift(report)
      },
      {
        actorId: actor.id,
        actorName: actor.name,
        action: 'create',
        entity: 'report',
        entityId: report.id,
        entityLabel: report.title,
        summary: `创建报告 ${report.code}`,
        projectId: input.projectId,
      },
    )
    return report
  },

  /** 由测试计划数据生成报告草稿（非空白模板）。 */
  generateFromPlan(planId: string): Report {
    const plan = db.plans.find((p) => p.id === planId)
    if (!plan) throw new Error('计划不存在')
    const runs = runsOfPlan(planId)
    const finished = runs.filter((r) => r.result !== 'PENDING')
    const pass = finished.filter((r) => r.result === 'PASS').length
    const fail = finished.filter((r) => r.result === 'FAIL').length
    const skipped = finished.filter((r) => r.result === 'SKIPPED' || r.result === 'BLOCKED').length
    const defects = db.defects.filter((d) => runs.some((r) => r.id === d.executionId))
    const product = db.products.find((p) => p.id === plan.productId)
    const hardware = db.versions.find((v) => v.id === plan.hardwareVersionId)
    const firmware = db.versions.find((v) => v.id === plan.firmwareVersionId)
    return reportService.create({
      title: `${plan.name} 测试报告`,
      type: 'plan',
      projectId: plan.projectId,
      productId: plan.productId,
      planId,
      summary: `${plan.code} 共 ${runs.length} 次执行，完成 ${finished.length} 次；PASS ${pass} 次、FAIL ${fail} 次、BLOCKED/SKIPPED ${skipped} 次，执行通过率 ${pct(pass, finished.length)}%。`,
      sections: [
        {
          title: '1. 测试范围与对象',
          body: `计划 ${plan.code}（${plan.name}），产品 ${product?.name ?? plan.productId}，硬件 ${hardware?.version ?? '—'}${firmware ? `，固件 ${firmware.version}` : ''}。覆盖用例 ${plan.caseIds.length} 条。`,
        },
        {
          title: '2. 执行结果',
          body: `有效执行 ${finished.length} 次：PASS ${pass} 次、FAIL ${fail} 次、BLOCKED/SKIPPED ${skipped} 次。执行通过率 ${pct(pass, finished.length)}%。`,
        },
        {
          title: '3. 缺陷与偏差',
          body:
            defects.length > 0
              ? `关联缺陷：${defects.map((d) => `${d.code}（${d.title}，${d.status}）`).join('；')}。`
              : '本计划未产生关联缺陷。',
        },
        {
          title: '4. 结论',
          body:
            fail === 0 && finished.length > 0
              ? '全部已执行用例通过，建议按流程进入下一阶段或提交验收。'
              : fail > 0
                ? '存在未通过用例，需完成缺陷整改与回归后再行判定。'
                : '尚无完成的有效执行，暂不具备结论条件。',
        },
      ],
      metrics: [
        { label: '执行次数', value: `${runs.length} 次` },
        { label: 'PASS / FAIL', value: `${pass} / ${fail}` },
        { label: '执行通过率', value: `${pct(pass, finished.length)}%` },
        { label: '关联缺陷', value: `${defects.length} 个` },
      ],
    })
  },

  generateFromExecution(executionId: string): Report {
    const run = db.executions.find((e) => e.id === executionId)
    if (!run) throw new Error('执行记录不存在')
    const testCase = db.cases.find((c) => c.id === run.caseId)
    const plan = db.plans.find((p) => p.id === run.planId)
    const product = db.products.find((p) => p.id === run.productId)
    const hardware = db.versions.find((v) => v.id === run.hardwareVersionId)
    const firmware = db.versions.find((v) => v.id === run.firmwareVersionId)
    const fails = run.measurements.filter((m) => m.result === 'FAIL')
    return reportService.create({
      title: `${run.code} ${testCase?.name ?? ''} 测试报告`,
      type: 'execution',
      projectId: run.projectId,
      productId: run.productId,
      executionId,
      summary: `${run.code} 执行结果 ${run.result}。产品 ${product?.name ?? ''} / ${hardware?.version ?? ''}${firmware ? ` / ${firmware.version}` : ''}，测试人员 ${run.testerId}。`,
      sections: [
        {
          title: '1. 测试条件',
          body: `${run.conditions}；环境 ${run.environment.temperature ?? '—'}℃ / ${run.environment.humidity ?? '—'}%RH；输入 ${run.environment.inputVoltage ?? '—'}V；负载 ${run.environment.load ?? '—'}A。${run.environment.note}`,
        },
        {
          title: '2. 测量数据',
          body:
            run.measurements
              .map(
                (m) => `${m.param}：${m.value ?? '未录入'}${m.unit}（限值 ${m.min ?? '—'}~${m.max ?? '—'}${m.unit}，${m.result ?? 'PENDING'}）`,
              )
              .join('\n') || '本用例无自动测量参数。',
        },
        {
          title: '3. 超限项',
          body: fails.length ? fails.map((m) => `${m.param} ${m.value}${m.unit} 超出 ${m.min ?? '—'}~${m.max ?? '—'}`).join('；') : '无超限测量项。',
        },
        {
          title: '4. 结论',
          body: `执行结果判定为 ${run.result}。${plan ? `所属计划 ${plan.code}。` : ''}${run.defectIds.length ? `关联缺陷 ${run.defectIds.join('、')}。` : ''}`,
        },
      ],
      metrics: [
        { label: '执行编号', value: run.code },
        { label: '结果', value: run.result },
        { label: '测量项', value: `${run.measurements.length} 项` },
        { label: '附件', value: `${run.attachments.length} 个` },
      ],
    })
  },

  generateFromProduct(productId: string): Report {
    const product = db.products.find((p) => p.id === productId)
    if (!product) throw new Error('产品不存在')
    const versions = db.versions.filter((v) => v.productId === productId)
    const runs = db.executions.filter((e) => e.productId === productId)
    const finished = runs.filter((r) => r.result !== 'PENDING')
    const pass = finished.filter((r) => r.result === 'PASS').length
    const stats = projectService.stats(product.projectId)
    return reportService.create({
      title: `${product.name} 产品验证报告`,
      type: 'product',
      projectId: product.projectId,
      productId,
      summary: `${product.name} 共 ${versions.length} 个版本、${runs.length} 次执行，执行通过率 ${pct(pass, finished.length)}%，未关闭缺陷 ${db.defects.filter((d) => d.productId === productId && d.status !== 'closed').length} 个。`,
      sections: [
        {
          title: '1. 产品与版本',
          body: versions.map((v) => `${v.label}（${v.status}，${v.releasedAt?.slice(0, 10) ?? '未发布'}）`).join('\n'),
        },
        {
          title: '2. 验证覆盖',
          body: `需求覆盖率 ${pct(stats.coveredRequirements, stats.requirementCount)}%，执行 ${runs.length} 次，通过 ${pass} 次。`,
        },
        {
          title: '3. 质量结论',
          body: `当前执行通过率 ${pct(pass, finished.length)}%。${stats.openDefects > 0 ? `仍有 ${stats.openDefects} 个未关闭缺陷，建议完成闭环后再交付。` : '未关闭缺陷为 0，可进入交付评审。'}`,
        },
      ],
      metrics: [
        { label: '版本数', value: `${versions.length}` },
        { label: '执行次数', value: `${runs.length}` },
        { label: '通过率', value: `${pct(pass, finished.length)}%` },
        { label: '未关闭缺陷', value: `${stats.openDefects}` },
      ],
    })
  },

  generateVersionCompare(leftId: string, rightId: string): Report {
    const compare = productService.compare(leftId, rightId)
    if (!compare) throw new Error('版本不存在')
    const product = db.products.find((p) => p.id === compare.left.productId)
    return reportService.create({
      title: `${compare.left.version} → ${compare.right.version} 版本对比报告`,
      type: 'version_compare',
      projectId: product?.projectId ?? '',
      productId: compare.left.productId,
      versionIds: [leftId, rightId],
      summary: `共 ${compare.rows.filter((r) => r.changed).length} 项差异；测试结果改善 ${compare.summary.improved} 项、回退 ${compare.summary.regressed} 项。`,
      sections: [
        {
          title: '1. 变更项',
          body:
            compare.rows
              .map((r) => `${r.item}：${r.left} → ${r.right}${r.changed ? '' : '（未变更）'}`)
              .join('\n') || '无变更记录。',
        },
        {
          title: '2. 测试结果差异',
          body:
            compare.tests
              .map((t) => `${t.caseId} ${t.caseName}：${t.left} → ${t.right}`)
              .join('\n') || '两个版本暂无可对比的执行记录。',
        },
        {
          title: '3. 结论',
          body: `改善 ${compare.summary.improved} 项、回退 ${compare.summary.regressed} 项。${compare.summary.regressed > 0 ? '存在回退项，需评估是否放行。' : '未发现测试结果回退。'}`,
        },
      ],
      metrics: [
        { label: '变更项', value: `${compare.summary.changedItems}` },
        { label: '改善', value: `${compare.summary.improved}` },
        { label: '回退', value: `${compare.summary.regressed}` },
        { label: '对比用例', value: `${compare.tests.length}` },
      ],
    })
  },

  generateDefectAnalysis(projectId: string): Report {
    const project = db.projects.find((p) => p.id === projectId)
    if (!project) throw new Error('项目不存在')
    const stats = defectService.stats(projectId)
    const rows = db.defects.filter((d) => d.projectId === projectId)
    return reportService.create({
      title: `${project.name} 缺陷分析报告`,
      type: 'defect',
      projectId,
      summary: `项目累计缺陷 ${stats.total} 个，已关闭 ${stats.closed} 个，未关闭 ${stats.open} 个，平均关闭周期 ${stats.avgCloseDays} 天。`,
      sections: [
        {
          title: '1. 缺陷分布',
          body: Object.entries(stats.bySeverity)
            .filter(([, count]) => count > 0)
            .map(([level, count]) => `${level}：${count} 个`)
            .join('；'),
        },
        {
          title: '2. 缺陷清单',
          body: rows.map((d) => `${d.code}｜${d.title}｜${d.status}｜负责人 ${d.ownerId}`).join('\n'),
        },
        {
          title: '3. 改进建议',
          body: `平均关闭周期 ${stats.avgCloseDays} 天。建议在下一阶段提前锁定回归设备与样机排期，减少等待时间。`,
        },
      ],
      metrics: [
        { label: '缺陷总数', value: `${stats.total}` },
        { label: '已关闭', value: `${stats.closed}` },
        { label: '平均周期', value: `${stats.avgCloseDays} 天` },
        { label: '未关闭', value: `${stats.open}` },
      ],
    })
  },

  generateAcceptance(projectId: string): Report {
    const project = db.projects.find((p) => p.id === projectId)
    if (!project) throw new Error('项目不存在')
    const plans = db.plans.filter((p) => p.projectId === projectId)
    const runs = db.executions.filter((e) => e.projectId === projectId)
    const finished = runs.filter((r) => r.result !== 'PENDING')
    const pass = finished.filter((r) => r.result === 'PASS').length
    const openDefects = db.defects.filter((d) => d.projectId === projectId && d.status !== 'closed')
    const stats = projectService.stats(projectId)
    const coverage = (() => {
      const requirements = db.requirements.filter((r) => r.projectId === projectId)
      const covered = requirements.filter((r) => r.caseIds.length > 0).length
      return requirements.length ? Math.round((covered / requirements.length) * 1000) / 10 : 0
    })()
    return reportService.create({
      title: `${project.name} 阶段验收报告`,
      type: 'acceptance',
      projectId,
      summary: `项目 ${project.code} 阶段验收：计划 ${plans.length} 个、执行 ${runs.length} 次、执行通过率 ${pct(pass, finished.length)}%、需求覆盖率 ${coverage}%、未关闭缺陷 ${openDefects.length} 个。`,
      sections: [
        {
          title: '1. 阶段范围',
          body: `${project.description}\n计划周期：${project.startDate} 至 ${project.plannedEndDate}。覆盖测试计划：${plans.map((p) => p.code).join('、') || '无'}。`,
        },
        {
          title: '2. 完成情况',
          body: `累计执行 ${runs.length} 次，其中 PASS ${pass} 次、FAIL ${finished.length - pass} 次；需求覆盖率 ${coverage}%；产品版本 ${db.versions.filter((v) => db.products.some((p) => p.id === v.productId && p.projectId === projectId)).length} 个。`,
        },
        {
          title: '3. 遗留风险',
          body:
            openDefects.length > 0
              ? openDefects.map((d) => `${d.code} ${d.title}（${d.status}，负责人 ${d.ownerId}）`).join('\n')
              : '无未关闭缺陷。',
        },
        {
          title: '4. 验收结论',
          body:
            stats.passRate >= 85 && openDefects.length === 0
              ? '各项指标满足阶段验收条件，建议通过验收并进入下一阶段。'
              : '存在未通过项或未关闭缺陷，建议完成整改与回归后重新提交验收。',
        },
      ],
      metrics: [
        { label: '测试计划', value: `${plans.length} 个` },
        { label: '执行次数', value: `${runs.length} 次` },
        { label: '执行通过率', value: `${pct(pass, finished.length)}%` },
        { label: '未关闭缺陷', value: `${openDefects.length} 个` },
      ],
    })
  },

  update(id: string, patch: Partial<ReportInput>): void {
    const actor = getActor()
    const target = db.reports.find((r) => r.id === id)
    if (!target) return
    mutate(
      (draft) => {
        const row = draft.reports.find((r) => r.id === id)
        if (row) Object.assign(row, patch)
      },
      {
        actorId: actor.id,
        actorName: actor.name,
        action: 'update',
        entity: 'report',
        entityId: id,
        entityLabel: target.title,
        summary: `更新报告 ${target.code}`,
        projectId: target.projectId,
      },
    )
  },

  submit(id: string): void {
    const report = db.reports.find((r) => r.id === id)
    if (!report) return
    reportService.setStatus(id, 'review', '提交审核')
  },

  review(id: string, approved: boolean, note = ''): void {
    const report = db.reports.find((r) => r.id === id)
    if (!report) return
    const actor = getActor()
    if (report.authorId === actor.id) {
      throw new Error('审核人不能是报告作者本人，请切换为其他角色再审核。')
    }
    reportService.setStatus(id, approved ? 'approved' : 'rejected', note || (approved ? '审核通过' : '审核驳回'), actor.id)
  },

  publish(id: string): void {
    const report = db.reports.find((r) => r.id === id)
    if (!report) return
    if (report.status !== 'approved') throw new Error('只有审核通过的报告才能发布。')
    reportService.setStatus(id, 'published', '报告发布')
  },

  setStatus(id: string, status: ReportStatus, note: string, reviewerId?: string): void {
    const actor = getActor()
    const target = db.reports.find((r) => r.id === id)
    if (!target) return
    mutate(
      (draft) => {
        const row = draft.reports.find((r) => r.id === id)
        if (!row) return
        row.status = status
        if (status === 'approved' || status === 'rejected') {
          row.reviewedAt = nowIso()
          row.reviewerId = reviewerId ?? actor.id
        }
      },
      {
        actorId: actor.id,
        actorName: actor.name,
        action: 'review',
        entity: 'report',
        entityId: id,
        entityLabel: target.title,
        summary: `${note}：${target.code}`,
        projectId: target.projectId,
      },
    )
  },

  remove(id: string): void {
    const target = db.reports.find((r) => r.id === id)
    if (!target) return
    const actor = getActor()
    mutate(
      (draft) => {
        draft.reports = draft.reports.filter((r) => r.id !== id)
        draft.shares.forEach((s) => {
          s.reportIds = s.reportIds.filter((rid) => rid !== id)
        })
      },
      {
        actorId: actor.id,
        actorName: actor.name,
        action: 'delete',
        entity: 'report',
        entityId: id,
        entityLabel: target.title,
        summary: `删除报告 ${target.code}`,
        projectId: target.projectId,
      },
    )
  },
}

export const shareService = {
  list(): ShareLink[] {
    return db.shares
  },

  getByToken(token: string): ShareLink | undefined {
    return db.shares.find((s) => s.token === token)
  },

  state(share: ShareLink): 'active' | 'expired' | 'revoked' {
    if (share.status === 'revoked') return 'revoked'
    const today = new Date().toISOString().slice(0, 10)
    return share.expiresAt < today ? 'expired' : 'active'
  },

  create(input: { projectId: string; reportIds: string[]; days: number; note: string }): ShareLink {
    const actor = getActor()
    const share: ShareLink = {
      id: `SHARE-${String(db.shares.length + 1).padStart(3, '0')}`,
      token: `shr_${Math.random().toString(36).slice(2, 10)}`,
      projectId: input.projectId,
      reportIds: input.reportIds,
      expiresAt: new Date(Date.now() + input.days * 86400000).toISOString().slice(0, 10),
      createdAt: nowIso(),
      createdBy: actor.id,
      status: 'active',
      accessCount: 0,
      note: input.note,
    }
    mutate(
      (draft) => {
        draft.shares.unshift(share)
      },
      {
        actorId: actor.id,
        actorName: actor.name,
        action: 'create',
        entity: 'share',
        entityId: share.id,
        entityLabel: input.note || share.token,
        summary: `创建只读分享（${input.days} 天）`,
        projectId: input.projectId,
      },
    )
    return share
  },

  revoke(id: string): void {
    const actor = getActor()
    const target = db.shares.find((s) => s.id === id)
    if (!target) return
    mutate(
      (draft) => {
        const row = draft.shares.find((s) => s.id === id)
        if (row) row.status = 'revoked'
      },
      {
        actorId: actor.id,
        actorName: actor.name,
        action: 'update',
        entity: 'share',
        entityId: id,
        entityLabel: target.token,
        summary: '撤销只读分享链接',
        projectId: target.projectId,
      },
    )
  },

  touch(token: string): void {
    mutate((draft) => {
      const row = draft.shares.find((s) => s.token === token)
      if (row) row.accessCount += 1
    })
  },
}
