import { callCloudFunction } from '@/services/cloud'
import type { ListMenuGroupItemsResult } from '@/types/schema'

export async function listMenuGroups() {
  return callCloudFunction<Record<string, never>, ListMenuGroupItemsResult>('modmin_system', {
    action: 'listMenuGroups',
    data: {},
    meta: {
      requestId: `system_list_menu_groups_${Date.now()}`,
      clientTime: Date.now(),
    },
  })
}
