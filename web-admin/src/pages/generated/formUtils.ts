import dayjs from 'dayjs'
import type { RuntimeField } from '@/types/runtime'

export type RuntimeFormMode = 'create' | 'edit'

export function getInitialFieldValue(field: RuntimeField) {
  const defaultValue = field.defaultValue

  if (defaultValue !== undefined && defaultValue !== '') {
    return String(defaultValue)
  }

  if (field.type === 'boolean') {
    return 'false'
  }

  return ''
}

export function buildInitialCreateValues(fields: RuntimeField[]) {
  return fields.reduce<Record<string, unknown>>((acc, field) => {
    if (field.formConfig?.visibleOnCreate) {
      acc[field.fieldKey] = getInitialFieldValue(field)
    }
    return acc
  }, {})
}

export function serializeDateFieldValue(field: RuntimeField, rawValue: unknown, boundary?: 'start' | 'end') {
  if (rawValue === '' || rawValue === null || rawValue === undefined) {
    return rawValue
  }

  if (field.type !== 'date' && field.type !== 'datetime') {
    return rawValue
  }

  let parsed: dayjs.Dayjs

  if (typeof rawValue === 'number') {
    parsed =
      field.dateStorageFormat === 'timestamp'
        ? dayjs(rawValue * 1000)
        : field.dateStorageFormat === 'timestampMs'
          ? dayjs(rawValue)
          : dayjs(rawValue < 1e11 ? rawValue * 1000 : rawValue)
  } else {
    const text = String(rawValue).trim()

    if (/^\d+$/.test(text)) {
      const numericValue = Number(text)
      parsed =
        field.dateStorageFormat === 'timestamp'
          ? dayjs(numericValue * 1000)
          : field.dateStorageFormat === 'timestampMs'
            ? dayjs(numericValue)
            : dayjs(text.length <= 10 || numericValue < 1e11 ? numericValue * 1000 : numericValue)
    } else {
      parsed = dayjs(text)
    }
  }

  if (!parsed.isValid()) {
    return rawValue
  }

  const resolved =
    field.type === 'date'
      ? boundary === 'start'
        ? parsed.startOf('day')
        : boundary === 'end'
          ? parsed.endOf('day')
          : parsed.startOf('day')
      : parsed

  if (field.dateStorageFormat === 'timestamp') {
    return resolved.unix()
  }

  if (field.dateStorageFormat === 'timestampMs') {
    return resolved.valueOf()
  }

  if (field.type === 'date') {
    return resolved.format('YYYY-MM-DD')
  }

  return resolved.format('YYYY-MM-DD HH:mm:ss')
}

export function buildSubmittedRecord(
  fields: RuntimeField[],
  values: Record<string, unknown>,
  initialValues: Record<string, unknown>,
  mode: RuntimeFormMode,
) {
  return fields.reduce<Record<string, unknown>>((acc, field) => {
    const rawValue = values[field.fieldKey]
    const initialValue = initialValues[field.fieldKey]
    const shouldSerializeDateField = mode === 'create' || rawValue !== initialValue

    acc[field.fieldKey] =
      (field.type === 'date' || field.type === 'datetime') && shouldSerializeDateField
        ? serializeDateFieldValue(field, rawValue)
        : rawValue
    return acc
  }, {})
}

