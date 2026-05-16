import type { SharedFieldMeta } from '@/runtime/fieldTypes/meta'

export interface FieldTypeGroup {
  key: string
  title: string
  description: string
  items: SharedFieldMeta[]
}

const GROUP_ORDER = ['basic', 'structured', 'relation', 'resource', 'geo']

const GROUP_META: Record<string, { title: string; description: string }> = {
  basic: {
    title: '基础字段',
    description: '文本、数值、日期、布尔等常用字段',
  },
  structured: {
    title: '结构字段',
    description: '枚举、数组、JSON 等结构化字段',
  },
  relation: {
    title: '关联字段',
    description: '单模型、多模型，以及单记录、多记录之间的关联关系',
  },
  resource: {
    title: '资源字段',
    description: '图片、文件、音视频等资源内容',
  },
  geo: {
    title: '地理字段',
    description: '位置与省市区地址相关字段',
  },
}

function resolveGroupKey(type: string) {
  if (['image', 'file', 'video', 'audio'].includes(type)) {
    return 'resource'
  }

  if (['location', 'address'].includes(type)) {
    return 'geo'
  }

  if (['relation', 'multiRelation', 'polyRelation', 'multiPolyRelation'].includes(type)) {
    return 'relation'
  }

  if (['enum', 'array', 'json'].includes(type)) {
    return 'structured'
  }

  return 'basic'
}

export function groupFieldTypes(items: SharedFieldMeta[]): FieldTypeGroup[] {
  const grouped = items.reduce<Record<string, SharedFieldMeta[]>>((acc, item) => {
    const groupKey = resolveGroupKey(item.value)
    if (!acc[groupKey]) {
      acc[groupKey] = []
    }
    acc[groupKey].push(item)
    return acc
  }, {})

  return GROUP_ORDER.filter((key) => grouped[key]?.length).map((key) => ({
    key,
    title: GROUP_META[key].title,
    description: GROUP_META[key].description,
    items: grouped[key],
  }))
}
