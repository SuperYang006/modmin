import type { GetCollectionSchemaDetailResult } from '@/types/schema'
import { getCollectionSchemaDetailMock } from '@/mocks/schema/store'

export function getCollectionSchemaDetailResultMock(collectionName: string): GetCollectionSchemaDetailResult {
  return {
    detail: getCollectionSchemaDetailMock(collectionName) ?? {
      collection: {
        collectionName,
        modelName: '未命名集合',
        description: '当前 mock 中尚未配置该集合。',
        pageCode: `${collectionName}_list`,
        fieldCount: 0,
        updatedAt: '2026-05-02 00:00:00',
      },
      fields: [],
      layoutSchema: {
        layoutMode: 'form',
        groups: [],
      },
      pages: [],
    },
  }
}
