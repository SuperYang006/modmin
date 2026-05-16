import type { PageRuntimeSchema } from '@/types/runtime'
import { callCloudFunction } from '@/services/cloud'

interface GetPageRuntimeSchemaData {
  pageCode: string
}

interface GetPageRuntimeSchemaResult {
  pageRuntimeSchema: PageRuntimeSchema
}

export async function loadPageRuntimeSchema(pageCode: string) {
  return callCloudFunction<GetPageRuntimeSchemaData, GetPageRuntimeSchemaResult>('modmin_runtime', {
    action: 'getPageRuntimeSchema',
    data: { pageCode },
    meta: {
      requestId: `runtime_${pageCode}_${Date.now()}`,
      clientTime: Date.now(),
    },
  })
}

