import { reactive } from 'vue'
import type { PermissionAction, RoleKey } from '@/types'
import { can } from '@/utils/permission'

/**
 * 多端数据架构准备层。
 * 现有页面仍使用同步 LocalStorage service；新增代码通过 runService 获得
 * 统一的 loading / error / 权限入口。真正接入 NestJS 时，只需替换 adapter，
 * 页面与业务 service 签名保持不变。
 */

export type DataMode = 'local' | 'remote'

export interface ServiceIdentity {
  userId: string
  role: RoleKey
  orgId: string
}

export interface ServiceState {
  mode: DataMode
  pending: number
  lastError: { message: string; code: string; at: string } | null
  lastSuccessAt: string | null
  identity: ServiceIdentity | null
}

export const serviceRuntime = reactive<ServiceState>({
  mode: (import.meta.env.VITE_DATA_MODE as DataMode) === 'remote' ? 'remote' : 'local',
  pending: 0,
  lastError: null,
  lastSuccessAt: null,
  identity: null,
})

export class ServiceError extends Error {
  code: string

  constructor(message: string, code = 'SERVICE_ERROR') {
    super(message)
    this.name = 'ServiceError'
    this.code = code
  }
}

export function setServiceIdentity(identity: ServiceIdentity | null): void {
  serviceRuntime.identity = identity
}

export function assertPermission(action: PermissionAction): void {
  if (!can(serviceRuntime.identity?.role, action)) {
    throw new ServiceError('当前角色没有执行该操作的权限，请切换为具备权限的身份。', 'FORBIDDEN')
  }
}

export interface RunServiceOptions {
  permission?: PermissionAction
  mode?: DataMode
}

/** 统一的服务调用包装：加载计数、错误归一化、权限检查。 */
export async function runService<T>(
  operation: string,
  handler: () => T | Promise<T>,
  options: RunServiceOptions = {},
): Promise<T> {
  if (options.mode === 'remote' || serviceRuntime.mode === 'remote') {
    throw new ServiceError(
      `远程数据适配器尚未接入（${operation}）。请使用本地演示模式，或按 NEXT_STEPS.md 接入后端。`,
      'REMOTE_NOT_CONFIGURED',
    )
  }
  if (options.permission) assertPermission(options.permission)
  serviceRuntime.pending += 1
  serviceRuntime.lastError = null
  try {
    const result = await handler()
    serviceRuntime.lastSuccessAt = new Date().toISOString()
    return result
  } catch (error) {
    const message = error instanceof Error ? error.message : '操作失败，请稍后重试'
    const code = error instanceof ServiceError ? error.code : 'UNKNOWN'
    serviceRuntime.lastError = { message, code, at: new Date().toISOString() }
    throw error instanceof Error ? error : new ServiceError(message, code)
  } finally {
    serviceRuntime.pending = Math.max(0, serviceRuntime.pending - 1)
  }
}

export interface DataAdapter {
  mode: DataMode
  execute<T>(operation: string, handler: () => T | Promise<T>, options?: RunServiceOptions): Promise<T>
}

/** 当前 LocalStorage 演示适配器。 */
export const localAdapter: DataAdapter = {
  mode: 'local',
  async execute(operation, handler, options) {
    return runService(operation, handler, { ...options, mode: 'local' })
  },
}

/** 未来 NestJS 适配器占位：明确失败，不伪造成功。 */
export const remoteAdapter: DataAdapter = {
  mode: 'remote',
  async execute(operation) {
    throw new ServiceError(`远程 API 尚未接入：${operation}`, 'REMOTE_NOT_CONFIGURED')
  },
}

export function currentAdapter(): DataAdapter {
  return serviceRuntime.mode === 'remote' ? remoteAdapter : localAdapter
}
