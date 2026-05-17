import type { PageRuntimeSchema, RuntimeField } from '@/types/runtime'

const SEARCHABLE_TYPES = new Set(['text', 'textarea', 'richtext', 'markdown', 'number', 'boolean', 'date', 'datetime', 'enum'])
const SORTABLE_TYPES = new Set(['text', 'textarea', 'richtext', 'markdown', 'number', 'boolean', 'date', 'datetime', 'enum'])

function getDefaultListWidth(type: string) {
  if (type === 'image') {
    return 92
  }

  return 180
}

function getDefaultSearchOperator(type: string) {
  if (type === 'text' || type === 'textarea' || type === 'richtext' || type === 'markdown') {
    return 'like'
  }

  return 'eq'
}

function getDefaultSearchComponent(type: string) {
  if (type === 'boolean') {
    return 'boolean'
  }

  if (type === 'date') {
    return 'date'
  }

  if (type === 'datetime') {
    return 'datetime'
  }

  if (type === 'enum') {
    return 'select'
  }

  return 'input'
}

function getDefaultFormComponent(type: string) {
  if (type === 'textarea' || type === 'richtext' || type === 'markdown') {
    return 'textarea'
  }

  if (type === 'number') {
    return 'number'
  }

  if (type === 'boolean') {
    return 'boolean'
  }

  if (type === 'date') {
    return 'date'
  }

  if (type === 'datetime') {
    return 'datetime'
  }

  if (type === 'image') {
    return 'image'
  }

  if (type === 'file') {
    return 'file'
  }

  if (type === 'video') {
    return 'video'
  }

  if (type === 'audio') {
    return 'audio'
  }

  if (type === 'enum') {
    return 'select'
  }

  if (type === 'relation') {
    return 'relationOne'
  }

  if (type === 'multiRelation') {
    return 'relationMany'
  }

  if (type === 'polyRelation') {
    return 'polyRelation'
  }

  if (type === 'multiPolyRelation') {
    return 'multiPolyRelation'
  }

  if (type === 'array') {
    return 'array'
  }

  if (type === 'json') {
    return 'json'
  }

  if (type === 'location') {
    return 'json'
  }

  if (type === 'address') {
    return 'json'
  }

  return 'text'
}

export function normalizePageRuntimeSchema(schema: PageRuntimeSchema): PageRuntimeSchema {
  const fields = [...schema.fields].map((field, index) => {
    const sortOrder = (index + 1) * 10
    const hidden = field.hidden ?? false
    const searchVisible = SEARCHABLE_TYPES.has(field.type) && !hidden
    const sortable = SORTABLE_TYPES.has(field.type) && field.sortable === true

    return {
      ...field,
      enumOptions: Array.isArray(field.enumOptions) ? field.enumOptions : [],
      accept: Array.isArray(field.accept) ? field.accept : [],
      allowMultiple: field.allowMultiple ?? false,
      assetStorageMode: (field.assetStorageMode === 'url' ? 'url' : 'object') as RuntimeField['assetStorageMode'],
      readonly:
        field.readonly === true ||
        field.fieldKey === '_id' ||
        field.fieldKey.startsWith('modmin_'),
      sortable,
      listConfig: {
        visible: field.listConfig?.visible ?? !hidden,
        width: field.listConfig?.width ?? getDefaultListWidth(field.type),
        fixed: field.listConfig?.fixed,
        ellipsis: field.listConfig?.ellipsis,
        sortOrder,
      },
      searchConfig: {
        visible: field.searchConfig?.visible ?? searchVisible,
        operator: field.searchConfig?.operator ?? getDefaultSearchOperator(field.type),
        component: field.searchConfig?.component ?? getDefaultSearchComponent(field.type),
        sortOrder,
      },
      formConfig: {
        visibleOnCreate: field.formConfig?.visibleOnCreate ?? true,
        visibleOnEdit: field.formConfig?.visibleOnEdit ?? true,
        readonlyOnCreate: field.formConfig?.readonlyOnCreate ?? field.fieldKey === '_id',
        readonlyOnEdit: field.formConfig?.readonlyOnEdit ?? (field.fieldKey === '_id' || field.fieldKey.startsWith('modmin_')),
        component: field.formConfig?.component ?? getDefaultFormComponent(field.type),
        groupKey: field.formConfig?.groupKey ?? 'basic',
        span:
          field.formConfig?.span ??
          (
            field.type === 'textarea' ||
            field.type === 'richtext' ||
            field.type === 'markdown' ||
            field.type === 'json' ||
            field.type === 'location' ||
            field.type === 'address' ||
            field.type === 'multiRelation' ||
            field.type === 'multiPolyRelation' ||
            field.type === 'array'
              ? 24
              : 12
          ),
        sortOrder,
      },
      detailConfig: {
        visible: field.detailConfig?.visible ?? true,
        groupKey: field.detailConfig?.groupKey ?? 'basic',
        sortOrder,
      },
    }
  })
  const fieldByKey = new Map(fields.map((field) => [field.fieldKey, field]))
  const searchFieldKeys = Array.isArray(schema.systemFieldSettings?.searchFieldKeys)
    ? schema.systemFieldSettings.searchFieldKeys.filter((fieldKey: string) => typeof fieldKey === 'string' && fieldKey.trim().length > 0)
    : []
  const searchFields = searchFieldKeys
    .map((fieldKey: string) => fieldByKey.get(fieldKey))
    .filter((field): field is (typeof fields)[number] => Boolean(field))
    .filter((field) => field.searchConfig?.visible)

  return {
    ...schema,
    systemFieldSettings: schema.systemFieldSettings
      ? {
          showIdInList: schema.systemFieldSettings.showIdInList !== false,
          showCmsCreateTime: schema.systemFieldSettings.showCmsCreateTime !== false,
          showCmsUpdateTime: schema.systemFieldSettings.showCmsUpdateTime === true,
          defaultSortField:
            schema.systemFieldSettings.defaultSortField === 'modmin_updateTime' ? 'modmin_updateTime' : 'modmin_createTime',
          defaultSortOrder: schema.systemFieldSettings.defaultSortOrder === 'asc' ? 'asc' : 'desc',
          searchFieldKeys,
        }
      : {
          showIdInList: true,
          showCmsCreateTime: true,
          showCmsUpdateTime: false,
          defaultSortField: 'modmin_createTime',
          defaultSortOrder: 'desc',
          searchFieldKeys: [],
    },
    searchFields,
    fields,
  }
}
