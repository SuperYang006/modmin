import type {
  DeleteMenuGroupResult,
  MenuGroupItem,
  SaveMenuGroupPayload,
  SaveMenuGroupResult,
} from '@/types/schema'

const menuGroupStore = new Map<string, MenuGroupItem>()
let menuGroupSequence = 0

export function listMenuGroupsFromStore(): MenuGroupItem[] {
  return Array.from(menuGroupStore.values())
    .slice()
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
}

export function findMenuGroupInStore(groupId: string): MenuGroupItem | undefined {
  return menuGroupStore.get(groupId)
}

export function upsertMenuGroupInStore(payload: SaveMenuGroupPayload): SaveMenuGroupResult {
  const status = payload.status === 'disabled' ? 'disabled' : 'enabled'
  const title = payload.title.trim()
  const groupCode = (payload.groupCode || '').trim()
  const icon = (payload.icon || '').trim()

  if (payload.groupId && menuGroupStore.has(payload.groupId)) {
    const current = menuGroupStore.get(payload.groupId) as MenuGroupItem
    const next: MenuGroupItem = { ...current, groupCode, title, icon, status }
    menuGroupStore.set(current.groupId, next)
    return { item: next }
  }

  const duplicated = listMenuGroupsFromStore().find((item) => item.groupCode === groupCode)
  if (duplicated) {
    const next: MenuGroupItem = { ...duplicated, title, icon, status }
    menuGroupStore.set(duplicated.groupId, next)
    return { item: next }
  }

  menuGroupSequence += 1
  const groupId = `menu_group_mock_${menuGroupSequence}`
  const sortOrder = (menuGroupStore.size + 1) * 10
  const item: MenuGroupItem = { groupId, groupCode, title, icon, sortOrder, status }
  menuGroupStore.set(groupId, item)
  return { item }
}

export function removeMenuGroupFromStore(
  groupId: string,
  isOccupied: (groupId: string) => boolean,
): { result: DeleteMenuGroupResult } | { error: string } {
  if (!menuGroupStore.has(groupId)) {
    return { error: '分组不存在' }
  }

  if (isOccupied(groupId)) {
    return { error: '该菜单下仍有模型，无法删除' }
  }

  menuGroupStore.delete(groupId)
  return { result: { groupId } }
}
