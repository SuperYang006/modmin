import { callCloudFunction } from '@/services/cloud'
import type { SortCollectionSchemasPayload, SortCollectionSchemasResult } from '@/types/schema'

export async function sortCollectionSchemas(payload: SortCollectionSchemasPayload) {
  return callCloudFunction<SortCollectionSchemasPayload, SortCollectionSchemasResult>('modmin_schema', {
    action: 'sortCollectionSchemas',
    data: payload,
    meta: {
      requestId: `schema_sort_${Date.now()}`,
      clientTime: Date.now(),
    },
  })
}
