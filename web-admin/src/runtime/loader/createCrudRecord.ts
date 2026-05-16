import { callCloudFunction } from '@/services/cloud'
import type { CrudDetailResult } from '@/types/runtime'

interface CreateCrudRecordData {
  collectionName: string
  record: Record<string, unknown>
}

export async function createCrudRecord(data: CreateCrudRecordData) {
  return callCloudFunction<CreateCrudRecordData, CrudDetailResult>('modmin_crud', {
    action: 'create',
    data,
    meta: {
      requestId: `crud_create_${Date.now()}`,
      clientTime: Date.now(),
    },
  })
}

