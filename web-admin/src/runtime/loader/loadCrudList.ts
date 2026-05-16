import { callCloudFunction } from '@/services/cloud'
import type { CrudFilterItem, CrudListQuery, CrudListResult } from '@/types/runtime'

interface LoadCrudListData {
  collectionName: string
  filters?: CrudFilterItem[]
  sort?: CrudListQuery['sort']
  pagination?: CrudListQuery['pagination']
  fieldKeys?: string[]
}

export async function loadCrudList(data: LoadCrudListData) {
  return callCloudFunction<LoadCrudListData, CrudListResult>('modmin_crud', {
    action: 'list',
    data,
    meta: {
      requestId: `crud_list_${Date.now()}`,
      clientTime: Date.now(),
    },
  })
}
