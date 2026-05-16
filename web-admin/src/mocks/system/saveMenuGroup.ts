import type { SaveMenuGroupPayload, SaveMenuGroupResult } from '@/types/schema'
import { upsertMenuGroupInStore } from '@/mocks/system/store'

export function saveMenuGroupMock(group: SaveMenuGroupPayload): SaveMenuGroupResult {
  return upsertMenuGroupInStore(group)
}
