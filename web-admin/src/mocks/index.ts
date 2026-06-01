import type { ApiRequest, ApiResponse } from '../../../shared/types/api'
import { createCrudRecordMock } from '@/mocks/crud/create'
import { getCrudDetailMock } from '@/mocks/crud/detail'
import { deleteCrudRecordMock } from '@/mocks/crud/delete'
import { getCrudListMock } from '@/mocks/crud/list'
import { updateCrudRecordMock } from '@/mocks/crud/update'
import { getCollectionSchemaDetailResultMock } from '@/mocks/schema/getCollectionSchemaDetail'
import { listCollectionSchemasMock } from '@/mocks/schema/listCollectionSchemas'
import { saveCollectionSchemaResultMock } from '@/mocks/schema/saveCollectionSchema'
import {
  assignMenuGroupInMock,
  deleteCollectionSchemaMock,
  isMenuGroupOccupiedInMock,
  sortCollectionSchemasMock,
} from '@/mocks/schema/store'
import { getPageRuntimeSchemaMock } from '@/mocks/runtime/getPageRuntimeSchema'
import { listMenuGroupsMock } from '@/mocks/system/listMenuGroups'
import { saveMenuGroupMock } from '@/mocks/system/saveMenuGroup'
import { deleteMenuGroupMock } from '@/mocks/system/deleteMenuGroup'
import { listRolesFromStore, upsertRoleInStore } from '@/mocks/system/rolesStore'
import {
  disableAdminUserInStore,
  listAdminUsersFromStore,
  removeAdminUserFromStore,
  upsertAdminUserInStore,
} from '@/mocks/system/adminUsersStore'
import {
  listRolePermissionsFromStore,
  saveRolePermissionsInStore,
} from '@/mocks/system/rolePermissionsStore'
import type { AdminUserInfo } from '@/types/auth'
import type { CrudFilterItem } from '@/types/runtime'
import type { SaveRolePayload } from '@/types/schema'
import type { ConsoleOverviewResult } from '@/types/schema'
import type { RolePermissionRow } from '@/runtime/loader/rolePermissions'
import type { SaveAdminUserPayload } from '@/runtime/loader/adminUsers'
import {
  confirmImportMock,
  downloadImportTemplateMock,
  exportRecordsMock,
  getTransferJobDetailMock,
  listTransferJobsMock,
  listTransferCollectionsMock,
  previewImportMock,
} from '@/mocks/importExport'

const mockAdminUser: AdminUserInfo = {
  userId: 'admin_user_demo',
  userName: 'admin',
  nickName: '系统管理员',
  roleCode: 'role_super_admin',
}

const MOCK_FUNCTION_PREFIX = (import.meta.env.VITE_MODMIN_FUNCTION_PREFIX as string | undefined) ?? 'modmin_'

function normalizeMockFunctionName(functionName: string): string {
  return functionName.startsWith(MOCK_FUNCTION_PREFIX)
    ? functionName.slice(MOCK_FUNCTION_PREFIX.length)
    : functionName
}

function ok<TResult>(data: TResult, requestId?: string): ApiResponse<TResult> {
  return { code: 0, message: 'ok', data, requestId, serverTime: Date.now() }
}

function err<TResult>(code: number, message: string, requestId?: string): ApiResponse<TResult> {
  return { code, message, data: null as TResult, requestId, serverTime: Date.now() }
}

