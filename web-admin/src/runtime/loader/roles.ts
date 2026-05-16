import { callCloudFunction } from '@/services/cloud'

export interface RoleItem {
  roleCode: string
  roleName: string
  description: string
  sortOrder: number
  status: 'enabled' | 'disabled'
  builtin?: boolean
}

export async function listRoles() {
  return callCloudFunction<Record<string, never>, { list: RoleItem[] }>('modmin_system', {
    action: 'listRoles',
    data: {},
    meta: { requestId: `system_list_roles_${Date.now()}`, clientTime: Date.now() },
  })
}

export async function saveRole(role: Omit<RoleItem, 'sortOrder'>) {
  return callCloudFunction<{ role: Omit<RoleItem, 'sortOrder'> }, { item: RoleItem }>('modmin_system', {
    action: 'saveRole',
    data: { role },
    meta: { requestId: `system_save_role_${Date.now()}`, clientTime: Date.now() },
  })
}
