import type { RuntimeAction } from '@/types/runtime'

export function resolveActionVisible(action: RuntimeAction, permissionKeys: string[] = []) {
  if (!action.permissionKey) {
    return true
  }

  return permissionKeys.includes(action.permissionKey)
}

