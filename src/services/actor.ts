import type { Member } from '@/types'
import { db } from './db'

/** 当前操作人：由 app store 在角色切换 / 登录时设置，service 层统一读取。 */
let current: Member = db.members.find((m) => m.id === 'M-002') ?? db.members[0]

export function setActor(member: Member): void {
  current = member
}

export function getActor(): Member {
  return current
}

export interface ActorMeta {
  actorId: string
  actorName: string
  projectId?: string
}

export function actorMeta(projectId?: string): ActorMeta {
  return { actorId: current.id, actorName: current.name, projectId }
}
