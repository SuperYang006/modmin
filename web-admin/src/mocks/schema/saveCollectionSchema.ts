import type { SaveCollectionSchemaPayload, SaveCollectionSchemaResult } from '@/types/schema'
import { saveCollectionSchemaMock } from '@/mocks/schema/store'

export function saveCollectionSchemaResultMock(
  payload: SaveCollectionSchemaPayload,
): SaveCollectionSchemaResult {
  return {
    detail: saveCollectionSchemaMock(payload),
  }
}
