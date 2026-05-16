import type { RolePermissionRow } from '@/runtime/loader/rolePermissions'
import { getCollectionSchemaSummariesMock } from '@/mocks/schema/store'

interface RolePermissionFlags {
  canList: boolean
  canCreate: boolean
  canUpdate: boolean
  canDelete: boolean
}

const rolePermissionStore = new Map<string, Map<string, RolePermissionFlags>>()

function defaultFlagsForRole(roleCode: string): RolePermissionFlags {
  const enabled = roleCode === 'role_super_admin'
  return { canList: enabled, canCreate: enabled, canUpdate: enabled, canDelete: enabled }
}

export function listRolePermissionsFromStore(roleCode: string): RolePermissionRow[] {
  const stored = rolePermissionStore.get(roleCode)
  return getCollectionSchemaSummariesMock().map((summary) => {
    const flags = stored?.get(summary.collectionName) ?? defaultFlagsForRole(roleCode)
    return {
      collectionName: summary.collectionName,
      modelName: summary.modelName || summary.collectionName,
      ...flags,
    }
  })
}

export function saveRolePermissionsInStore(
  roleCode: string,
  rows: RolePermissionRow[],
): void {
  const map = new Map<string, RolePermissionFlags>()
  for (const row of rows) {
    map.set(row.collectionName, {
      canList: row.canList === true,
      canCreate: row.canCreate === true,
      canUpdate: row.canUpdate === true,
      canDelete: row.canDelete === true,
    })
  }
  rolePermissionStore.set(roleCode, map)
}

export function getRolePermissionMapFromStore(roleCode: string): Record<string, RolePermissionFlags> {
  const stored = rolePermissionStore.get(roleCode)
  if (!stored) return {}
  const result: Record<string, RolePermissionFlags> = {}
  stored.forEach((flags, collectionName) => {
    result[collectionName] = flags
  })
  return result
}
