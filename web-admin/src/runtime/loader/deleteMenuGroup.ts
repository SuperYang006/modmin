import { callCloudFunction } from '@/services/cloud'
import type { DeleteMenuGroupPayload, DeleteMenuGroupResult } from '@/types/schema'

export async function deleteMenuGroup(payload: DeleteMenuGroupPayload) {
  return callCloudFunction<DeleteMenuGroupPayload, DeleteMenuGroupResult>('modmin_system', {
    action: 'deleteMenuGroup',
    data: payload,
    meta: {
      requestId: `system_delete_menu_group_${Date.now()}`,
      clientTime: Date.now(),
    },
  })
}
