import type { ModelFieldDraft } from '@/types/schema'
import { sharedFieldMeta } from '@/runtime/fieldTypes/meta'
import {
  buildAddressDefaultValue,
  buildLocationStoredDefaultValue,
  parseAddressDefaultValue,
  parseLocationDefaultValue,
} from '@/pages/config/fieldValueBuilders'
import { validateStructuredDefaultValue } from '@/pages/config/fieldValueValidators'

export interface FieldConfigModalState {
  key: string
  title: string
  type: string
  description: string
  defaultValue: string
  minLength: string
  maxLength: string
  minValue: string
  maxValue: string
  minItems: string
  maxItems: string
  itemType: string
  jsonValueType: 'any' | 'object' | 'array'
  dateStorageFormat: 'string' | 'timestamp' | 'timestampMs'
  addressGranularity: 'province' | 'city' | 'district'
  addressStorageMode: 'object' | 'flat'
  addressProvinceField: string
  addressCityField: string
  addressDistrictField: string
  locationCoordinateSystem: 'gcj02' | 'wgs84'
  locationRequireAddress: boolean
  locationRequireName: boolean
  locationStorageMode: 'object' | 'flat'
  locationLngField: string
  locationLatField: string
  locationAddressField: string
  locationNameField: string
  relationModelCollection: string
  relationModelCollections: string[]
  relationDisplayFields: string[]
  polyRelationDisplayMap: Record<string, string[]>
  polyRelationLimitMap: Record<string, { minItems: string; maxItems: string }>
  relationRecordsUnique: boolean
  locationLng: string
  locationLat: string
  locationAddress: string
  locationName: string
  addressPath: string[]
  enumOptions: Array<{ label: string; value: string }>
  enumValueType: 'string' | 'number'
  acceptList: string[]
  maxFileSizeMB: string
  allowMultiple: boolean
  assetStorageMode: 'object' | 'url'
  required: boolean
  hidden: boolean
  readonlyOnCreate: boolean
  readonlyOnEdit: boolean
  sortable: boolean
  sortDirection: 'asc' | 'desc'
}

export function createEmptyEnumOption() {
  return { label: '', value: '' }
}

function pickTypesBySupport(key: keyof NonNullable<(typeof sharedFieldMeta)[number]['supports']>) {
  return sharedFieldMeta.filter((item) => item.supports?.[key]).map((item) => item.value)
}

export const TEXT_LIKE_TYPES = sharedFieldMeta
  .filter((item) => item.supports?.minLength || item.supports?.maxLength)
  .map((item) => item.value)
export const NUMBER_TYPES = pickTypesBySupport('minValue')
export const ENUM_TYPES = pickTypesBySupport('enumOptions')
export const ARRAY_TYPES = pickTypesBySupport('itemType')
export const MEDIA_TYPES = pickTypesBySupport('assetStorageMode')
export const ITEM_COUNT_TYPES = sharedFieldMeta
  .filter((item) => item.supports?.minItems || item.supports?.maxItems)
  .map((item) => item.value)
export const MULTI_VALUE_TYPES = pickTypesBySupport('allowMultiple')
export const LARGE_EDITOR_TYPES = ['textarea', 'richtext', 'markdown', 'json', 'array', 'location', 'address']
export const DATE_TYPES = ['date', 'datetime']
export const LOCATION_TYPES = ['location']
export const ADDRESS_TYPES = ['address']
export const RELATION_TYPES = sharedFieldMeta
  .filter((item) => item.supports?.relationModelCollection || item.supports?.relationDisplayFields)
  .map((item) => item.value)
export const POLY_RELATION_TYPES = sharedFieldMeta
  .filter((item) => item.supports?.relationModelCollections)
  .map((item) => item.value)
export const ALL_RELATION_TYPES = [...RELATION_TYPES, ...POLY_RELATION_TYPES]
export const SORTABLE_TYPES = ['text', 'textarea', 'richtext', 'markdown', 'number', 'boolean', 'date', 'datetime', 'enum']
export const RESERVED_SYSTEM_FIELD_KEYS = [
  '_id',
  'modmin_createTime',
  'modmin_createBy',
  'modmin_updateTime',
  'modmin_updateBy',
  'modmin_isDeleted',
  'modmin_deleteTime',
  'modmin_deleteBy',
]

