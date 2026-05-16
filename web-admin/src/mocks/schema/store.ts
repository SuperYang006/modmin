import type {
  CollectionSchemaDetail,
  CollectionSchemaSummary,
  ModelFieldDraft,
} from '@/types/schema'
import type { RuntimeField } from '@/types/runtime'
import { getPageRuntimeSchemaMock } from '@/mocks/runtime/getPageRuntimeSchema'

function buildArticleCollectionDetail(): CollectionSchemaDetail {
  const runtimeSchema = getPageRuntimeSchemaMock('article_list')

  return {
    collection: {
      collectionName: 'article',
      modelCode: 'article',
      modelName: '文章',
      description: '用于管理文章内容、状态、封面、标签与审批流入口。',
      pageCode: 'article_list',
      sortOrder: 10,
      fieldCount: runtimeSchema.fields.length,
      updatedAt: '2026-05-02 16:20:00',
    },
    fields: runtimeSchema.fields,
    layoutSchema: runtimeSchema.layoutSchema,
    pages: [
      {
        pageCode: 'article_list',
        pageName: '文章管理',
        pageType: 'generatedCrud',
      },
    ],
  }
}

function buildTagCollectionDetail(): CollectionSchemaDetail {
  return {
    collection: {
      collectionName: 'article_tag',
      modelCode: 'article_tag',
      modelName: '文章标签',
      description: '用于维护文章标签、排序权重与启用状态。',
      pageCode: 'article_tag_list',
      sortOrder: 20,
      fieldCount: 5,
      updatedAt: '2026-05-01 11:00:00',
    },
    fields: [
      {
        fieldKey: 'name',
        fieldName: 'name',
        label: '标签名称',
        type: 'text',
        required: true,
        listConfig: { visible: true, width: 220, sortOrder: 10 },
        searchConfig: { visible: true, operator: 'like', component: 'input', sortOrder: 10 },
        formConfig: { visibleOnCreate: true, visibleOnEdit: true, component: 'input', groupKey: 'basic', span: 24, sortOrder: 10 },
        detailConfig: { visible: true, groupKey: 'basic', sortOrder: 10 },
      },
      {
        fieldKey: 'code',
        fieldName: 'code',
        label: '标签编码',
        type: 'text',
        required: true,
        listConfig: { visible: true, width: 200, sortOrder: 20 },
        formConfig: { visibleOnCreate: true, visibleOnEdit: true, component: 'input', groupKey: 'basic', span: 12, sortOrder: 20 },
        detailConfig: { visible: true, groupKey: 'basic', sortOrder: 20 },
      },
      {
        fieldKey: 'sortOrder',
        fieldName: 'sortOrder',
        label: '排序值',
        type: 'number',
        listConfig: { visible: true, width: 100, sortOrder: 30 },
        formConfig: { visibleOnCreate: true, visibleOnEdit: true, component: 'numberInput', groupKey: 'basic', span: 12, sortOrder: 30 },
        detailConfig: { visible: true, groupKey: 'basic', sortOrder: 30 },
      },
      {
        fieldKey: 'enabled',
        fieldName: 'enabled',
        label: '启用',
        type: 'boolean',
        listConfig: { visible: true, width: 100, sortOrder: 40 },
        formConfig: { visibleOnCreate: true, visibleOnEdit: true, component: 'switch', groupKey: 'basic', span: 12, sortOrder: 40 },
        detailConfig: { visible: true, groupKey: 'basic', sortOrder: 40 },
      },
      {
        fieldKey: 'remark',
        fieldName: 'remark',
        label: '备注',
        type: 'textarea',
        formConfig: { visibleOnCreate: true, visibleOnEdit: true, component: 'textarea', groupKey: 'basic', span: 24, sortOrder: 50 },
        detailConfig: { visible: true, groupKey: 'basic', sortOrder: 50 },
      },
    ],
    layoutSchema: {
      layoutMode: 'form',
      groups: [
        {
          groupKey: 'basic',
          title: '基础信息',
          layout: 'twoColumn',
          sortOrder: 10,
          fields: [
            { fieldKey: 'name', span: 24, sortOrder: 10 },
            { fieldKey: 'code', span: 12, sortOrder: 20 },
            { fieldKey: 'sortOrder', span: 12, sortOrder: 30 },
            { fieldKey: 'enabled', span: 12, sortOrder: 40 },
            { fieldKey: 'remark', span: 24, sortOrder: 50 },
          ],
        },
      ],
    },
    pages: [
      {
        pageCode: 'article_tag_list',
        pageName: '标签管理',
        pageType: 'generatedCrud',
      },
    ],
  }
}

