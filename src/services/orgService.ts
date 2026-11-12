import type { AuditLog, Integration, Member, Notification, Org, RoleKey, Todo } from '@/types'
import { db, mutate } from './db'
import { getActor } from './actor'

const nowIso = () => new Date().toISOString()

const colors = ['#1f3a5f', '#1f6f8b', '#1f8a70', '#8a6d1f', '#6b4f8a', '#6b7a8f']

export const memberService = {
  list(): Member[] {
    return db.members
  },

  get(id: string): Member | undefined {
    return db.members.find((m) => m.id === id)
  },

  name(id: string): string {
    return db.members.find((m) => m.id === id)?.name ?? id
  },

  invite(input: { name: string; email: string; role: RoleKey; title: string }): Member {
    const actor = getActor()
    const member: Member = {
      id: `M-${String(db.members.length + 1).padStart(3, '0')}`,
      name: input.name,
      title: input.title,
      role: input.role,
      email: input.email,
      color: colors[db.members.length % colors.length],
      status: 'invited',
      joinedAt: nowIso(),
      lastActiveAt: nowIso(),
    }
    mutate(
      (draft) => {
        draft.members.push(member)
      },
      {
        actorId: actor.id,
        actorName: actor.name,
        action: 'create',
        entity: 'member',
        entityId: member.id,
        entityLabel: member.name,
        summary: `邀请成员 ${member.name}（${input.role}）`,
      },
    )
    return member
  },

  setRole(id: string, role: RoleKey): void {
    const actor = getActor()
    const target = db.members.find((m) => m.id === id)
    if (!target) return
    mutate(
      (draft) => {
        const row = draft.members.find((m) => m.id === id)
        if (row) row.role = role
      },
      {
        actorId: actor.id,
        actorName: actor.name,
        action: 'permission',
        entity: 'member',
        entityId: id,
        entityLabel: target.name,
        summary: `角色变更：${target.role} → ${role}`,
      },
    )
  },

  setStatus(id: string, status: Member['status']): void {
    const actor = getActor()
    const target = db.members.find((m) => m.id === id)
    if (!target) return
    mutate(
      (draft) => {
        const row = draft.members.find((m) => m.id === id)
        if (row) row.status = status
      },
      {
        actorId: actor.id,
        actorName: actor.name,
        action: 'permission',
        entity: 'member',
        entityId: id,
        entityLabel: target.name,
        summary: `成员状态变更为 ${status}`,
      },
    )
  },

  updateProfile(id: string, patch: Partial<Pick<Member, 'name' | 'title' | 'email' | 'phone'>>): void {
    const actor = getActor()
    const target = db.members.find((m) => m.id === id)
    if (!target) return
    mutate(
      (draft) => {
        const row = draft.members.find((m) => m.id === id)
        if (row) Object.assign(row, patch)
      },
      {
        actorId: actor.id,
        actorName: actor.name,
        action: 'update',
        entity: 'member',
        entityId: id,
        entityLabel: target.name,
        summary: '更新成员资料',
      },
    )
  },

  projectMembers(projectId: string): Member[] {
    const project = db.projects.find((p) => p.id === projectId)
    if (!project) return []
    return project.memberIds.map((id) => db.members.find((m) => m.id === id)).filter(Boolean) as Member[]
  },
}

export const notificationService = {
  list(userId?: string): Notification[] {
    const rows = userId ? db.notifications.filter((n) => !n.userId || n.userId === userId) : db.notifications
    return [...rows].sort((a, b) => (a.at < b.at ? 1 : -1))
  },

  unread(userId?: string): number {
    return notificationService.list(userId).filter((n) => !n.read).length
  },

  markRead(id: string): void {
    mutate((draft) => {
      const row = draft.notifications.find((n) => n.id === id)
      if (row) row.read = true
    })
  },

  markAllRead(userId?: string): void {
    mutate((draft) => {
      draft.notifications.forEach((n) => {
        if (!userId || !n.userId || n.userId === userId) n.read = true
      })
    })
  },

  push(input: { title: string; body: string; kind: Notification['kind']; link?: string; userId?: string }): void {
    mutate((draft) => {
      draft.notifications.unshift({
        id: `NOTI-${Date.now().toString(36)}`,
        at: nowIso(),
        title: input.title,
        body: input.body,
        kind: input.kind,
        read: false,
        link: input.link,
        userId: input.userId,
      })
    })
  },
}

export const todoService = {
  list(userId?: string): Todo[] {
    return (userId ? db.todos.filter((t) => t.assigneeId === userId) : db.todos).filter((t) => !t.done)
  },

  all(userId?: string): Todo[] {
    return userId ? db.todos.filter((t) => t.assigneeId === userId) : db.todos
  },

  toggle(id: string): void {
    mutate((draft) => {
      const row = draft.todos.find((t) => t.id === id)
      if (row) row.done = !row.done
    })
  },

  create(input: Omit<Todo, 'id' | 'done'>): void {
    mutate((draft) => {
      draft.todos.unshift({ ...input, id: `TODO-${Date.now().toString(36)}`, done: false })
    })
  },
}

export const integrationService = {
  list(): Integration[] {
    return db.integrations
  },

  get(id: string): Integration | undefined {
    return db.integrations.find((i) => i.id === id)
  },

  /** 演示模式：仅切换本地状态，不发起真实 OAuth / Webhook 请求。 */
  setStatus(id: string, status: Integration['status']): void {
    const actor = getActor()
    const target = db.integrations.find((i) => i.id === id)
    if (!target) return
    mutate(
      (draft) => {
        const row = draft.integrations.find((i) => i.id === id)
        if (row) row.status = status
      },
      {
        actorId: actor.id,
        actorName: actor.name,
        action: 'update',
        entity: 'setting',
        entityId: id,
        entityLabel: target.name,
        summary: `集成状态变更为 ${status}（本地演示，不发起真实请求）`,
      },
    )
  },
}

export const auditService = {
  list(): AuditLog[] {
    return [...db.audits].sort((a, b) => (a.at < b.at ? 1 : -1))
  },

  filter(options: { action?: string; entity?: string; actorId?: string; keyword?: string; from?: string; to?: string }): AuditLog[] {
    return auditService.list().filter((log) => {
      if (options.action && log.action !== options.action) return false
      if (options.entity && log.entity !== options.entity) return false
      if (options.actorId && log.actorId !== options.actorId) return false
      if (options.from && log.at.slice(0, 10) < options.from) return false
      if (options.to && log.at.slice(0, 10) > options.to) return false
      if (options.keyword) {
        const kw = options.keyword.toLowerCase()
        if (
          !log.summary.toLowerCase().includes(kw) &&
          !log.entityLabel.toLowerCase().includes(kw) &&
          !log.actorName.toLowerCase().includes(kw)
        ) {
          return false
        }
      }
      return true
    })
  },
}

export const orgService = {
  get(): Org {
    return db.org
  },

  update(patch: Partial<Org>): void {
    const actor = getActor()
    mutate(
      (draft) => {
        Object.assign(draft.org, patch)
      },
      {
        actorId: actor.id,
        actorName: actor.name,
        action: 'update',
        entity: 'setting',
        entityId: 'org',
        entityLabel: '组织资料',
        summary: '更新组织资料',
      },
    )
  },
}
