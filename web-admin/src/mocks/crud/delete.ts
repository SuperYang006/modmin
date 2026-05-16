import type { CrudDetailResult } from '@/types/runtime'
import { removeRecord } from '@/mocks/crud/store'

export function deleteCrudRecordMock(collectionName: string, id: string): CrudDetailResult {
  removeRecord(collectionName, id)
  return { record: null }
}
