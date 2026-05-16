import { callCloudFunction } from '@/services/cloud'
import type { SaveCollectionSchemaPayload, SaveCollectionSchemaResult } from '@/types/schema'

export async function saveCollectionSchema(payload: SaveCollectionSchemaPayload) {
  return callCloudFunction<{ schema: SaveCollectionSchemaPayload }, SaveCollectionSchemaResult>('modmin_schema', {
    action: 'saveCollectionSchema',
    data: {
      schema: payload,
    },
    meta: {
      requestId: `schema_save_collection_${payload.collectionName}_${Date.now()}`,
      clientTime: Date.now(),
    },
  })
}
