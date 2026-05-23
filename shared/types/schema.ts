import type { LayoutSchema, PageRuntimeSchema, RuntimeField } from './runtime'

export interface CollectionSchemaSummary {
  collectionName: string
  modelCode?: string
  modelName?: string
  description?: string
  pageCode: string
  icon?: string
  sortOrder?: number
  menuGroupId?: string
  fieldCount: number
  updatedAt: string
}

export interface SystemFieldSettings {
  showIdInList?: boolean
  showCmsCreateTime?: boolean
  showCmsUpdateTime?: boolean
  defaultSortField?: 'modmin_createTime' | 'modmin_updateTime'
  defaultSortOrder?: 'asc' | 'desc'
  searchFieldKeys?: string[]
}

export interface CollectionPageBinding {
  pageCode: string
  pageName: string
  pageType: string
}

export interface CollectionSchemaDetail {
  collection: CollectionSchemaSummary
  fields: RuntimeField[]
  systemFieldSettings?: SystemFieldSettings
  layoutSchema: LayoutSchema
  pages: CollectionPageBinding[]
}

export interface ListCollectionSchemasResult {
  list: CollectionSchemaSummary[]
}

export interface ConsoleOverviewWarning {
  type: 'noModels' | 'noVisibleModels' | 'roleDisabled' | 'ungroupedModels' | 'unauthorizedModels' | 'failedWebhookDeliveries' | string
  severity: 'info' | 'warning' | 'error'
  title: string
  description: string
  count: number
  actionPath?: string
}

export interface ConsoleOverviewStats {
  modelCount: number
  fieldCount: number
  visibleModelCount: number
  ungroupedModelCount: number
  roleCount: number
  adminUserCount: number
  webhookCount: number
  failedWebhookDeliveryCount: number
}

export interface ConsoleOverviewResult {
  isSuperAdmin: boolean
  roleDisabled?: boolean
  stats: ConsoleOverviewStats
  recentModels: CollectionSchemaSummary[]
  visibleModels: CollectionSchemaSummary[]
  warnings: ConsoleOverviewWarning[]
}

export interface GetCollectionSchemaDetailResult {
  detail: CollectionSchemaDetail
}

export interface PreviewSchemaResult {
  pageRuntimeSchema: PageRuntimeSchema
}

export interface SaveFieldSchemasResult {
  fields: RuntimeField[]
  updatedAt: string
}

export interface SaveCollectionSchemaPayload {
  mode: 'create' | 'edit'
  collectionName: string
  modelCode: string
  modelName: string
  description?: string
  pageCode: string
  icon?: string
  sortOrder?: number
  menuGroupId?: string | null
  fields: ModelFieldDraft[]
  systemFieldSettings?: SystemFieldSettings
}

export interface SaveCollectionSchemaResult {
  detail: CollectionSchemaDetail
}

export interface DeleteCollectionSchemaPayload {
  collectionName: string
}

export interface DeleteCollectionSchemaResult {
  collectionName: string
}

export interface SortCollectionSchemasItem {
  collectionName: string
  sortOrder: number
}

export interface SortCollectionSchemasPayload {
  items: SortCollectionSchemasItem[]
}

export interface SortCollectionSchemasResult {
  list: CollectionSchemaSummary[]
}

export interface SortFieldSchemasItem {
  fieldKey: string
  sortOrder: number
  groupKey?: string
}

export interface SortFieldSchemasResult {
  fields: RuntimeField[]
  updatedAt: string
}

export interface BusinessDirectory {
  menuId: string
  menuCode: string
  title: string
}

export interface MenuGroup {
  groupId: string
  groupCode: string
  title: string
  icon?: string
}

export interface MenuGroupItem extends MenuGroup {
  sortOrder?: number
  status: 'enabled' | 'disabled'
}

export interface WebhookItem {
  webhookId: string
  name: string
  description?: string
  status: 'enabled' | 'disabled'
  events: string[]
  collectionName: string
  targetType: 'http' | 'cloudFunction'
  extraParams?: Record<string, unknown>
  httpConfig?: {
    url: string
    method: 'POST'
    headers?: Record<string, string>
    secret?: string
    timeoutMs?: number
  }
  cloudFunctionConfig?: {
    functionName: string
    action?: string
    timeoutMs?: number
    extraParams?: Record<string, unknown>
  }
  retryConfig?: {
    maxAttempts: number
    backoffSeconds: number
  }
  createTime?: number
  updateTime?: number
}

