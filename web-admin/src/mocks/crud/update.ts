import type { CrudDetailResult } from '@/types/runtime'
import { updateRecord } from '@/mocks/crud/store'

export function updateCrudRecordMock(
  collectionName: string,
  id: string,
  record: Record<string, unknown>,
): CrudDetailResult {
  return { record: updateRecord(collectionName, id, record) }
}
