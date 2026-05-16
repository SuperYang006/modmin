export type PermissionMap = Record<string, boolean>

export interface RuntimeAction {
  actionKey: string
  label: string
  actionType: 'builtin' | 'custom' | 'workflow' | 'link'
  permissionKey?: string
  confirmText?: string
}

export interface RuntimeField {
  fieldKey: string
  fieldName: string
  label: string
  type: string
  required?: boolean
  hidden?: boolean
  readonly?: boolean
  description?: string
  defaultValue?: string
  minLength?: number
  maxLength?: number
  minValue?: number
  maxValue?: number
  minItems?: number
  maxItems?: number
  itemType?: string
  jsonValueType?: 'any' | 'object' | 'array'
  dateStorageFormat?: 'string' | 'timestamp' | 'timestampMs'
  addressGranularity?: 'province' | 'city' | 'district'
  addressStorageMode?: 'object' | 'flat'
  addressProvinceField?: string
  addressCityField?: string
  addressDistrictField?: string
  locationCoordinateSystem?: 'gcj02' | 'wgs84'
  locationRequireAddress?: boolean
  locationRequireName?: boolean
  locationStorageMode?: 'object' | 'flat'
  locationLngField?: string
  locationLatField?: string
  locationAddressField?: string
  locationNameField?: string
  relationModelCollection?: string
  relationModelCollections?: string[]
  relationDisplayFields?: string[]
  polyRelationDisplayMap?: Record<string, string[]>
  polyRelationLimitMap?: Record<string, { minItems?: number; maxItems?: number }>
  relationRecordsUnique?: boolean
  enumOptions?: Array<{ label: string; value: string }>
  enumValueType?: 'string' | 'number'
  accept?: string[]
  maxFileSizeMB?: number
  allowMultiple?: boolean
  assetStorageMode?: 'object' | 'url'
  sortable?: boolean
  sortDirection?: 'asc' | 'desc'
  listConfig?: {
    visible?: boolean
    width?: number
    fixed?: boolean
    ellipsis?: boolean
    sortOrder?: number
  }
  searchConfig?: {
    visible?: boolean
    operator?: string
    component?: string
    sortOrder?: number
  }
  formConfig?: {
    visibleOnCreate?: boolean
    visibleOnEdit?: boolean
    readonlyOnCreate?: boolean
    readonlyOnEdit?: boolean
    component?: string
    groupKey?: string
    span?: number
    sortOrder?: number
  }
  detailConfig?: {
    visible?: boolean
    groupKey?: string
    sortOrder?: number
  }
  validationRules?: RuntimeValidationRule[]
}

export interface RuntimeSystemFieldSettings {
  showIdInList?: boolean
  showCmsCreateTime?: boolean
  showCmsUpdateTime?: boolean
  defaultSortField?: 'modmin_createTime' | 'modmin_updateTime'
  defaultSortOrder?: 'asc' | 'desc'
  searchFieldKeys?: string[]
}

export interface LayoutFieldItem {
  fieldKey: string
  span?: number
  sortOrder?: number
}

export interface LayoutGroup {
  groupKey: string
  title: string
  layout: string
  sortOrder?: number
  fields: LayoutFieldItem[]
}

export interface LayoutSchema {
  layoutMode: string
  groups: LayoutGroup[]
}

export interface PageRuntimeSchema {
  page: Record<string, unknown>
  collection: Record<string, unknown>
  fields: RuntimeField[]
  searchFields?: RuntimeField[]
  systemFieldSettings?: RuntimeSystemFieldSettings
  dictMap: Record<string, Array<{ label: string; value: string }>>
  tableSchema: Record<string, unknown>
  formSchema: Record<string, unknown>
  detailSchema: Record<string, unknown>
  layoutSchema: LayoutSchema
  actions: {
    toolbar: RuntimeAction[]
    row: RuntimeAction[]
    batch: RuntimeAction[]
  }
  permissions: {
    canList: boolean
    canView?: boolean
    canCreate: boolean
    canUpdate: boolean
    canDelete: boolean
    fieldPermissions: PermissionMap
  }
}

export interface CrudListQuery {
  keyword?: string
  filters?: CrudFilterItem[]
  sort?: {
    field?: string
    order?: 'asc' | 'desc'
  }
  pagination?: {
    pageNo: number
    pageSize: number
  }
}

export interface CrudListResult {
  list: Array<Record<string, unknown>>
  pagination: {
    pageNo: number
    pageSize: number
    total: number
  }
}

export interface CrudDetailResult {
  record: Record<string, unknown> | null
}

export interface DictOption {
  label: string
  value: string
}

export interface CrudFilterItem {
  field: string
  operator: 'eq' | 'like' | 'gte' | 'lte'
  value: unknown
}

export interface RuntimeValidationRule {
  ruleType: 'required' | 'maxLength' | 'minLength' | 'minValue' | 'maxValue' | 'minItems' | 'maxItems'
  value?: number
  message: string
}
