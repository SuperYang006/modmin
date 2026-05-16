import { callCloudFunction } from '@/services/cloud'
import type { CrudDetailResult } from '@/types/runtime'

interface DeleteCrudRecordData {
  collectionName: string
  id: string
}

export async function deleteCrudRecord(data: DeleteCrudRecordData) {
  return callCloudFunction<DeleteCrudRecordData, CrudDetailResult>('modmin_crud', {
    action: 'delete',
    data,
    meta: {
      requestId: `crud_delete_${data.id}_${Date.now()}`,
      clientTime: Date.now(),
    },
  })
}

