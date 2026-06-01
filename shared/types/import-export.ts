import type { CrudFilterItem, RuntimeField } from './runtime'

export interface TransferCollectionPermission {
  canExport: boolean
  canCreateOnly: boolean
  canUpdateOnly: boolean
  canUpsert: boolean
}

export interface TransferCollectionOption {
  collectionName: string
  modelName: string
  pageCode: string
  permissions: TransferCollectionPermission
}

export interface ImportColumnMapping {
  columnKey: string
  columnLabel: string
  fieldKey: string
}

export interface ImportConflictDetail {
  rowNo: number
  fieldKey?: string
  matchValue?: string
  matchedRecordIds?: string[]
  message: string
}

export interface ImportPreviewSummary {
  totalRows: number
  validRows: number
  errorRows: number
  conflictRows: number
}

export interface TransferJobItem {
  jobId: string
  jobType: 'export' | 'import_preview' | 'import_confirm'
  sourcePreviewJobId?: string
  collectionName: string
  format: 'xlsx' | 'csv' | 'json'
  status: 'pending' | 'previewed' | 'processing' | 'success' | 'partialSuccess' | 'failed'
  fileName?: string
  fileMeta?: {
    fileID?: string
    name?: string
    size?: number
  }
  operator?: {
    userId?: string
    userName?: string
    nickName?: string
    roleCode?: string
  }
  fieldKeys?: string[]
  headerMode?: 'label' | 'fieldKey'
  mode?: 'createOnly' | 'updateOnly' | 'upsert'
  matchFieldKey?: string
  filters?: CrudFilterItem[]
  sort?: {
    field?: string
    order?: 'asc' | 'desc'
  }
  detail?: {
    summary?: ImportPreviewSummary
    errors?: ImportConflictDetail[]
    conflicts?: ImportConflictDetail[]
  }
  totalRows?: number
  processedRows?: number
  successRows?: number
  failedRows?: number
  summary?: string
  createTime?: number
  updateTime?: number
}

export interface ListTransferCollectionsResult {
  list: TransferCollectionOption[]
}

export interface DownloadImportTemplatePayload {
  collectionName: string
  format: 'xlsx' | 'csv' | 'json'
}

export interface DownloadImportTemplateResult {
  fileName: string
  mimeType: string
  fileContentBase64: string
  fields: RuntimeField[]
}

export interface ExportRecordsPayload {
  collectionName: string
  format: 'xlsx' | 'csv' | 'json'
  fieldKeys: string[]
  filters?: CrudFilterItem[]
  sort?: {
    field?: string
    order?: 'asc' | 'desc'
  }
  fileName?: string
  headerMode?: 'label' | 'fieldKey'
}

export interface ExportRecordsResult {
  job: TransferJobItem
  fileName: string
  mimeType: string
  fileContentBase64: string
}

export interface PreviewImportPayload {
  collectionName: string
  fileID: string
  format: 'xlsx' | 'csv' | 'json'
  mode: 'createOnly' | 'updateOnly' | 'upsert'
  matchFieldKey?: string
  columnMappings?: ImportColumnMapping[]
  skipErrorRows?: boolean
  previewOnly?: boolean
  mockFileBase64?: string
  mockFileName?: string
}

export interface PreviewImportResult {
  job: TransferJobItem
  summary: ImportPreviewSummary
  columnMappings: ImportColumnMapping[]
  supportedFields: RuntimeField[]
  conflicts: ImportConflictDetail[]
  errors: ImportConflictDetail[]
}

export interface ConfirmImportPayload extends PreviewImportPayload {
  jobId: string
}

export interface ConfirmImportResult {
  job: TransferJobItem
  summary: ImportPreviewSummary
  conflicts: ImportConflictDetail[]
  errors: ImportConflictDetail[]
}

export interface TransferJobDetailResult {
  job: TransferJobItem | null
}

export interface ListTransferJobsPayload {
  jobType?: TransferJobItem['jobType']
  collectionName?: string
  status?: TransferJobItem['status']
  format?: TransferJobItem['format']
  pageNo?: number
  pageSize?: number
  limit?: number
}

export interface ListTransferJobsResult {
  list: TransferJobItem[]
  pagination: {
    pageNo: number
    pageSize: number
    total: number
  }
}
