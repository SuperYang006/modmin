import type { ListCollectionSchemasResult } from '@/types/schema'
import { getCollectionSchemaSummariesMock } from '@/mocks/schema/store'

export function listCollectionSchemasMock(): ListCollectionSchemasResult {
  return {
    list: getCollectionSchemaSummariesMock(),
  }
}
