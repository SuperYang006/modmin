import type { RuntimeField } from '@/types/runtime'

export interface RelationOptionRecord {
  value: string
  label: string
  raw: Record<string, unknown>
}

export interface RelationDetailRecord {
  id: string
  label: string
  record?: Record<string, unknown> | null
  displayFields: string[]
}

interface PolyRelationValue {
  collection: string
  id: string
}

export function getCurrentRelationOption(value: string, options: RelationOptionRecord[]) {
  if (!value) {
    return undefined
  }

  const matched = options.find((item) => item.value === value)

  if (matched) {
    return matched
  }

  return {
    value,
    label: '当前值',
    raw: { _id: value },
  }
}

export function parsePolyRelationValue(value: unknown): PolyRelationValue {
  if (!value) {
    return {
      collection: '',
      id: '',
    }
  }

  if (typeof value === 'object' && value && !Array.isArray(value)) {
    const record = value as Record<string, unknown>
    return {
      collection: typeof record.collection === 'string' ? record.collection : '',
      id: typeof record.id === 'string' ? record.id : '',
    }
  }

  try {
    const parsed = JSON.parse(String(value))

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {
        collection: '',
        id: '',
      }
    }

    return {
      collection: typeof parsed.collection === 'string' ? parsed.collection : '',
      id: typeof parsed.id === 'string' ? parsed.id : '',
    }
  } catch {
    return {
      collection: '',
      id: '',
    }
  }
}

export function parseRelationManyIds(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter(Boolean)
  }

  if (typeof value !== 'string' || !value) {
    return []
  }

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.map((item) => String(item)).filter(Boolean) : [value]
  } catch {
    return value.split(',').map((item) => item.trim()).filter(Boolean)
  }
}

export function parseMultiPolyRelationValues(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .filter((item) => item && typeof item === 'object' && !Array.isArray(item))
      .map((item) => ({
        collection: typeof (item as Record<string, unknown>).collection === 'string' ? String((item as Record<string, unknown>).collection) : '',
        id: typeof (item as Record<string, unknown>).id === 'string' ? String((item as Record<string, unknown>).id) : '',
      }))
  }

  if (!value) {
    return []
  }

  try {
    const parsed = JSON.parse(String(value))
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed
      .filter((item) => item && typeof item === 'object' && !Array.isArray(item))
      .map((item) => ({
        collection: typeof item.collection === 'string' ? item.collection : '',
        id: typeof item.id === 'string' ? item.id : '',
      }))
  } catch {
    return []
  }
}

export function buildSingleRelationDetailRecord(
  option: RelationOptionRecord | undefined,
  displayFields: string[],
): RelationDetailRecord[] {
  if (!option) {
    return []
  }

  return [
    {
      id: option.value,
      label: option.label,
      record: option.raw,
      displayFields,
    },
  ]
}

export function buildRelationManyDetailRecords(
  values: string[],
  options: RelationOptionRecord[],
  displayFields: string[],
): RelationDetailRecord[] {
  const optionsByValue = new Map(options.map((item) => [item.value, item]))

  return values
    .map((currentValue) => {
      const option = optionsByValue.get(currentValue) || getCurrentRelationOption(currentValue, options)
      if (!option) {
        return null
      }

      return {
        id: option.value,
        label: option.label,
        record: option.raw,
        displayFields,
      }
    })
    .filter(Boolean) as RelationDetailRecord[]
}

export function buildMultiPolyRelationDetailRecords(
  relations: Array<{ collection: string; id: string }>,
  displayMap: Record<string, string[]>,
  optionsMap: Record<string, RelationOptionRecord[]>,
): RelationDetailRecord[] {
  return relations
    .map((relation) => {
      const displayFields = relation.collection ? displayMap[relation.collection] ?? [] : []
      const option = relation.collection ? getCurrentRelationOption(relation.id, optionsMap[relation.collection] ?? []) : undefined

      if (!option) {
        return null
      }

      return {
        id: option.value,
        label: option.label,
        record: option.raw,
        displayFields,
      }
    })
    .filter(Boolean) as RelationDetailRecord[]
}

export function getRelationDisplayFields(field: RuntimeField, collection?: string) {
  if (collection && field.polyRelationDisplayMap && typeof field.polyRelationDisplayMap === 'object') {
    return field.polyRelationDisplayMap[collection] ?? []
  }

  return Array.isArray(field.relationDisplayFields) ? field.relationDisplayFields : []
}
