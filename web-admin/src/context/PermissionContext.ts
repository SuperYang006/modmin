import { createContext, useContext } from 'react'

export interface ModelPermission {
  canList: boolean
  canCreate: boolean
  canUpdate: boolean
  canDelete: boolean
}

export type PermissionMap = Record<string, ModelPermission>

export interface PermissionContextValue {
  isSuperAdmin: boolean
  permMap: PermissionMap
}

export const PermissionContext = createContext<PermissionContextValue>({
  isSuperAdmin: false,
  permMap: {},
})

export function usePermission() {
  return useContext(PermissionContext)
}

export function useModelPermission(collectionName: string): ModelPermission {
  const { isSuperAdmin, permMap } = useContext(PermissionContext)
  if (isSuperAdmin) return { canList: true, canCreate: true, canUpdate: true, canDelete: true }
  return permMap[collectionName] ?? { canList: false, canCreate: false, canUpdate: false, canDelete: false }
}
