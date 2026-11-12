import dayjs from 'dayjs'
import type { RunResult, Severity } from '@/types'
import { db } from './db'
import { getActor } from './actor'
import { projectService } from './projectService'
import { defectService } from './defectService'
import { memberService, notificationService, todoService } from './orgService'
import { cpk, mean, stdDev } from '@/utils/stats'
import type { CpkResult } from '@/utils/stats'

export type RangeKey = 'today' | '7d' | '30d' | 'all' | 'custom'

export interface DateRange {
  key: RangeKey
  from: string
  to: string
  label: string
}

export function presetRange(key: RangeKey, from?: string, to?: string): DateRange {
  const today = dayjs()
  switch (key) {
    case 'today':
      return { key, from: today.format('YYYY-MM-DD'), to: today.format('YYYY-MM-DD'), label: '今日' }
    case '7d':
      return { key, from: today.subtract(6, 'day').format('YYYY-MM-DD'), to: today.format('YYYY-MM-DD'), label: '近 7 天' }
    case '30d':
      return { key, from: today.subtract(29, 'day').format('YYYY-MM-DD'), to: today.format('YYYY-MM-DD'), label: '近 30 天' }
    case 'all':
      return { key, from: '2000-01-01', to: today.add(1, 'day').format('YYYY-MM-DD'), label: '全部' }
    default:
      return {
        key: 'custom',
        from: from ?? today.subtract(6, 'day').format('YYYY-MM-DD'),
        to: to ?? today.format('YYYY-MM-DD'),
        label: `${from ?? ''} ~ ${to ?? ''}`,
      }
  }
}

const inRange = (iso: string, range: DateRange): boolean => {
  const day = iso.slice(0, 10)
  return day >= range.from && day <= range.to
}

const daysOf = (range: DateRange, limit = 30): string[] => {
  const start = dayjs(range.from)
  const end = dayjs(range.to)
  const diff = Math.min(limit, Math.max(1, end.diff(start, 'day') + 1))
  return Array.from({ length: diff }, (_, i) => end.subtract(diff - 1 - i, 'day').format('YYYY-MM-DD'))
}

