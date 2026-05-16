import { callCloudFunction } from '@/services/cloud'
import type { CrudDetailResult } from '@/types/runtime'

interface LoadCrudDetailData {
  collectionName: string
  id: string
}

export async function loadCrudDetail(data: LoadCrudDetailData) {
  return callCloudFunction<LoadCrudDetailData, CrudDetailResult>('modmin_crud', {
    action: 'detail',
    data,
    meta: {
      requestId: `crud_detail_${data.id}_${Date.now()}`,
      clientTime: Date.now(),
    },
  })
}

