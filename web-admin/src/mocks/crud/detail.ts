import type { CrudDetailResult } from '@/types/runtime'
import { findRecord } from '@/mocks/crud/store'

export function getCrudDetailMock(collectionName: string, id: string): CrudDetailResult {
  return { record: findRecord(collectionName, id) }
}
