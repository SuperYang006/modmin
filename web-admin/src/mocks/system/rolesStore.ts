import type { RoleItem, SaveRolePayload } from '@/types/schema'

const BUILTIN_ROLE_CODES = new Set(['role_super_admin', 'role_operator'])

const rolesStore: RoleItem[] = [
  {
    roleCode: 'role_super_admin',
    roleName: '超级管理员',
    description: '拥有全量权限',
    sortOrder: 10,
    status: 'enabled',
    builtin: true,
  },
  {
    roleCode: 'role_operator',
    roleName: '运营人员',
    description: '默认运营角色',
    sortOrder: 20,
    status: 'enabled',
    builtin: true,
  },
]

export function listRolesFromStore(): RoleItem[] {
  return rolesStore.slice().sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
}

export function upsertRoleInStore(payload: SaveRolePayload): RoleItem {
  const roleCode = payload.roleCode.trim()
  const roleName = payload.roleName.trim()
  const description = payload.description?.trim() ?? ''
  const isBuiltin = BUILTIN_ROLE_CODES.has(roleCode)
  const status = isBuiltin ? 'enabled' : payload.status === 'disabled' ? 'disabled' : 'enabled'

  const existingIndex = rolesStore.findIndex((item) => item.roleCode === roleCode)
  if (existingIndex >= 0) {
    const next: RoleItem = {
      ...rolesStore[existingIndex],
      roleName,
      description,
      status,
      builtin: isBuiltin,
    }
    rolesStore[existingIndex] = next
    return next
  }

  const next: RoleItem = {
    roleCode,
    roleName,
    description,
    status,
    sortOrder: (rolesStore.length + 1) * 10,
    builtin: false,
  }
  rolesStore.push(next)
  return next
}