export function normalizeFieldTypeForModelEditor(type: string) {
  if (type === 'relationOne') {
    return 'relation'
  }

  if (type === 'relationMany') {
    return 'multiRelation'
  }

  return type
}

export function buildFieldConfigModalState(type = 'text', field?: ModelFieldDraft): FieldConfigModalState {
  const normalizedType = normalizeFieldTypeForModelEditor(type)
  const locationDefaultValue = parseLocationDefaultValue(field?.defaultValue)
  const addressDefaultPath = parseAddressDefaultValue(field?.defaultValue)
  const legacyRelationDisplayField =
    typeof (field as ModelFieldDraft & { relationDisplayField?: string } | undefined)?.relationDisplayField === 'string'
      ? (field as ModelFieldDraft & { relationDisplayField?: string }).relationDisplayField?.trim() || ''
      : ''

  return {
    key: field?.key ?? '',
    title: field?.title ?? '',
    type: normalizedType,
    description: field?.description ?? '',
    defaultValue: ALL_RELATION_TYPES.includes(normalizedType) ? '' : field?.defaultValue ?? '',
    minLength: field?.minLength !== undefined ? String(field.minLength) : '',
    maxLength: field?.maxLength !== undefined ? String(field.maxLength) : '',
    minValue: field?.minValue !== undefined ? String(field.minValue) : '',
    maxValue: field?.maxValue !== undefined ? String(field.maxValue) : '',
    minItems: field?.minItems !== undefined ? String(field.minItems) : '',
    maxItems: field?.maxItems !== undefined ? String(field.maxItems) : '',
    itemType: field?.itemType ?? 'text',
    jsonValueType: field?.jsonValueType ?? 'any',
    dateStorageFormat: field?.dateStorageFormat ?? 'string',
    addressGranularity: field?.addressGranularity ?? 'district',
    addressStorageMode: field?.addressStorageMode ?? 'object',
    addressProvinceField: field?.addressProvinceField ?? '',
    addressCityField: field?.addressCityField ?? '',
    addressDistrictField: field?.addressDistrictField ?? '',
    locationCoordinateSystem: field?.locationCoordinateSystem ?? 'gcj02',
    locationRequireAddress: field?.locationRequireAddress ?? false,
    locationRequireName: field?.locationRequireName ?? false,
    locationStorageMode: field?.locationStorageMode ?? 'object',
    locationLngField: field?.locationLngField ?? '',
    locationLatField: field?.locationLatField ?? '',
    locationAddressField: field?.locationAddressField ?? '',
    locationNameField: field?.locationNameField ?? '',
    relationModelCollection: field?.relationModelCollection ?? '',
    relationModelCollections: Array.isArray(field?.relationModelCollections) ? field.relationModelCollections.map((item) => String(item)) : [],
    relationDisplayFields: Array.isArray(field?.relationDisplayFields)
      ? field.relationDisplayFields.map((item) => String(item))
      : legacyRelationDisplayField
        ? [legacyRelationDisplayField]
        : [],
    polyRelationDisplayMap:
      field?.polyRelationDisplayMap && typeof field.polyRelationDisplayMap === 'object'
        ? Object.fromEntries(
            Object.entries(field.polyRelationDisplayMap).map(([collection, fields]) => [
              collection,
              Array.isArray(fields) ? fields.map((item) => String(item)) : [],
            ]),
          )
        : {},
    polyRelationLimitMap:
      field?.polyRelationLimitMap && typeof field.polyRelationLimitMap === 'object'
        ? Object.fromEntries(
            Object.entries(field.polyRelationLimitMap).map(([collection, limit]) => [
              collection,
              {
                minItems:
                  limit && typeof limit === 'object' && limit.minItems !== undefined ? String(limit.minItems) : '',
                maxItems:
                  limit && typeof limit === 'object' && limit.maxItems !== undefined ? String(limit.maxItems) : '',
              },
            ]),
          )
        : {},
    relationRecordsUnique: field?.relationRecordsUnique ?? true,
    locationLng: locationDefaultValue.lng,
    locationLat: locationDefaultValue.lat,
    locationAddress: locationDefaultValue.address,
    locationName: locationDefaultValue.name,
    addressPath: addressDefaultPath,
    enumOptions:
      Array.isArray(field?.enumOptions) && field.enumOptions.length > 0
        ? field.enumOptions.map((item) => ({
            label: item.label ?? '',
            value: item.value ?? '',
          }))
        : [createEmptyEnumOption()],
    enumValueType: field?.enumValueType === 'number' ? 'number' : 'string',
    acceptList: Array.isArray(field?.accept) && field.accept.length > 0 ? field.accept : getDefaultAcceptByType(normalizedType),
    maxFileSizeMB: field?.maxFileSizeMB !== undefined ? String(field.maxFileSizeMB) : '',
    allowMultiple: field?.allowMultiple ?? false,
    assetStorageMode: field?.assetStorageMode === 'url' ? 'url' : 'object',
    required: field?.required ?? false,
    hidden: field?.hidden ?? false,
    readonlyOnCreate: field?.readonlyOnCreate ?? false,
    readonlyOnEdit: field?.readonlyOnEdit ?? false,
    sortable: field?.sortable ?? false,
    sortDirection: field?.sortDirection ?? 'desc',
  }
}

