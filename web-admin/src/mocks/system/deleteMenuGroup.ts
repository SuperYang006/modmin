import type { DeleteMenuGroupResult } from '@/types/schema'
import { removeMenuGroupFromStore } from '@/mocks/system/store'

export type DeleteMenuGroupMockResult =
  | { ok: true; data: DeleteMenuGroupResult }
  | { ok: false; message: string }

export function deleteMenuGroupMock(
  groupId: string,
  isOccupied: (groupId: string) => boolean,
): DeleteMenuGroupMockResult {
  const outcome = removeMenuGroupFromStore(groupId, isOccupied)

  if ('error' in outcome) {
    return { ok: false, message: outcome.error }
  }

  return { ok: true, data: outcome.result }
}
