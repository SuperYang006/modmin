import { callCloudFunction } from '@/services/cloud'
import type { GetCollectionSchemaDetailResult } from '@/types/schema'

interface LoadCollectionSchemaDetailData {
  collectionName: string
}

export async function loadCollectionSchemaDetail(collectionName: string) {
  return callCloudFunction<LoadCollectionSchemaDetailData, GetCollectionSchemaDetailResult>('modmin_schema', {
    action: 'getCollectionSchemaDetail',
    data: { collectionName },
    meta: {
      requestId: `schema_detail_${collectionName}_${Date.now()}`,
      clientTime: Date.now(),
    },
  })
}
