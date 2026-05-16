import { callCloudFunction } from '@/services/cloud'

interface AssignMenuGroupPayload {
  collectionNames: string[]
  menuGroupId: string | null
}

export async function assignMenuGroup(payload: AssignMenuGroupPayload) {
  return callCloudFunction<AssignMenuGroupPayload, Record<string, never>>('modmin_schema', {
    action: 'assignMenuGroup',
    data: payload,
    meta: {
      requestId: `schema_assign_menu_group_${Date.now()}`,
      clientTime: Date.now(),
    },
  })
}