const collectionDetails: Record<string, CollectionSchemaDetail> = {
  article: buildArticleCollectionDetail(),
  article_tag: buildTagCollectionDetail(),
}

export function isMenuGroupOccupiedInMock(groupId: string): boolean {
  return Object.values(collectionDetails).some((detail) => detail.collection.menuGroupId === groupId)
}

export function assignMenuGroupInMock(
  collectionNames: string[],
  menuGroupId: string | null,
): { ok: true } | { error: string } {
  for (const name of collectionNames) {
    if (!collectionDetails[name]) {
      return { error: `模型 ${name} 不存在` }
    }
  }
  const nextValue = menuGroupId === null || menuGroupId === '' ? undefined : String(menuGroupId).trim()
  for (const name of collectionNames) {
    collectionDetails[name].collection.menuGroupId = nextValue
    collectionDetails[name].collection.updatedAt = new Date().toISOString().slice(0, 19).replace('T', ' ')
  }
  return { ok: true }
}

function cloneFields(fields: RuntimeField[]) {
  return fields.map((field) => ({
    ...field,
    listConfig: field.listConfig ? { ...field.listConfig } : undefined,
    searchConfig: field.searchConfig ? { ...field.searchConfig } : undefined,
    formConfig: field.formConfig ? { ...field.formConfig } : undefined,
    detailConfig: field.detailConfig ? { ...field.detailConfig } : undefined,
    validationRules: field.validationRules ? [...field.validationRules] : undefined,
  }))
}

function refreshCollectionSummary(detail: CollectionSchemaDetail) {
  detail.collection.fieldCount = detail.fields.length
  detail.collection.updatedAt = new Date().toISOString().slice(0, 19).replace('T', ' ')
}

export function getCollectionSchemaSummariesMock(): CollectionSchemaSummary[] {
  return Object.values(collectionDetails)
    .map((item) => item.collection)
    .sort((a, b) => {
      const aSortOrder = typeof a.sortOrder === 'number' ? a.sortOrder : Number.MAX_SAFE_INTEGER
      const bSortOrder = typeof b.sortOrder === 'number' ? b.sortOrder : Number.MAX_SAFE_INTEGER

      if (aSortOrder !== bSortOrder) {
        return aSortOrder - bSortOrder
      }

      return String(a.collectionName || '').localeCompare(String(b.collectionName || ''))
    })
}

export function getCollectionSchemaDetailMock(collectionName: string): CollectionSchemaDetail | null {
  return collectionDetails[collectionName] ?? null
}

