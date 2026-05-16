import { callCloudFunction } from '@/services/cloud'
import type { PermissionMap } from '@/context/PermissionContext'

export interface RolePermissionRow {
  collectionName: string
  modelName: string
  canList: boolean
  canCreate: boolean
  canUpdate: boolean
  canDelete: boolean
}

interface GetRolePermissionsResult {
  list: RolePermissionRow[]
}

export async function getRolePermissions(roleCode: string) {
  return callCloudFunction<{ roleCode: string }, GetRolePermissionsResult>('modmin_system', {
    action: 'getRolePermissions',
    data: { roleCode },
    meta: { requestId: `system_get_role_permissions_${Date.now()}`, clientTime: Date.now() },
  })
}

export async function saveRolePermissions(roleCode: string, permissions: RolePermissionRow[]) {
  return callCloudFunction<{ roleCode: string; permissions: RolePermissionRow[] }, { roleCode: string }>(
    'modmin_system',
    {
      action: 'saveRolePermissions',
      data: { roleCode, permissions },
      meta: { requestId: `system_save_role_permissions_${Date.now()}`, clientTime: Date.now() },
    },
  )
}