export async function dispatchMockCloudFunction<TData, TResult>(
  rawFunctionName: string,
  payload: ApiRequest<TData>,
): Promise<ApiResponse<TResult>> {
  const functionName = normalizeMockFunctionName(rawFunctionName)
  const requestId = payload.meta?.requestId

  // ─── auth ─────────────────────────────────────────────────
  if (functionName === 'auth' && payload.action === 'login') {
    const input = payload.data as { userName?: string; password?: string }
    if (input.userName !== 'admin' || input.password !== '123456') {
      return err(40101, '账号或密码错误', requestId)
    }
    return ok({
      ticket: 'mock_ticket_admin',
      accessToken: 'mock_access_token_admin',
      refreshToken: 'mock_refresh_token_admin',
      expireTime: Date.now() + 15 * 60 * 1000,
      userInfo: mockAdminUser,
    } as TResult, requestId)
  }

  if (functionName === 'auth' && payload.action === 'getCurrentUser') {
    return ok({ userInfo: mockAdminUser } as TResult, requestId)
  }

  if (functionName === 'auth' && payload.action === 'validateSession') {
    const input = payload.data as { accessToken?: string }
    const valid = input.accessToken === 'mock_access_token_admin'
    return {
      code: valid ? 0 : 40102,
      message: valid ? 'ok' : '登录态失效',
      data: {
        valid,
        expireTime: valid ? Date.now() + 15 * 60 * 1000 : 0,
        userInfo: valid ? mockAdminUser : null,
      } as TResult,
      requestId,
      serverTime: Date.now(),
    }
  }

  if (functionName === 'auth' && payload.action === 'refreshToken') {
    return ok({
      ticket: 'mock_ticket_admin',
      accessToken: 'mock_access_token_admin',
      refreshToken: 'mock_refresh_token_admin',
      expireTime: Date.now() + 15 * 60 * 1000,
      userInfo: mockAdminUser,
    } as TResult, requestId)
  }

  if (functionName === 'auth' && payload.action === 'logout') {
    return ok({} as TResult, requestId)
  }

  // ─── system: permissions ──────────────────────────────────
  if (functionName === 'system' && payload.action === 'getMyPermissions') {
    return ok({ isSuperAdmin: true, permMap: {} } as TResult, requestId)
  }

  if (functionName === 'system' && payload.action === 'getConsoleOverview') {
    const collections = listCollectionSchemasMock().list
    const ungroupedModelCount = collections.filter((item) => !item.menuGroupId).length
    const overview: ConsoleOverviewResult = {
      isSuperAdmin: true,
      roleDisabled: false,
      stats: {
        modelCount: collections.length,
        fieldCount: collections.reduce((sum, item) => sum + (Number(item.fieldCount) || 0), 0),
        visibleModelCount: collections.length,
        ungroupedModelCount,
        roleCount: listRolesFromStore().length,
        adminUserCount: listAdminUsersFromStore().length,
        webhookCount: 0,
        failedWebhookDeliveryCount: 0,
      },
      recentModels: collections.slice(0, 5),
      visibleModels: collections,
      warnings: ungroupedModelCount > 0
        ? [
            {
              type: 'ungroupedModels',
              severity: 'warning',
              title: '存在未分组模型',
              description: '未归入菜单分组的模型会直接显示在侧边栏根级。',
              count: ungroupedModelCount,
              actionPath: '/config/menu-groups',
            },
          ]
        : [],
    }
    return ok(overview as TResult, requestId)
  }

  // ─── system: roles ────────────────────────────────────────
  if (functionName === 'system' && payload.action === 'listRoles') {
    return ok({ list: listRolesFromStore() } as TResult, requestId)
  }

  if (functionName === 'system' && payload.action === 'saveRole') {
    const input = payload.data as { role: SaveRolePayload }
    if (!input.role?.roleCode || !input.role?.roleName) {
      return err(40001, '缺少角色编码或角色名称', requestId)
    }
    const item = upsertRoleInStore(input.role)
    return ok({ item } as TResult, requestId)
  }

  if (functionName === 'system' && payload.action === 'getRolePermissions') {
    const input = payload.data as { roleCode?: string }
    if (!input.roleCode) {
      return err(40001, '缺少 roleCode', requestId)
    }
    return ok({ list: listRolePermissionsFromStore(input.roleCode) } as TResult, requestId)
  }

  if (functionName === 'system' && payload.action === 'saveRolePermissions') {
    const input = payload.data as { roleCode?: string; permissions?: RolePermissionRow[] }
    if (!input.roleCode) return err(40001, '缺少 roleCode', requestId)
    if (!Array.isArray(input.permissions)) return err(40001, '缺少 permissions 列表', requestId)
    saveRolePermissionsInStore(input.roleCode, input.permissions)
    return ok({ roleCode: input.roleCode } as TResult, requestId)
  }

  // ─── system: admin users ──────────────────────────────────
  if (functionName === 'system' && payload.action === 'listAdminUsers') {
    return ok({ list: listAdminUsersFromStore() } as TResult, requestId)
  }

  if (functionName === 'system' && payload.action === 'saveAdminUser') {
    const input = payload.data as { user: SaveAdminUserPayload }
    if (!input.user?.userName) return err(40001, '缺少用户名', requestId)
    const result = upsertAdminUserInStore(input.user)
    if ('error' in result) return err(result.error.code, result.error.message, requestId)
    return ok({ item: result.item } as TResult, requestId)
  }

  if (functionName === 'system' && payload.action === 'deleteAdminUser') {
    const input = payload.data as { userId?: string }
    if (!input.userId) return err(40001, '缺少用户 ID', requestId)
    const result = removeAdminUserFromStore(input.userId)
    if ('error' in result) return err(result.error.code, result.error.message, requestId)
    return ok({ userId: input.userId } as TResult, requestId)
  }

  if (functionName === 'system' && payload.action === 'disableAdminUser') {
    const input = payload.data as { userId?: string }
    if (!input.userId) return err(40001, '缺少用户 ID', requestId)
    const result = disableAdminUserInStore(input.userId)
    if ('error' in result) return err(result.error.code, result.error.message, requestId)
    return ok({ item: result.item } as TResult, requestId)
  }

  // ─── system: menu groups ──────────────────────────────────
  if (functionName === 'system' && payload.action === 'listMenuGroups') {
    return ok(listMenuGroupsMock() as TResult, requestId)
  }

  if (functionName === 'system' && payload.action === 'saveMenuGroup') {
    const input = payload.data as { group: Parameters<typeof saveMenuGroupMock>[0] }
    return ok(saveMenuGroupMock(input.group) as TResult, requestId)
  }

  if (functionName === 'system' && payload.action === 'deleteMenuGroup') {
    const input = payload.data as { groupId: string }
    const outcome = deleteMenuGroupMock(input.groupId, isMenuGroupOccupiedInMock)
    if (!outcome.ok) return err(40901, outcome.message, requestId)
    return ok(outcome.data as TResult, requestId)
  }

  // ─── runtime ──────────────────────────────────────────────
  if (functionName === 'runtime' && payload.action === 'getPageRuntimeSchema') {
    const pageCode = (payload.data as { pageCode?: string })?.pageCode ?? 'article_list'
    return ok({ pageRuntimeSchema: getPageRuntimeSchemaMock(pageCode) } as TResult, requestId)
  }

  // ─── schema ───────────────────────────────────────────────
  if (functionName === 'schema' && payload.action === 'listCollectionSchemas') {
    return ok(listCollectionSchemasMock() as TResult, requestId)
  }

  if (functionName === 'schema' && payload.action === 'getCollectionSchemaDetail') {
    const input = payload.data as { collectionName?: string }
    const collectionName = input.collectionName ?? 'article'
    return ok(getCollectionSchemaDetailResultMock(collectionName) as TResult, requestId)
  }

  if (functionName === 'schema' && payload.action === 'saveCollectionSchema') {
    const input = payload.data as { schema: Parameters<typeof saveCollectionSchemaResultMock>[0] }
    try {
      return ok(saveCollectionSchemaResultMock(input.schema) as TResult, requestId)
    } catch (error) {
      return err(40005, error instanceof Error ? error.message : '保存模型失败', requestId)
    }
  }

  if (functionName === 'schema' && payload.action === 'deleteCollectionSchema') {
    const input = payload.data as { collectionName: string }
    const result = deleteCollectionSchemaMock(input.collectionName)
    if (!result) return err(40404, '模型不存在', requestId)
    return ok(result as TResult, requestId)
  }

  // ─── import_export ───────────────────────────────────────
  if (functionName === 'import_export' && payload.action === 'listTransferCollections') {
    return ok(listTransferCollectionsMock() as TResult, requestId)
  }

  if (functionName === 'import_export' && payload.action === 'downloadImportTemplate') {
    return ok(downloadImportTemplateMock(payload.data as never) as TResult, requestId)
  }

  if (functionName === 'import_export' && payload.action === 'exportRecords') {
    return ok(exportRecordsMock(payload.data as never) as TResult, requestId)
  }

  if (functionName === 'import_export' && payload.action === 'previewImport') {
    try {
      return ok(previewImportMock(payload.data as never) as TResult, requestId)
    } catch (error) {
      return err(40002, error instanceof Error ? error.message : '导入预检失败', requestId)
    }
  }

  if (functionName === 'import_export' && payload.action === 'confirmImport') {
    try {
      return ok(confirmImportMock(payload.data as never) as TResult, requestId)
    } catch (error) {
      return err(40002, error instanceof Error ? error.message : '确认导入失败', requestId)
    }
  }

  if (functionName === 'import_export' && payload.action === 'getTransferJobDetail') {
    return ok(getTransferJobDetailMock((payload.data as { jobId: string }).jobId) as TResult, requestId)
  }

  if (functionName === 'import_export' && payload.action === 'listTransferJobs') {
    const input = payload.data as {
      jobType?: 'export' | 'import_preview' | 'import_confirm'
      collectionName?: string
      status?: 'pending' | 'previewed' | 'processing' | 'success' | 'partialSuccess' | 'failed'
      format?: 'xlsx' | 'csv' | 'json'
      pageNo?: number
      pageSize?: number
    }
    return ok(listTransferJobsMock(input) as TResult, requestId)
  }

  if (functionName === 'schema' && payload.action === 'sortCollectionSchemas') {
    const input = payload.data as { items: Array<{ collectionName: string; sortOrder: number }> }
    return ok(sortCollectionSchemasMock(input.items) as TResult, requestId)
  }

  if (functionName === 'schema' && payload.action === 'assignMenuGroup') {
    const input = payload.data as { collectionNames?: string[]; menuGroupId?: string | null }
    const names = Array.isArray(input.collectionNames) ? input.collectionNames : []
    if (names.length === 0) {
      return err(40001, 'collectionNames is required', requestId)
    }
    const result = assignMenuGroupInMock(names, input.menuGroupId ?? null)
    if ('error' in result) return err(40404, result.error, requestId)
    return ok({} as TResult, requestId)
  }

  // ─── crud ─────────────────────────────────────────────────
  if (functionName === 'crud' && payload.action === 'list') {
    const input = payload.data as {
      collectionName: string
      filters?: CrudFilterItem[]
      pagination?: { pageNo?: number; pageSize?: number }
      sort?: { field: string; order: 'asc' | 'desc' }
    }
    return ok(getCrudListMock(input) as TResult, requestId)
  }

  if (functionName === 'crud' && payload.action === 'detail') {
    const input = payload.data as { collectionName: string; id: string }
    return ok(getCrudDetailMock(input.collectionName, input.id) as TResult, requestId)
  }

  if (functionName === 'crud' && payload.action === 'create') {
    const input = payload.data as { collectionName: string; record: Record<string, unknown> }
    return ok(createCrudRecordMock(input.collectionName, input.record) as TResult, requestId)
  }

  if (functionName === 'crud' && payload.action === 'update') {
    const input = payload.data as { collectionName: string; id: string; record: Record<string, unknown> }
    return ok(updateCrudRecordMock(input.collectionName, input.id, input.record) as TResult, requestId)
  }

  if (functionName === 'crud' && payload.action === 'delete') {
    const input = payload.data as { collectionName: string; id: string }
    return ok(deleteCrudRecordMock(input.collectionName, input.id) as TResult, requestId)
  }

  return err(40002, `mock handler not found: ${rawFunctionName}.${payload.action}`, requestId)
}
