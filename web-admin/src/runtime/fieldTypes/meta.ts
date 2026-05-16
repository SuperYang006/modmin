import { rawSharedFieldMetaConfig } from '@/runtime/fieldTypes/metaSource'

export interface FieldCapabilityMap {
  minLength?: boolean
  maxLength?: boolean
  minValue?: boolean
  maxValue?: boolean
  minItems?: boolean
  maxItems?: boolean
  itemType?: boolean
  jsonValueType?: boolean
  enumOptions?: boolean
  enumValueType?: boolean
  accept?: boolean
  maxFileSizeMB?: boolean
  allowMultiple?: boolean
  assetStorageMode?: boolean
  sortable?: boolean
  addressGranularity?: boolean
  addressStorageMode?: boolean
  addressFieldMapping?: boolean
  locationCoordinateSystem?: boolean
  locationRequireAddress?: boolean
  locationRequireName?: boolean
  locationStorageMode?: boolean
  locationFieldMapping?: boolean
  relationModelCollection?: boolean
  relationModelCollections?: boolean
  relationDisplayFields?: boolean
  polyRelationDisplayMap?: boolean
  polyRelationLimitMap?: boolean
  relationRecordsUnique?: boolean
}

export interface SharedFieldMeta {
  value: string
  label: string
  enabledInModelCreate: boolean
  searchRenderer: string
  formRenderer: string
  displayRenderer: string
  supports: FieldCapabilityMap
  defaultAccept?: string[]
}

export const sharedFieldMeta = (rawSharedFieldMetaConfig.fields ?? []) as readonly SharedFieldMeta[]

export const sharedFieldMetaMap = Object.fromEntries(sharedFieldMeta.map((item) => [item.value, item])) as Record<
  string,
  SharedFieldMeta
>

export function getSharedFieldMeta(type: string) {
  return sharedFieldMetaMap[type] ?? sharedFieldMetaMap.text
}