export function getDefaultAcceptByType(type: string) {
  const field = sharedFieldMeta.find((item) => item.value === type)
  return Array.isArray(field?.defaultAccept) ? field.defaultAccept : []
}

export function getAcceptOptionsByType(type: string) {
  if (type === 'image') {
    return [
      { label: '任意图片', value: 'image/*' },
      { label: 'PNG', value: 'image/png' },
      { label: 'JPEG', value: 'image/jpeg' },
      { label: 'WEBP', value: 'image/webp' },
      { label: 'GIF', value: 'image/gif' },
      { label: 'SVG', value: 'image/svg+xml' },
    ]
  }

  if (type === 'video') {
    return [
      { label: '任意视频', value: 'video/*' },
      { label: 'MP4', value: 'video/mp4' },
      { label: 'WebM', value: 'video/webm' },
      { label: 'QuickTime', value: 'video/quicktime' },
      { label: 'MPEG', value: 'video/mpeg' },
    ]
  }

  if (type === 'audio') {
    return [
      { label: '任意音频', value: 'audio/*' },
      { label: 'MP3', value: 'audio/mpeg' },
      { label: 'WAV', value: 'audio/wav' },
      { label: 'OGG', value: 'audio/ogg' },
      { label: 'AAC', value: 'audio/aac' },
      { label: 'M4A', value: 'audio/mp4' },
    ]
  }

  if (type === 'file') {
    return [
      { label: 'PDF', value: '.pdf' },
      { label: 'DOC', value: '.doc' },
      { label: 'DOCX', value: '.docx' },
      { label: 'XLS', value: '.xls' },
      { label: 'XLSX', value: '.xlsx' },
      { label: 'PPT', value: '.ppt' },
      { label: 'PPTX', value: '.pptx' },
      { label: 'TXT', value: '.txt' },
      { label: 'MD', value: '.md' },
      { label: 'CSV', value: '.csv' },
      { label: 'ZIP', value: '.zip' },
      { label: 'RAR', value: '.rar' },
      { label: '7Z', value: '.7z' },
    ]
  }

  return []
}