export interface WebhookDeliveryItem {
  deliveryId: string
  webhookId: string
  eventId: string
  eventType: string
  targetType: 'http' | 'cloudFunction'
  target: string
  status: 'pending' | 'processing' | 'success' | 'retrying' | 'failed'
  attempts: number
  maxAttempts: number
  nextAttemptTime?: number
  lastAttemptTime?: number | null
  requestPayload?: Record<string, unknown>
  responseStatus?: number | null
  responseBody?: string
  errorMessage?: string
  durationMs?: number
  createTime?: number
  updateTime?: number
}

export interface SaveWebhookPayload {
  webhookId?: string
  name: string
  description?: string
  status: 'enabled' | 'disabled'
  events: string[]
  collectionName: string
  targetType: 'http' | 'cloudFunction'
  extraParams?: Record<string, unknown>
  httpConfig?: {
    url: string
    headers?: Record<string, string>
    secret?: string
    timeoutMs?: number
  }
  cloudFunctionConfig?: {
    functionName: string
    action?: string
    timeoutMs?: number
    extraParams?: Record<string, unknown>
  }
  retryConfig?: {
    maxAttempts: number
    backoffSeconds: number
  }
}

export interface ListWebhooksResult {
  list: WebhookItem[]
}

export interface SaveWebhookResult {
  item: WebhookItem | null
}

export interface DeleteWebhookResult {
  webhookId: string
}

export interface ListWebhookDeliveriesResult {
  list: WebhookDeliveryItem[]
  pagination: {
    pageNo: number
    pageSize: number
    total: number
  }
}

export interface RoleOption {
  roleCode: string
  roleName: string
}

export interface BusinessDirectoryItem extends BusinessDirectory {
  sortOrder?: number
  status: 'enabled' | 'disabled'
}

export interface RoleItem extends RoleOption {
  sortOrder?: number
  status: 'enabled' | 'disabled'
  description?: string
  builtin?: boolean
}

export interface ModelRolePermissionBinding {
  roleCode: string
  permissions: Array<'list' | 'create' | 'update' | 'delete'>
}

export interface ModelFieldDraft {
  key: string
  title: string
  type: string
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
  required?: boolean
  hidden?: boolean
  readonlyOnCreate?: boolean
  readonlyOnEdit?: boolean
  sortable?: boolean
  sortDirection?: 'asc' | 'desc'
}

export interface LocationValue {
  lng: number
  lat: number
  address?: string
  name?: string
  coordinateSystem?: 'gcj02' | 'wgs84'
}

export interface AddressValue {
  province?: string
  city?: string
  district?: string
}

export interface ListBusinessDirectoriesResult {
  list: BusinessDirectory[]
}

export interface ListRoleItemsResult {
  list: RoleItem[]
}

export interface SaveRolePayload {
  roleCode: string
  roleName: string
  description?: string
  status: 'enabled' | 'disabled'
}

export interface SaveRoleResult {
  item: RoleItem
}

export interface ListBusinessDirectoryItemsResult {
  list: BusinessDirectoryItem[]
}

export interface SaveBusinessDirectoryPayload {
  menuId?: string
  menuCode: string
  title: string
  status: 'enabled' | 'disabled'
}

export interface SaveBusinessDirectoryResult {
  item: BusinessDirectoryItem
}

export interface ListMenuGroupsResult {
  list: MenuGroup[]
}

export interface ListMenuGroupItemsResult {
  list: MenuGroupItem[]
}

export interface SaveMenuGroupPayload {
  groupId?: string
  groupCode?: string
  title: string
  icon?: string
  status: 'enabled' | 'disabled'
  sortOrder?: number
}

export interface SaveMenuGroupResult {
  item: MenuGroupItem
}

export interface DeleteMenuGroupPayload {
  groupId: string
}

export interface DeleteMenuGroupResult {
  groupId: string
}
