import { callCloudFunction } from '@/services/cloud'
import type { CrudDetailResult } from '@/types/runtime'

interface UpdateCrudRecordData {
  collectionName: string
  id: string
  record: Record<string, unknown>
}

export async function updateCrudRecord(data: UpdateCrudRecordData) {
  return callCloudFunction<UpdateCrudRecordData, CrudDetailResult>('modmin_crud', {
    action: 'update',
    data,
    meta: {
      requestId: `crud_update_${data.id}_${Date.now()}`,
      clientTime: Date.now(),
    },
  })
}

