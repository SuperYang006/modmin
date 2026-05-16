import { callCloudFunction } from '@/services/cloud'
import type { DeleteCollectionSchemaPayload, DeleteCollectionSchemaResult } from '@/types/schema'

export async function deleteCollectionSchema(payload: DeleteCollectionSchemaPayload) {
  return callCloudFunction<DeleteCollectionSchemaPayload, DeleteCollectionSchemaResult>('modmin_schema', {
    action: 'deleteCollectionSchema',
    data: payload,
    meta: {
      requestId: `schema_delete_collection_${payload.collectionName}_${Date.now()}`,
      clientTime: Date.now(),
    },
  })
}
