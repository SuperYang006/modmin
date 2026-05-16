import type { CrudDetailResult } from '@/types/runtime'
import { insertRecord } from '@/mocks/crud/store'

export function createCrudRecordMock(
  collectionName: string,
  record: Record<string, unknown>,
): CrudDetailResult {
  return { record: insertRecord(collectionName, record) }
}