export const analyticsService = {
  range: presetRange,

  runs(range: DateRange, filters?: { projectId?: string; productId?: string; versionId?: string }) {
    return db.executions.filter((run) => {
      if (!inRange(run.startedAt, range)) return false
      if (filters?.projectId && run.projectId !== filters.projectId) return false
      if (filters?.productId && run.productId !== filters.productId) return false
      if (filters?.versionId && run.hardwareVersionId !== filters.versionId) return false
      return true
    })
  },

  dashboard(range: DateRange) {
    const runs = analyticsService.runs(range)
    const finished = runs.filter((r) => r.result !== 'PENDING')
    const pass = finished.filter((r) => r.result === 'PASS').length
    const fail = finished.filter((r) => r.result === 'FAIL').length
    const openDefects = db.defects.filter((d) => d.status !== 'closed')
    const activeProjects = db.projects.filter((p) => p.status === 'active')
    const days = daysOf(range, 30)
    const trend = days.map((day) => {
      const dayRuns = runs.filter((r) => r.startedAt.slice(0, 10) === day)
      return {
        day,
        pass: dayRuns.filter((r) => r.result === 'PASS').length,
        fail: dayRuns.filter((r) => r.result === 'FAIL').length,
        total: dayRuns.length,
      }
    })

    const projectRows = activeProjects.map((project) => {
      const stats = projectService.stats(project.id)
      return {
        project,
        stats,
        risks: projectService.risks(project.id).filter((r) => r.level !== 'low'),
        owner: memberService.name(project.ownerId),
      }
    })

    const attention: { level: 'high' | 'medium' | 'low'; title: string; detail: string; link: string }[] = []
    db.devices
      .map((device) => ({ device, state: analyticsService.calibrationState(device) }))
      .filter((row) => row.state !== 'valid')
      .forEach(({ device, state }) => {
        attention.push({
          level: state === 'expired' ? 'high' : 'medium',
          title: `${device.code} 校准${state === 'expired' ? '已过期' : '即将到期'}`,
          detail: `${device.name} · ${device.model}，到期 ${device.calibrationDue}`,
          link: '#/devices',
        })
      })
    db.reports
      .filter((r) => r.status === 'review')
      .forEach((report) => {
        attention.push({
          level: 'medium',
          title: `报告待审核：${report.code}`,
          detail: report.title,
          link: `#/reports/${report.id}`,
        })
      })
    db.defects
      .filter((d) => d.status !== 'closed' && (d.severity === 'critical' || d.severity === 'blocker'))
      .forEach((defect) => {
        attention.push({
          level: 'high',
          title: `${defect.code} ${defect.title}`,
          detail: `负责人 ${memberService.name(defect.ownerId)} · 状态 ${defect.status}`,
          link: `#/defects/${defect.id}`,
        })
      })

    return {
      activeProjects: activeProjects.length,
      executions: runs.length,
      passRate: finished.length ? Math.round((pass / finished.length) * 1000) / 10 : 0,
      failRate: finished.length ? Math.round((fail / finished.length) * 1000) / 10 : 0,
      openDefects: openDefects.length,
      criticalDefects: openDefects.filter((d) => d.severity === 'critical' || d.severity === 'blocker').length,
      trend,
      projectRows,
      attention: attention.slice(0, 8),
      todos: todoService.list(getActor().id).slice(0, 6),
      activities: [...db.audits].sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 8),
      pendingReports: db.reports.filter((r) => r.status === 'review'),
      unreadNotifications: notificationService.unread(getActor().id),
      severity: defectService.stats().bySeverity,
    }
  },

  quality(range: DateRange, filters?: { projectId?: string; productId?: string; versionId?: string }) {
    const runs = analyticsService.runs(range, filters)
    const finished = runs.filter((r) => r.result !== 'PENDING')
    const pass = finished.filter((r) => r.result === 'PASS').length
    const days = daysOf(range, 30)
    const trend = days.map((day) => {
      const dayRuns = runs.filter((r) => r.startedAt.slice(0, 10) === day)
      const dayFinished = dayRuns.filter((r) => r.result !== 'PENDING')
      const dayPass = dayFinished.filter((r) => r.result === 'PASS').length
      return {
        day,
        total: dayRuns.length,
        pass: dayPass,
        fail: dayFinished.length - dayPass,
        rate: dayFinished.length ? Math.round((dayPass / dayFinished.length) * 1000) / 10 : 0,
      }
    })

    const versionRows = db.versions
      .filter((v) => (filters?.productId ? v.productId === filters.productId : true))
      .map((version) => {
        const versionRuns = finished.filter((r) => r.hardwareVersionId === version.id)
        const versionPass = versionRuns.filter((r) => r.result === 'PASS').length
        return {
          version,
          total: versionRuns.length,
          pass: versionPass,
          rate: versionRuns.length ? Math.round((versionPass / versionRuns.length) * 1000) / 10 : 0,
        }
      })
      .filter((row) => row.total > 0)

    const defectRows = db.defects.filter(
      (d) =>
        (filters?.projectId ? d.projectId === filters.projectId : true) &&
        (range.key === 'all' || inRange(d.foundAt, range)),
    )
    const severityKeys: Severity[] = ['blocker', 'critical', 'major', 'minor', 'trivial']
    const defectBySeverity = severityKeys.map((level) => ({
      level,
      count: defectRows.filter((d) => d.severity === level).length,
    }))
    const byStatus: Record<string, number> = {}
    defectRows.forEach((d) => {
      byStatus[d.status] = (byStatus[d.status] ?? 0) + 1
    })
    const defectByStatus = Object.entries(byStatus).map(([status, count]) => ({ status, count }))
    const closeCycles = defectRows
      .filter((d) => d.status === 'closed' && d.closedAt)
      .map((d) => ({
        code: d.code,
        title: d.title,
        days: Math.round((new Date(d.closedAt as string).getTime() - new Date(d.createdAt).getTime()) / 86400000),
      }))

    const workload = db.members
      .map((member) => {
        const memberRuns = finished.filter((r) => r.testerId === member.id)
        return {
          member,
          total: memberRuns.length,
          pass: memberRuns.filter((r) => r.result === 'PASS').length,
          fail: memberRuns.filter((r) => r.result === 'FAIL').length,
        }
      })
      .filter((row) => row.total > 0)

    const productRows = db.products
      .map((product) => {
        const productRuns = finished.filter((r) => r.productId === product.id)
        const productPass = productRuns.filter((r) => r.result === 'PASS').length
        return {
          product,
          total: productRuns.length,
          rate: productRuns.length ? Math.round((productPass / productRuns.length) * 1000) / 10 : 0,
        }
      })
      .filter((row) => row.total > 0)

    return {
      runs,
      finished,
      pass,
      fail: finished.length - pass,
      passRate: finished.length ? Math.round((pass / finished.length) * 1000) / 10 : 0,
      trend,
      versionRows,
      defectBySeverity,
      defectByStatus,
      closeCycles,
      workload,
      productRows,
      avgCloseDays: closeCycles.length
        ? Math.round((closeCycles.reduce((s, c) => s + c.days, 0) / closeCycles.length) * 10) / 10
        : 0,
    }
  },

  measurementParams(): string[] {
    return Array.from(new Set(db.executions.flatMap((e) => e.measurements.map((m) => m.param))))
  },

  /** 某类测量参数的全部样本，附带规格上下限与所属版本。 */
  samples(paramKeyword: string, filters?: { productId?: string; versionId?: string }) {
    const rows: { versionId: string; versionLabel: string; value: number; param: string }[] = []
    let min: number | null = null
    let max: number | null = null
    db.executions.forEach((run) => {
      if (filters?.productId && run.productId !== filters.productId) return
      if (filters?.versionId && run.hardwareVersionId !== filters.versionId) return
      const version = db.versions.find((v) => v.id === run.hardwareVersionId)
      run.measurements.forEach((m) => {
        if (!m.param.includes(paramKeyword) || m.value === null) return
        if (m.min !== null && m.min !== undefined) {
          min = min === null ? m.min : Math.max(min, m.min)
        }
        if (m.max !== null && m.max !== undefined) {
          max = max === null ? m.max : Math.min(max, m.max)
        }
        rows.push({
          versionId: run.hardwareVersionId,
          versionLabel: version?.version ?? run.hardwareVersionId,
          value: m.value,
          param: m.param,
        })
      })
    })
    const values = rows.map((r) => r.value)
    return { rows, values, min, max, mean: mean(values), sd: stdDev(values) }
  },

  capability(paramKeyword: string, filters?: { productId?: string; versionId?: string }): CpkResult & {
    values: number[]
    min: number | null
    max: number | null
  } {
    const sample = analyticsService.samples(paramKeyword, filters)
    const result = cpk(sample.values, sample.min, sample.max)
    return { ...result, values: sample.values, min: sample.min, max: sample.max }
  },

  calibrationState(device: { calibrationDue: string }): 'valid' | 'due_soon' | 'expired' {
    const due = new Date(device.calibrationDue).getTime()
    const now = new Date(new Date().toISOString().slice(0, 10)).getTime()
    if (due < now) return 'expired'
    if (due - now <= 30 * 86400000) return 'due_soon'
    return 'valid'
  },

  resultCounts(runs: { result: RunResult }[]): Record<RunResult, number> {
    const base: Record<RunResult, number> = { PASS: 0, FAIL: 0, BLOCKED: 0, SKIPPED: 0, PENDING: 0 }
    runs.forEach((r) => {
      base[r.result] += 1
    })
    return base
  },
}
