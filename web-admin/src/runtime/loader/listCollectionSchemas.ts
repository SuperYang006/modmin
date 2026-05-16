import { callCloudFunction } from '@/services/cloud'
import type { ListCollectionSchemasResult } from '@/types/schema'

export async function listCollectionSchemas() {
  return callCloudFunction<Record<string, never>, ListCollectionSchemasResult>('modmin_schema', {
    action: 'listCollectionSchemas',
    data: {},
    meta: {
      requestId: `schema_list_${Date.now()}`,
      clientTime: Date.now(),
    },
  })
}
