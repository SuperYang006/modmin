import { callCloudFunction } from '@/services/cloud'
import type { SaveMenuGroupPayload, SaveMenuGroupResult } from '@/types/schema'

export async function saveMenuGroup(group: SaveMenuGroupPayload) {
  return callCloudFunction<{ group: SaveMenuGroupPayload }, SaveMenuGroupResult>('modmin_system', {
    action: 'saveMenuGroup',
    data: {
      group,
    },
    meta: {
      requestId: `system_save_menu_group_${Date.now()}`,
      clientTime: Date.now(),
    },
  })
}