export function saveCollectionSchemaMock(input: {
  mode: 'create' | 'edit'
  collectionName: string
  modelCode: string
  modelName: string
  description?: string
  pageCode: string
  icon?: string
  menuGroupId?: string | null
  fields: ModelFieldDraft[]
}) {
  const current = collectionDetails[input.collectionName]

  if (input.mode === 'create' && current) {
    throw new Error(`集合「${input.collectionName}」对应的模型已存在，请更换集合名称`)
  }

  if (input.mode === 'edit' && !current) {
    throw new Error('当前编辑的模型不存在')
  }

  const mappedFields: RuntimeField[] = input.fields.map((field, index) => ({
    fieldKey: field.key,
    fieldName: field.key,
    label: field.title,
    type: field.type,
    required: field.required ?? false,
    listConfig: { visible: true, width: field.type === 'image' ? 120 : 180, sortOrder: (index + 1) * 10 },
    searchConfig: {
      visible: true,
      operator: field.type === 'text' || field.type === 'textarea' || field.type === 'richtext' ? 'like' : 'eq',
      component:
        field.type === 'boolean'
          ? 'boolean'
          : field.type === 'date'
            ? 'date'
            : field.type === 'datetime'
              ? 'datetime'
              : 'input',
      sortOrder: (index + 1) * 10,
    },
    formConfig: {
      visibleOnCreate: true,
      visibleOnEdit: true,
      component:
        field.type === 'textarea' || field.type === 'richtext'
          ? 'textarea'
          : field.type === 'boolean'
            ? 'boolean'
            : field.type === 'date'
              ? 'date'
              : field.type === 'datetime'
                ? 'datetime'
                : field.type === 'image'
                  ? 'image'
                  : field.type === 'file'
                    ? 'file'
                    : field.type === 'json'
                      ? 'json'
                      : 'text',
      groupKey: 'basic',
      span: field.type === 'textarea' || field.type === 'richtext' || field.type === 'json' ? 24 : 12,
      sortOrder: (index + 1) * 10,
    },
    detailConfig: { visible: true, groupKey: 'basic', sortOrder: (index + 1) * 10 },
    validationRules: field.required ? [{ ruleType: 'required', message: `请输入${field.title}` }] : [],
  }))
  const detail: CollectionSchemaDetail =
    current ?? {
      collection: {
        collectionName: input.collectionName,
        modelCode: input.modelCode,
        modelName: input.modelName,
        description: input.description ?? '',
        pageCode: input.pageCode,
        icon: input.icon,
        sortOrder: Object.keys(collectionDetails).length * 10 + 10,
        fieldCount: 0,
        updatedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
      },
      fields: mappedFields,
      layoutSchema: {
        layoutMode: 'form',
        groups: [
          {
            groupKey: 'basic',
            title: '基础信息',
            layout: 'twoColumn',
            sortOrder: 10,
            fields: mappedFields.map((field, index) => ({
              fieldKey: field.fieldKey,
              span: 24,
              sortOrder: (index + 1) * 10,
            })),
          },
        ],
      },
      pages: [
        {
          pageCode: input.pageCode,
          pageName: input.modelName,
          pageType: 'generatedCrud',
        },
      ],
    }

  const menuGroupIdProvided = Object.prototype.hasOwnProperty.call(input, 'menuGroupId')
  const nextMenuGroupId = menuGroupIdProvided
    ? input.menuGroupId === null || input.menuGroupId === '' || input.menuGroupId === undefined
      ? ''
      : String(input.menuGroupId).trim()
    : detail.collection.menuGroupId || ''

  detail.collection = {
    ...detail.collection,
    collectionName: input.collectionName,
    modelCode: input.modelCode,
    modelName: input.modelName,
    description: input.description ?? '',
    pageCode: input.pageCode,
    icon: input.icon ?? detail.collection.icon,
    menuGroupId: nextMenuGroupId || undefined,
    updatedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
  }
  detail.fields = mappedFields.length > 0 ? mappedFields : detail.fields
  detail.layoutSchema.groups[0].fields =
    mappedFields.length > 0
      ? mappedFields.map((field, index) => ({
          fieldKey: field.fieldKey,
          span: 24,
          sortOrder: (index + 1) * 10,
        }))
      : detail.layoutSchema.groups[0].fields

  collectionDetails[input.collectionName] = detail

  return detail
}

export function deleteCollectionSchemaMock(collectionName: string) {
  const current = collectionDetails[collectionName]

  if (!current) {
    return null
  }

  delete collectionDetails[collectionName]

  return {
    collectionName,
  }
}

export function sortCollectionSchemasMock(items: Array<{ collectionName: string; sortOrder: number }>) {
  items.forEach((item) => {
    const current = collectionDetails[item.collectionName]

    if (current) {
      current.collection.sortOrder = item.sortOrder
      current.collection.updatedAt = new Date().toISOString().slice(0, 19).replace('T', ' ')
    }
  })

  return {
    list: getCollectionSchemaSummariesMock(),
  }
}
