import type { ListMenuGroupItemsResult } from '@/types/schema'
import { listMenuGroupsFromStore } from '@/mocks/system/store'

export function listMenuGroupsMock(): ListMenuGroupItemsResult {
  return {
    list: listMenuGroupsFromStore(),
  }
}
