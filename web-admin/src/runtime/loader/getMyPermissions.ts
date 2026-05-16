import { callCloudFunction } from '@/services/cloud'
import type { PermissionMap } from '@/context/PermissionContext'

interface GetMyPermissionsResult {
  isSuperAdmin: boolean
  permMap: PermissionMap
}

export async function getMyPermissions() {
  return callCloudFunction<Record<string, never>, GetMyPermissionsResult>('modmin_system', {
    action: 'getMyPermissions',
    data: {},
    meta: { requestId: `system_get_my_permissions_${Date.now()}`, clientTime: Date.now() },
  })
}