export function getAcceptPresetOptionsByType(type: string) {
  if (type === 'image') {
    return [
      { label: '常用图片', values: ['image/png', 'image/jpeg', 'image/webp'] },
      { label: '网页图片', values: ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'] },
    ]
  }

  if (type === 'video') {
    return [
      { label: '常用视频', values: ['video/mp4', 'video/webm', 'video/quicktime'] },
    ]
  }

  if (type === 'audio') {
    return [
      { label: '常用音频', values: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4'] },
    ]
  }

  if (type === 'file') {
    return [
      { label: '办公文档', values: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'] },
      { label: '文本文档', values: ['.txt', '.md', '.csv'] },
      { label: '压缩文件', values: ['.zip', '.rar', '.7z'] },
      { label: '文档 + 压缩包', values: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.zip', '.rar', '.7z'] },
    ]
  }

  return []
}

export function getFieldTypeHelpText(type: string) {
  if (ENUM_TYPES.includes(type)) {
    return '适合状态、分类等有限值字段，建模时需要先配置枚举选项。'
  }

  if (ARRAY_TYPES.includes(type)) {
    return '适合标签、ID 列表等多值数据，可设置元素类型与数量约束。'
  }

  if (type === 'markdown') {
    return '适合使用 Markdown 语法录入的文本内容。'
  }

  if (type === 'json') {
    return '适合结构化数据，可限制为任意 JSON、对象或数组。'
  }

  if (LOCATION_TYPES.includes(type)) {
    return '适合经纬度位置数据，可设置存储方式、坐标系，以及是否要求地址和地点名称。'
  }

  if (ADDRESS_TYPES.includes(type)) {
    return '适合中国省市区地址数据，可设置粒度与存储方式。'
  }

  if (RELATION_TYPES.includes(type)) {
    return type === 'multiRelation'
      ? '适合同一目标模型下的多条记录关联，可配置展示字段与关联数约束。'
      : '适合同一目标模型下的单条记录关联，可配置展示字段。'
  }

  if (POLY_RELATION_TYPES.includes(type)) {
    return type === 'multiPolyRelation'
      ? '适合多个目标模型中的多条记录关联，可为每个模型分别配置展示字段和关联数约束。'
      : '适合多个目标模型中的单条记录关联，可配置允许关联的模型范围。'
  }

  return '请根据业务需要设置字段默认值和约束。'
}

export function getFieldTypeUsageGuide(type: string) {
  if (type === 'relation') {
    return {
      title: '单模型（单记录）适用场景',
      summary: '一个字段只关联同一个模型中的一条记录。',
      examples: ['文章关联一个作者', '订单关联一个门店', '商品关联一个品牌'],
    }
  }

  if (type === 'multiRelation') {
    return {
      title: '单模型（多记录）适用场景',
      summary: '一个字段关联同一个模型中的多条记录。',
      examples: ['文章关联多个标签', '商品关联多个规格模板', '活动关联多个参与门店'],
    }
  }

  if (type === 'polyRelation') {
    return {
      title: '多模型（单记录）适用场景',
      summary: '一个字段可从多个模型中选择一条记录，但最终只保存一条关联。',
      examples: ['一个推荐位可关联一篇文章或一个商品', '一个跳转目标可关联门店或活动'],
    }
  }

  if (type === 'multiPolyRelation') {
    return {
      title: '多模型（多记录）适用场景',
      summary: '一个字段可从多个模型中选择多条记录，并可按模型分别限制数量。',
      examples: ['首页混合内容流同时挂商品、文章、门店', '专题页同时关联多个活动和多个门店'],
    }
  }

  return null
}

export function changeFieldTypeState(prev: FieldConfigModalState, nextType: string): FieldConfigModalState {
  const shouldResetAcceptList = MEDIA_TYPES.includes(nextType) && prev.type !== nextType

  return {
    ...prev,
    type: nextType,
    defaultValue: ALL_RELATION_TYPES.includes(nextType) ? '' : prev.defaultValue,
    minLength: TEXT_LIKE_TYPES.includes(nextType) ? prev.minLength : '',
    maxLength: TEXT_LIKE_TYPES.includes(nextType) ? prev.maxLength : '',
    minValue: NUMBER_TYPES.includes(nextType) ? prev.minValue : '',
    maxValue: NUMBER_TYPES.includes(nextType) ? prev.maxValue : '',
    minItems: ITEM_COUNT_TYPES.includes(nextType) && nextType !== 'multiPolyRelation' ? prev.minItems : '',
    maxItems: ITEM_COUNT_TYPES.includes(nextType) && nextType !== 'multiPolyRelation' ? prev.maxItems : '',
    itemType: ARRAY_TYPES.includes(nextType) ? prev.itemType || 'text' : 'text',
    jsonValueType: nextType === 'json' ? prev.jsonValueType || 'any' : 'any',
    dateStorageFormat: DATE_TYPES.includes(nextType) ? prev.dateStorageFormat || 'string' : 'string',
    addressGranularity: ADDRESS_TYPES.includes(nextType) ? prev.addressGranularity || 'district' : 'district',
    addressStorageMode: ADDRESS_TYPES.includes(nextType) ? prev.addressStorageMode || 'object' : 'object',
    addressProvinceField: ADDRESS_TYPES.includes(nextType) ? prev.addressProvinceField : '',
    addressCityField: ADDRESS_TYPES.includes(nextType) ? prev.addressCityField : '',
    addressDistrictField: ADDRESS_TYPES.includes(nextType) ? prev.addressDistrictField : '',
    locationCoordinateSystem: LOCATION_TYPES.includes(nextType) ? prev.locationCoordinateSystem || 'gcj02' : 'gcj02',
    locationRequireAddress: LOCATION_TYPES.includes(nextType) ? prev.locationRequireAddress : false,
    locationRequireName: LOCATION_TYPES.includes(nextType) ? prev.locationRequireName : false,
    locationStorageMode: LOCATION_TYPES.includes(nextType) ? prev.locationStorageMode || 'object' : 'object',
    locationLngField: LOCATION_TYPES.includes(nextType) ? prev.locationLngField : '',
    locationLatField: LOCATION_TYPES.includes(nextType) ? prev.locationLatField : '',
    locationAddressField: LOCATION_TYPES.includes(nextType) ? prev.locationAddressField : '',
    locationNameField: LOCATION_TYPES.includes(nextType) ? prev.locationNameField : '',
    relationModelCollection: RELATION_TYPES.includes(nextType) ? prev.relationModelCollection : '',
    relationModelCollections: POLY_RELATION_TYPES.includes(nextType) ? prev.relationModelCollections : [],
    relationDisplayFields: RELATION_TYPES.includes(nextType) ? prev.relationDisplayFields : [],
    polyRelationDisplayMap: POLY_RELATION_TYPES.includes(nextType) ? prev.polyRelationDisplayMap : {},
    polyRelationLimitMap: POLY_RELATION_TYPES.includes(nextType) ? prev.polyRelationLimitMap : {},
    relationRecordsUnique: POLY_RELATION_TYPES.includes(nextType) ? prev.relationRecordsUnique : true,
    enumOptions: ENUM_TYPES.includes(nextType)
      ? prev.enumOptions.length > 0
        ? prev.enumOptions
        : [createEmptyEnumOption()]
      : [createEmptyEnumOption()],
    enumValueType: ENUM_TYPES.includes(nextType) ? prev.enumValueType : 'string',
    acceptList: MEDIA_TYPES.includes(nextType)
      ? shouldResetAcceptList
        ? getDefaultAcceptByType(nextType)
        : prev.acceptList.length > 0
          ? prev.acceptList
          : getDefaultAcceptByType(nextType)
      : [],
    maxFileSizeMB: MEDIA_TYPES.includes(nextType) ? prev.maxFileSizeMB : '',
    allowMultiple: MULTI_VALUE_TYPES.includes(nextType) && !ARRAY_TYPES.includes(nextType) ? prev.allowMultiple : false,
    assetStorageMode: MEDIA_TYPES.includes(nextType) ? prev.assetStorageMode : 'object',
    sortable: SORTABLE_TYPES.includes(nextType) ? prev.sortable : false,
    sortDirection: SORTABLE_TYPES.includes(nextType) ? prev.sortDirection : 'desc',
  }
}

function parseOptionalNumber(value: string) {
  if (!value.trim()) {
    return undefined
  }

  const nextValue = Number(value)
  return Number.isNaN(nextValue) ? null : nextValue
}

function parseEnumOptions(enumOptions: Array<{ label: string; value: string }>) {
  if (!Array.isArray(enumOptions)) {
    return []
  }

  return enumOptions
    .map((item) => ({
      label: String(item?.label ?? '').trim(),
      value: String(item?.value ?? '').trim(),
    }))
    .filter((item) => item.label && item.value)
}

function parseAccept(acceptList: string[]) {
  if (!Array.isArray(acceptList)) {
    return []
  }

  return acceptList.map((item) => String(item).trim()).filter(Boolean)
}

export function buildFieldDraftFromModalState(state: FieldConfigModalState) {
  const normalizedType = normalizeFieldTypeForModelEditor(state.type)
  if (!state.key.trim() || !state.title.trim()) {
    return {
      ok: false as const,
      message: '请填写展示名称和数据库字段名',
    }
  }

  if (state.key.trim() === '_id') {
    return {
      ok: false as const,
      message: '_id 为系统主键，不能作为业务字段配置',
    }
  }

  const minLength = parseOptionalNumber(state.minLength)
  const maxLength = parseOptionalNumber(state.maxLength)
  const minValue = parseOptionalNumber(state.minValue)
  const maxValue = parseOptionalNumber(state.maxValue)
  const minItems = parseOptionalNumber(state.minItems)
  const maxItems = parseOptionalNumber(state.maxItems)
  const maxFileSizeMB = parseOptionalNumber(state.maxFileSizeMB)

  if ([minLength, maxLength, minValue, maxValue, minItems, maxItems, maxFileSizeMB].some((item) => item === null)) {
    return {
      ok: false as const,
      message: '约束项必须是合法数字',
    }
  }

  if (typeof minLength === 'number' && typeof maxLength === 'number' && minLength > maxLength) {
    return {
      ok: false as const,
      message: '最小长度不能大于最大长度',
    }
  }

  if (typeof minValue === 'number' && typeof maxValue === 'number' && minValue > maxValue) {
    return {
      ok: false as const,
      message: '最小值不能大于最大值',
    }
  }

  if (typeof minItems === 'number' && typeof maxItems === 'number' && minItems > maxItems) {
    return {
      ok: false as const,
      message: '最小项数不能大于最大项数',
    }
  }

  const structuredDefaultValueError = validateStructuredDefaultValue(state)
  if (structuredDefaultValueError) {
    return {
      ok: false as const,
      message: structuredDefaultValueError,
    }
  }

  const enumOptions = ENUM_TYPES.includes(state.type) ? parseEnumOptions(state.enumOptions) : undefined
  if (ENUM_TYPES.includes(state.type) && (!enumOptions || enumOptions.length === 0)) {
    return {
      ok: false as const,
      message: '枚举字段至少需要一个选项',
    }
  }

  if (
    ENUM_TYPES.includes(state.type)
    && state.enumValueType === 'number'
    && enumOptions
    && enumOptions.some((item) => !Number.isFinite(Number(item.value)))
  ) {
    return {
      ok: false as const,
      message: '数字枚举的所有选项值都必须能转换为数字',
    }
  }

  const accept = MEDIA_TYPES.includes(state.type) ? parseAccept(state.acceptList) : undefined
  const nextDefaultValue = LOCATION_TYPES.includes(state.type)
    ? buildLocationStoredDefaultValue(state)
    : ADDRESS_TYPES.includes(state.type)
      ? buildAddressDefaultValue(state)
      : ALL_RELATION_TYPES.includes(state.type)
        ? ''
      : state.defaultValue

  if (LOCATION_TYPES.includes(state.type) && state.locationStorageMode === 'flat') {
    if (!state.locationLngField.trim() || !state.locationLatField.trim()) {
      return {
        ok: false as const,
        message: '位置字段使用 flat 模式时，必须填写经纬度映射字段名',
      }
    }

    if (state.locationRequireAddress && !state.locationAddressField.trim()) {
      return {
        ok: false as const,
        message: '位置字段已要求 address，flat 模式下必须填写 address 映射字段名',
      }
    }

    if (state.locationRequireName && !state.locationNameField.trim()) {
      return {
        ok: false as const,
        message: '位置字段已要求 name，flat 模式下必须填写 name 映射字段名',
      }
    }
  }

  if (ADDRESS_TYPES.includes(state.type) && state.addressStorageMode === 'flat') {
    const granularityOrder = {
      province: 1,
      city: 2,
      district: 3,
    }

    if (!state.addressProvinceField.trim()) {
      return {
        ok: false as const,
        message: '地址字段使用 flat 模式时，必须填写省映射字段名',
      }
    }

    if (granularityOrder[state.addressGranularity] >= 2 && !state.addressCityField.trim()) {
      return {
        ok: false as const,
        message: '地址字段当前粒度包含市，flat 模式下必须填写市映射字段名',
      }
    }

    if (granularityOrder[state.addressGranularity] >= 3 && !state.addressDistrictField.trim()) {
      return {
        ok: false as const,
        message: '地址字段当前粒度包含区，flat 模式下必须填写区映射字段名',
      }
    }
  }

  if (RELATION_TYPES.includes(normalizedType)) {
    if (!state.relationModelCollection.trim()) {
      return {
        ok: false as const,
        message: '关联字段必须选择关联模型',
      }
    }

    if (state.relationDisplayFields.length === 0) {
      return {
        ok: false as const,
        message: '关联字段至少需要选择一个展示字段',
      }
    }
  }

  if (POLY_RELATION_TYPES.includes(normalizedType)) {
    if (state.relationModelCollections.length === 0) {
      return {
        ok: false as const,
        message: '多模型关联至少需要选择一个可关联模型',
      }
    }

    for (const collection of state.relationModelCollections) {
      const fields = Array.isArray(state.polyRelationDisplayMap[collection]) ? state.polyRelationDisplayMap[collection] : []

      if (fields.length === 0) {
        return {
          ok: false as const,
          message: `多模型关联中的模型「${collection}」至少需要选择一个展示字段`,
        }
      }

      if (state.type === 'multiPolyRelation') {
        const limit = state.polyRelationLimitMap[collection] || { minItems: '', maxItems: '' }
        const relationMinItems = parseOptionalNumber(limit.minItems)
        const relationMaxItems = parseOptionalNumber(limit.maxItems)

        if (relationMinItems === null || relationMaxItems === null) {
          return {
            ok: false as const,
            message: `模型「${collection}」的关联数约束必须是合法数字`,
          }
        }

        if (
          typeof relationMinItems === 'number' &&
          typeof relationMaxItems === 'number' &&
          relationMinItems > relationMaxItems
        ) {
          return {
            ok: false as const,
            message: `模型「${collection}」的最少关联数不能大于最多关联数`,
          }
        }
      }
    }
  }

  const nextField: ModelFieldDraft = {
    key: state.key.trim(),
    title: state.title.trim(),
    type: normalizedType,
    description: state.description.trim(),
    defaultValue: nextDefaultValue,
    minLength: TEXT_LIKE_TYPES.includes(normalizedType) ? minLength ?? undefined : undefined,
    maxLength: TEXT_LIKE_TYPES.includes(normalizedType) ? maxLength ?? undefined : undefined,
    minValue: NUMBER_TYPES.includes(normalizedType) ? minValue ?? undefined : undefined,
    maxValue: NUMBER_TYPES.includes(normalizedType) ? maxValue ?? undefined : undefined,
    minItems: ITEM_COUNT_TYPES.includes(normalizedType) && normalizedType !== 'multiPolyRelation' ? minItems ?? undefined : undefined,
    maxItems: ITEM_COUNT_TYPES.includes(normalizedType) && normalizedType !== 'multiPolyRelation' ? maxItems ?? undefined : undefined,
    itemType: ARRAY_TYPES.includes(normalizedType) ? state.itemType : undefined,
    jsonValueType: normalizedType === 'json' ? state.jsonValueType : undefined,
    dateStorageFormat: DATE_TYPES.includes(normalizedType) ? state.dateStorageFormat : undefined,
    addressGranularity: ADDRESS_TYPES.includes(normalizedType) ? state.addressGranularity : undefined,
    addressStorageMode: ADDRESS_TYPES.includes(normalizedType) ? state.addressStorageMode : undefined,
    addressProvinceField: ADDRESS_TYPES.includes(normalizedType) && state.addressStorageMode === 'flat' ? state.addressProvinceField.trim() : undefined,
    addressCityField: ADDRESS_TYPES.includes(normalizedType) && state.addressStorageMode === 'flat' ? state.addressCityField.trim() : undefined,
    addressDistrictField: ADDRESS_TYPES.includes(normalizedType) && state.addressStorageMode === 'flat' ? state.addressDistrictField.trim() : undefined,
    locationCoordinateSystem: LOCATION_TYPES.includes(normalizedType) ? state.locationCoordinateSystem : undefined,
    locationRequireAddress: LOCATION_TYPES.includes(normalizedType) ? state.locationRequireAddress : undefined,
    locationRequireName: LOCATION_TYPES.includes(normalizedType) ? state.locationRequireName : undefined,
    locationStorageMode: LOCATION_TYPES.includes(normalizedType) ? state.locationStorageMode : undefined,
    locationLngField: LOCATION_TYPES.includes(normalizedType) && state.locationStorageMode === 'flat' ? state.locationLngField.trim() : undefined,
    locationLatField: LOCATION_TYPES.includes(normalizedType) && state.locationStorageMode === 'flat' ? state.locationLatField.trim() : undefined,
    locationAddressField:
      LOCATION_TYPES.includes(normalizedType) && state.locationStorageMode === 'flat' ? state.locationAddressField.trim() : undefined,
    locationNameField: LOCATION_TYPES.includes(normalizedType) && state.locationStorageMode === 'flat' ? state.locationNameField.trim() : undefined,
    relationModelCollection: RELATION_TYPES.includes(normalizedType) ? state.relationModelCollection.trim() : undefined,
    relationModelCollections: POLY_RELATION_TYPES.includes(normalizedType)
      ? state.relationModelCollections.map((item) => item.trim()).filter(Boolean)
      : undefined,
    polyRelationDisplayMap: POLY_RELATION_TYPES.includes(normalizedType)
      ? Object.fromEntries(
          state.relationModelCollections
            .map((collection) => [
              collection,
              (state.polyRelationDisplayMap[collection] || []).map((item) => item.trim()).filter(Boolean),
            ])
            .filter(([, fields]) => fields.length > 0),
        )
      : undefined,
    polyRelationLimitMap:
      normalizedType === 'multiPolyRelation'
        ? Object.fromEntries(
            state.relationModelCollections
              .map((collection) => {
                const limit = state.polyRelationLimitMap[collection] || { minItems: '', maxItems: '' }
                const nextMinItems = parseOptionalNumber(limit.minItems)
                const nextMaxItems = parseOptionalNumber(limit.maxItems)

                return [
                  collection,
                  {
                    ...(typeof nextMinItems === 'number' ? { minItems: nextMinItems } : {}),
                    ...(typeof nextMaxItems === 'number' ? { maxItems: nextMaxItems } : {}),
                  },
                ] as const
              })
              .filter(([, limit]) => Object.keys(limit).length > 0),
          )
        : undefined,
    relationRecordsUnique: POLY_RELATION_TYPES.includes(normalizedType) ? state.relationRecordsUnique : undefined,
    relationDisplayFields: RELATION_TYPES.includes(normalizedType)
      ? state.relationDisplayFields.map((item) => item.trim()).filter(Boolean)
      : undefined,
    enumOptions,
    enumValueType: ENUM_TYPES.includes(normalizedType) ? state.enumValueType : undefined,
    accept,
    maxFileSizeMB: MEDIA_TYPES.includes(normalizedType) ? maxFileSizeMB ?? undefined : undefined,
    allowMultiple: MULTI_VALUE_TYPES.includes(normalizedType) && !ARRAY_TYPES.includes(normalizedType) ? state.allowMultiple : false,
    assetStorageMode: MEDIA_TYPES.includes(normalizedType) ? state.assetStorageMode : undefined,
    required: state.required,
    hidden: state.hidden,
    readonlyOnCreate: state.readonlyOnCreate,
    readonlyOnEdit: state.readonlyOnEdit,
    sortable: SORTABLE_TYPES.includes(state.type) ? state.sortable : false,
    sortDirection: SORTABLE_TYPES.includes(state.type) && state.sortable ? state.sortDirection : undefined,
  }

  return {
    ok: true as const,
    field: nextField,
  }
}
