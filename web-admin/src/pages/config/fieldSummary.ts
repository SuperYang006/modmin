import type { ModelFieldDraft } from '@/types/schema'

export function getFieldSummaryLines(field: ModelFieldDraft) {
  const lines: string[] = []

  lines.push(`字段名：${field.key}`)

  if (field.description) {
    lines.push(field.description)
  }

  if (field.type === 'location') {
    lines.push(
      `坐标系：${field.locationCoordinateSystem || 'gcj02'}，地址：${field.locationRequireAddress ? '必填' : '可选'}，地点名称：${
        field.locationRequireName ? '必填' : '可选'
      }`,
    )
    lines.push(`存储：${field.locationStorageMode || 'object'}`)
  }

  if (field.type === 'address') {
    lines.push(`粒度：${field.addressGranularity || 'district'}`)
    lines.push(`存储：${field.addressStorageMode || 'object'}`)
  }

  if (field.type === 'array') {
    const arrayParts = [
      field.itemType ? `元素类型：${field.itemType}` : '',
      typeof field.minItems === 'number' ? `最少项数：${field.minItems}` : '',
      typeof field.maxItems === 'number' ? `最多项数：${field.maxItems}` : '',
    ].filter(Boolean)

    if (arrayParts.length > 0) {
      lines.push(arrayParts.join('，'))
    }
  }

  if (field.type === 'relation' || field.type === 'multiRelation') {
    const relationParts = [
      field.relationModelCollection ? `关联模型：${field.relationModelCollection}` : '',
      Array.isArray(field.relationDisplayFields) && field.relationDisplayFields.length > 0
        ? `展示字段：${field.relationDisplayFields.join('、')}`
        : '',
      field.type === 'multiRelation' && (typeof field.minItems === 'number' || typeof field.maxItems === 'number')
        ? `关联数限制：${typeof field.minItems === 'number' ? field.minItems : 0} - ${typeof field.maxItems === 'number' ? field.maxItems : '∞'}`
        : '',
      field.type === 'multiRelation' ? '单模型（多记录）' : '单模型（单记录）',
    ].filter(Boolean)

    if (relationParts.length > 0) {
      lines.push(relationParts.join('，'))
    }
  }

  if (field.type === 'polyRelation') {
    const polyRelationParts = [
      Array.isArray(field.relationModelCollections) && field.relationModelCollections.length > 0
        ? `关联模型：${field.relationModelCollections.join('、')}`
        : '',
      field.polyRelationDisplayMap && typeof field.polyRelationDisplayMap === 'object'
        ? `展示配置：${Object.entries(field.polyRelationDisplayMap)
            .map(([collection, fields]) => `${collection}(${Array.isArray(fields) ? fields.join('/') : ''})`)
            .join('；')}`
        : '',
      '多模型（单记录）',
    ].filter(Boolean)

    if (polyRelationParts.length > 0) {
      lines.push(polyRelationParts.join('，'))
    }
  }

  if (field.type === 'multiPolyRelation') {
    const multiPolyRelationParts = [
      Array.isArray(field.relationModelCollections) && field.relationModelCollections.length > 0
        ? `关联模型：${field.relationModelCollections.join('、')}`
        : '',
      field.polyRelationDisplayMap && typeof field.polyRelationDisplayMap === 'object'
        ? `展示配置：${Object.entries(field.polyRelationDisplayMap)
            .map(([collection, fields]) => `${collection}(${Array.isArray(fields) ? fields.join('/') : ''})`)
            .join('；')}`
        : '',
      field.polyRelationLimitMap && typeof field.polyRelationLimitMap === 'object'
        ? `关联数限制：${Object.entries(field.polyRelationLimitMap)
            .map(([collection, limit]) => {
              const minItems = limit && typeof limit === 'object' && typeof limit.minItems === 'number' ? limit.minItems : 0
              const maxItems = limit && typeof limit === 'object' && typeof limit.maxItems === 'number' ? limit.maxItems : '∞'
              return `${collection}(${minItems}-${maxItems})`
            })
            .join('；')}`
        : '',
      '多模型（多记录）',
    ].filter(Boolean)

    if (multiPolyRelationParts.length > 0) {
      lines.push(multiPolyRelationParts.join('，'))
    }
  }

  if (['image', 'file', 'video', 'audio'].includes(field.type)) {
    const mediaParts = [
      field.allowMultiple ? '允许多项' : '单项',
      field.assetStorageMode === 'url' ? 'URL 存储' : '对象存储',
      typeof field.maxFileSizeMB === 'number' ? `大小上限：${field.maxFileSizeMB}MB` : '',
      Array.isArray(field.accept) && field.accept.length > 0 ? `类型数：${field.accept.length}` : '',
    ].filter(Boolean)

    if (mediaParts.length > 0) {
      lines.push(mediaParts.join('，'))
    }
  }

  if (field.type === 'enum' && field.enumOptions?.length) {
    lines.push(`选项数：${field.enumOptions.length}`)
  }

  if (field.type === 'json') {
    const jsonTypeLabel =
      field.jsonValueType === 'object'
        ? '仅对象'
        : field.jsonValueType === 'array'
          ? '仅数组'
          : '任意 JSON'

    lines.push(`值类型：${jsonTypeLabel}`)
  }

  return lines
}