export function validateRuntimeForm(fields: RuntimeField[], values: Record<string, unknown>) {
  const nextErrors: Record<string, string> = {}

  function getLengthConstraint(field: RuntimeField, ruleType: 'minLength' | 'maxLength') {
    const directValue = ruleType === 'minLength' ? field.minLength : field.maxLength
    if (typeof directValue === 'number') {
      return directValue
    }

    const rule = field.validationRules?.find((item) => item.ruleType === ruleType && typeof item.value === 'number')
    return typeof rule?.value === 'number' ? rule.value : null
  }

  function getNumericConstraint(field: RuntimeField, ruleType: 'minValue' | 'maxValue') {
    const directValue = ruleType === 'minValue' ? field.minValue : field.maxValue
    if (typeof directValue === 'number') {
      return directValue
    }

    const rule = field.validationRules?.find((item) => item.ruleType === ruleType && typeof item.value === 'number')
    return typeof rule?.value === 'number' ? rule.value : null
  }

  function parseMultiRelationValue(value: unknown) {
    if (Array.isArray(value)) {
      return value
    }

    if (typeof value === 'string' && value.trim()) {
      try {
        const parsed = JSON.parse(value)
        return Array.isArray(parsed) ? parsed : null
      } catch {
        return null
      }
    }

    return null
  }

  function parseMultiPolyRelationValue(value: unknown) {
    if (Array.isArray(value)) {
      return value
    }

    if (typeof value === 'string' && value.trim()) {
      try {
        const parsed = JSON.parse(value)
        return Array.isArray(parsed) ? parsed : null
      } catch {
        return null
      }
    }

    return null
  }

  for (const field of fields) {
    const rawValue = values[field.fieldKey]
    const value =
      field.type === 'boolean'
        ? rawValue === true
          ? 'true'
          : rawValue === false
            ? 'false'
            : typeof rawValue === 'string'
              ? rawValue
              : ''
        : typeof rawValue === 'string'
          ? rawValue
          : ''
    const hasDateTimeValue =
      (field.type === 'date' || field.type === 'datetime') &&
      (
        rawValue instanceof Date ||
        typeof rawValue === 'number' ||
        (typeof rawValue === 'string' && rawValue.trim().length > 0)
      )
    const hasNumberValue =
      field.type === 'number' &&
      (
        typeof rawValue === 'number' ||
        (typeof rawValue === 'string' && rawValue.trim().length > 0)
      )
    const rules = field.validationRules ?? []
    const isAssetField = field.type === 'image' || field.type === 'file' || field.type === 'video' || field.type === 'audio'
    const isComplexValueField = field.type === 'multiRelation' || field.type === 'multiPolyRelation' || field.type === 'array' || field.type === 'json'
    const shouldValidateEmptyCollection =
      typeof field.minItems === 'number' &&
      field.minItems > 0 &&
      (field.type === 'multiRelation' || field.type === 'multiPolyRelation' || field.type === 'array' || (isAssetField && field.allowMultiple === true))
    const hasComplexValue =
      Array.isArray(rawValue) ||
      (typeof rawValue === 'object' && rawValue !== null) ||
      (typeof rawValue === 'string' && rawValue.trim())
    const minLength = getLengthConstraint(field, 'minLength')
    const maxLength = getLengthConstraint(field, 'maxLength')

    for (const rule of rules) {
      if (rule.ruleType === 'required') {
        if (isComplexValueField) {
          if (!hasComplexValue) {
            nextErrors[field.fieldKey] = rule.message
            break
          }
        } else if (field.type === 'date' || field.type === 'datetime') {
          if (!hasDateTimeValue) {
            nextErrors[field.fieldKey] = rule.message
            break
          }
        } else if (field.type === 'number') {
          if (!hasNumberValue) {
            nextErrors[field.fieldKey] = rule.message
            break
          }
        } else if (!value.trim()) {
          nextErrors[field.fieldKey] = rule.message
          break
        }
      }

      if (rule.ruleType === 'minLength' || rule.ruleType === 'maxLength') continue
    }

    if (nextErrors[field.fieldKey]) {
      continue
    }

    if (maxLength !== null && value.length > maxLength) {
      nextErrors[field.fieldKey] = `${field.label} 最多支持 ${maxLength} 个字符`
      continue
    }

    if (minLength !== null && value.length < minLength) {
      nextErrors[field.fieldKey] = `${field.label} 至少需要 ${minLength} 个字符`
      continue
    }

    if (nextErrors[field.fieldKey]) {
      continue
    }

    if (
      field.type === 'multiRelation' ||
      field.type === 'multiPolyRelation' ||
      field.type === 'array' ||
      field.type === 'json'
    ) {
      const hasValue =
        Array.isArray(rawValue) ||
        (typeof rawValue === 'object' && rawValue !== null) ||
        (typeof rawValue === 'string' && rawValue.trim())

      if (!hasValue) {
        if (shouldValidateEmptyCollection) {
          if (field.type === 'array') {
            nextErrors[field.fieldKey] = `${field.label} 至少需要 ${field.minItems} 项`
          } else {
            nextErrors[field.fieldKey] = `${field.label} 至少需要 ${field.minItems} 条关联`
          }
        }
        continue
      }
    }

    if ((field.type === 'date' || field.type === 'datetime') && !hasDateTimeValue) {
      continue
    }

    if (field.type === 'number' && !hasNumberValue) {
      continue
    }

    if (!value.trim() && !isComplexValueField && field.type !== 'number') {
      if (shouldValidateEmptyCollection && isAssetField) {
        nextErrors[field.fieldKey] = `${field.label} 至少需要上传 ${field.minItems} 个资源`
      }
      continue
    }

    if (field.type === 'number') {
      const numericValue = typeof rawValue === 'number' ? rawValue : Number(value)
      const minValue = getNumericConstraint(field, 'minValue')
      const maxValue = getNumericConstraint(field, 'maxValue')

      if (Number.isNaN(numericValue)) {
        nextErrors[field.fieldKey] = `${field.label} 必须是数字`
        continue
      }

      if (minValue !== null && numericValue < minValue) {
        nextErrors[field.fieldKey] = `${field.label} 不能小于 ${minValue}`
        continue
      }

      if (maxValue !== null && numericValue > maxValue) {
        nextErrors[field.fieldKey] = `${field.label} 不能大于 ${maxValue}`
        continue
      }
    }

    if (field.type === 'boolean' && value !== 'true' && value !== 'false') {
      nextErrors[field.fieldKey] = `${field.label} 必须是布尔值`
      continue
    }

    if ((field.type === 'date' || field.type === 'datetime') && !dayjs(value).isValid()) {
      nextErrors[field.fieldKey] = `${field.label} 必须是合法日期`
      continue
    }

    if (field.type === 'json') {
      if (Array.isArray(rawValue) || (typeof rawValue === 'object' && rawValue !== null)) {
        continue
      }

      try {
        JSON.parse(value)
      } catch {
        nextErrors[field.fieldKey] = `${field.label} 必须是合法 JSON`
      }
      continue
    }

    if (field.type === 'polyRelation') {
      if (!value.trim()) {
        continue
      }

      try {
        const parsed = JSON.parse(value)

        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          nextErrors[field.fieldKey] = `${field.label} 必须是合法关联对象`
          continue
        }

        const collection = typeof parsed.collection === 'string' ? parsed.collection.trim() : ''
        const id = typeof parsed.id === 'string' ? parsed.id.trim() : ''
        const allowedCollections = Array.isArray(field.relationModelCollections) ? field.relationModelCollections : []

        if (!collection || !id) {
          nextErrors[field.fieldKey] = `${field.label} 必须同时包含 collection 和 id`
          continue
        }

        if (allowedCollections.length > 0 && !allowedCollections.includes(collection)) {
          nextErrors[field.fieldKey] = `${field.label} 的关联模型不在允许范围内`
        }
      } catch {
        nextErrors[field.fieldKey] = `${field.label} 必须是合法关联对象`
      }
      continue
    }

    if (field.type === 'relation') {
      if (!value.trim()) {
        nextErrors[field.fieldKey] = `${field.label} 必须是有效关联 ID`
      }
      continue
    }

    if (field.type === 'array') {
      let parsedItems: unknown[] | null = null
      if (Array.isArray(rawValue)) {
        parsedItems = rawValue
      } else if (typeof rawValue === 'string' && rawValue.trim()) {
        try {
          const parsed = JSON.parse(rawValue)
          parsedItems = Array.isArray(parsed) ? parsed : null
        } catch {
          parsedItems = null
        }
      }

      if (!parsedItems) {
        nextErrors[field.fieldKey] = `${field.label} 必须是数组`
        continue
      }

      const itemType = typeof field.itemType === 'string' ? field.itemType : 'text'
      if (itemType !== 'boolean') {
        const emptyIndex = parsedItems.findIndex((item) => {
          if (item === null || item === undefined) {
            return true
          }
          if (itemType === 'number') {
            return typeof item === 'number'
              ? !Number.isFinite(item)
              : !Number.isFinite(Number(String(item).trim()))
          }
          return typeof item === 'string' ? item.trim() === '' : String(item) === ''
        })
        if (emptyIndex >= 0) {
          nextErrors[field.fieldKey] = `${field.label} 第 ${emptyIndex + 1} 项不能为空`
          continue
        }
      }

      if (typeof field.minItems === 'number' && parsedItems.length < field.minItems) {
        nextErrors[field.fieldKey] = `${field.label} 至少需要 ${field.minItems} 项`
        continue
      }

      if (typeof field.maxItems === 'number' && parsedItems.length > field.maxItems) {
        nextErrors[field.fieldKey] = `${field.label} 最多支持 ${field.maxItems} 项`
      }
      continue
    }

    if (field.type === 'multiRelation') {
      const parsed = parseMultiRelationValue(rawValue)

      if (!parsed) {
        nextErrors[field.fieldKey] = `${field.label} 必须是合法关联数组`
        continue
      }

      const normalizedItems = parsed.map((item) => String(item).trim()).filter(Boolean)

      if (typeof field.minItems === 'number' && normalizedItems.length < field.minItems) {
        nextErrors[field.fieldKey] = `${field.label} 至少需要 ${field.minItems} 条关联`
        continue
      }

      if (typeof field.maxItems === 'number' && normalizedItems.length > field.maxItems) {
        nextErrors[field.fieldKey] = `${field.label} 最多支持 ${field.maxItems} 条关联`
      }
      continue
    }

    if (field.type === 'multiPolyRelation') {
      const parsed = parseMultiPolyRelationValue(rawValue)

      if (!parsed) {
        nextErrors[field.fieldKey] = `${field.label} 必须是合法关联数组`
        continue
      }

      const allowedCollections = Array.isArray(field.relationModelCollections) ? field.relationModelCollections : []
      const uniqueSet = new Set<string>()
      const groupedCount: Record<string, number> = {}

      for (const item of parsed) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          nextErrors[field.fieldKey] = `${field.label} 中每一项都必须是对象`
          break
        }

        const collection = typeof item.collection === 'string' ? item.collection.trim() : ''
        const id = typeof item.id === 'string' ? item.id.trim() : ''

        if (!collection || !id) {
          nextErrors[field.fieldKey] = `${field.label} 中每一项都必须包含 collection 和 id`
          break
        }

        if (allowedCollections.length > 0 && !allowedCollections.includes(collection)) {
          nextErrors[field.fieldKey] = `${field.label} 中存在不允许的关联模型`
          break
        }

        const uniqueKey = `${collection}::${id}`
        if (field.relationRecordsUnique !== false && uniqueSet.has(uniqueKey)) {
          nextErrors[field.fieldKey] = `${field.label} 不能包含重复关联记录`
          break
        }

        uniqueSet.add(uniqueKey)
        groupedCount[collection] = (groupedCount[collection] || 0) + 1
      }

      const limitMap = field.polyRelationLimitMap && typeof field.polyRelationLimitMap === 'object' ? field.polyRelationLimitMap : {}

      for (const collection of allowedCollections) {
        const currentCount = groupedCount[collection] || 0
        const limit = limitMap[collection] && typeof limitMap[collection] === 'object' ? limitMap[collection] : {}

        if (typeof limit.minItems === 'number' && currentCount < limit.minItems) {
          nextErrors[field.fieldKey] = `${field.label} 中模型 ${collection} 至少需要 ${limit.minItems} 条关联`
          break
        }

        if (typeof limit.maxItems === 'number' && currentCount > limit.maxItems) {
          nextErrors[field.fieldKey] = `${field.label} 中模型 ${collection} 最多支持 ${limit.maxItems} 条关联`
          break
        }
      }
    }
  }

  return nextErrors
}
