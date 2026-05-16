import { getSharedFieldMeta, sharedFieldMeta, type SharedFieldMeta } from '@/runtime/fieldTypes/meta'

export interface FieldTypeDefinition extends SharedFieldMeta {}

export const fieldTypeRegistry: readonly FieldTypeDefinition[] = sharedFieldMeta

export const fieldTypeMap = Object.fromEntries(fieldTypeRegistry.map((item) => [item.value, item])) as Record<
  string,
  FieldTypeDefinition
>

export const fieldTypeOptions = fieldTypeRegistry.map((item) => item.value)

export const modelCreateFieldTypeRegistry = fieldTypeRegistry.filter((item) => item.enabledInModelCreate)

export function getFieldTypeDefinition(type: string) {
  return fieldTypeMap[type] ?? getSharedFieldMeta('text')
}
