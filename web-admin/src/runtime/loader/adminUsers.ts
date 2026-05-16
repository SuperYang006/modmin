import { callCloudFunction } from '@/services/cloud'
import type { UploadedAssetValue } from '@/services/asset'

export interface AdminUserItem {
  userId: string
  userName: string
  nickName: string
  roleCode: string
  status: 'enabled' | 'disabled'
  createTime: number
  avatar?: UploadedAssetValue
}

export interface SaveAdminUserPayload {
  userId?: string
  userName: string
  nickName?: string
  roleCode: string
  status: 'enabled' | 'disabled'
  password?: string
  avatar?: UploadedAssetValue | null
}

export async function listAdminUsers() {
  return callCloudFunction<Record<string, never>, { list: AdminUserItem[] }>('modmin_system', {
    action: 'listAdminUsers',
    data: {},
    meta: { requestId: `system_list_admin_users_${Date.now()}`, clientTime: Date.now() },
  })
}

export async function saveAdminUser(user: SaveAdminUserPayload) {
  return callCloudFunction<{ user: SaveAdminUserPayload }, { item: AdminUserItem }>('modmin_system', {
    action: 'saveAdminUser',
    data: { user },
    meta: { requestId: `system_save_admin_user_${Date.now()}`, clientTime: Date.now() },
  })
}

export async function deleteAdminUser(userId: string) {
  return callCloudFunction<{ userId: string }, { userId: string }>('modmin_system', {
    action: 'deleteAdminUser',
    data: { userId },
    meta: { requestId: `system_delete_admin_user_${Date.now()}`, clientTime: Date.now() },
  })
}

export async function disableAdminUser(userId: string) {
  return callCloudFunction<{ userId: string }, { userId: string }>('modmin_system', {
    action: 'disableAdminUser',
    data: { userId },
    meta: { requestId: `system_disable_admin_user_${Date.now()}`, clientTime: Date.now() },
  })
}
