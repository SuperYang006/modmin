import * as XLSX from 'xlsx'
import { getCollectionSchemaDetailMock, getCollectionSchemaSummariesMock } from '@/mocks/schema/store'
import { insertRecord, listRecords, updateRecord } from '@/mocks/crud/store'
import type {
  ConfirmImportPayload,
  ConfirmImportResult,
  DownloadImportTemplatePayload,
  DownloadImportTemplateResult,
  ExportRecordsPayload,
  ExportRecordsResult,
  ImportColumnMapping,
  ImportConflictDetail,
  ListTransferJobsResult,
  PreviewImportPayload,
  PreviewImportResult,
  TransferCollectionOption,
  TransferJobItem,
} from '@/types/import-export'
import type { CrudFilterItem, RuntimeField } from '@/types/runtime'

const IMPORTABLE_TYPES = new Set(['text', 'textarea', 'number', 'boolean', 'enum', 'multi-enum', 'date', 'datetime', 'json', 'address'])
const RESERVED_IMPORT_FIELD_KEYS = new Set([
  '_id',
  'modmin_createTime',
  'modmin_createBy',
  'modmin_updateTime',
  'modmin_updateBy',
  'modmin_isDeleted',
  'modmin_deleteTime',
  'modmin_deleteBy',
])
const SYSTEM_FIELDS: RuntimeField[] = [
  { fieldKey: '_id', fieldName: '_id', label: '记录 ID', type: 'text' },
  { fieldKey: 'modmin_createTime', fieldName: 'modmin_createTime', label: '创建时间', type: 'datetime' },
  { fieldKey: 'modmin_createBy', fieldName: 'modmin_createBy', label: '创建人', type: 'text' },
  { fieldKey: 'modmin_updateTime', fieldName: 'modmin_updateTime', label: '更新时间', type: 'datetime' },
  { fieldKey: 'modmin_updateBy', fieldName: 'modmin_updateBy', label: '更新人', type: 'text' },
]

interface PreviewJobCache {
  job: TransferJobItem
  payload: PreviewImportPayload
  rows: Array<Record<string, unknown>>
  errors: ImportConflictDetail[]
  conflicts: ImportConflictDetail[]
  summary: PreviewImportResult['summary']
}

const previewJobCache = new Map<string, PreviewJobCache>()
const transferJobs: TransferJobItem[] = []

function encodeBase64Utf8(text: string) {
  return btoa(unescape(encodeURIComponent(text)))
}

function encodeBase64Csv(text: string) {
  return encodeBase64Utf8(`\uFEFF${text}`)
}

function decodeBase64ToUint8Array(base64: string) {
  const binary = atob(base64)
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

function decodeTextWithFallback(bytes: Uint8Array) {
  const utf8Text = new TextDecoder('utf-8').decode(bytes)
  if (!utf8Text.includes('\uFFFD')) {
    return utf8Text
  }

  try {
    return new TextDecoder('gb18030').decode(bytes)
  } catch {
    return utf8Text
  }
}

function getJobBase(collectionName: string, jobType: TransferJobItem['jobType'], format: TransferJobItem['format']): TransferJobItem {
  const now = Date.now()
  return {
    jobId: `${jobType}_${collectionName}_${now}`,
    jobType,
    collectionName,
    format,
    status: jobType === 'import_preview' ? 'previewed' : 'success',
    createTime: now,
    updateTime: now,
  }
}

function saveJob(job: TransferJobItem) {
  const index = transferJobs.findIndex((item) => item.jobId === job.jobId)
  if (index >= 0) {
    transferJobs[index] = job
    return
  }
  transferJobs.unshift(job)
}

function getAllFields(collectionName: string) {
  const detail = getCollectionSchemaDetailMock(collectionName)
  if (!detail) {
    throw new Error('模型不存在')
  }
  return [...detail.fields, ...SYSTEM_FIELDS]
}

function getImportableFields(collectionName: string) {
  return getAllFields(collectionName).filter((field) => IMPORTABLE_TYPES.has(field.type) && !RESERVED_IMPORT_FIELD_KEYS.has(field.fieldKey))
}

function toCollectionOptions(): TransferCollectionOption[] {
  return getCollectionSchemaSummariesMock().map((item) => ({
    collectionName: item.collectionName,
    modelName: item.modelName || item.collectionName,
    pageCode: item.pageCode,
    permissions: {
      canExport: true,
      canCreateOnly: true,
      canUpdateOnly: true,
      canUpsert: true,
    },
  }))
}

function buildAddressHeaders(field: RuntimeField) {
  const headers = [`${field.label}-省`]
  if (field.addressGranularity === 'city' || field.addressGranularity === 'district') {
    headers.push(`${field.label}-市`)
  }
  if (field.addressGranularity === 'district') {
    headers.push(`${field.label}-区`)
  }
  return headers
}

function exportRowsToBase64(rows: Array<Record<string, unknown>>, format: 'xlsx' | 'csv' | 'json') {
  if (format === 'json') {
    return {
      mimeType: 'application/json;charset=utf-8',
      fileContentBase64: encodeBase64Utf8(JSON.stringify(rows, null, 2)),
    }
  }

  const worksheet = XLSX.utils.json_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1')

  if (format === 'csv') {
    return {
      mimeType: 'text/csv;charset=utf-8',
      fileContentBase64: encodeBase64Csv(XLSX.utils.sheet_to_csv(worksheet)),
    }
  }

  return {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    fileContentBase64: XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' }),
  }
}

function buildExportRow(record: Record<string, unknown>, fields: RuntimeField[], headerMode: 'label' | 'fieldKey') {
  return fields.reduce<Record<string, unknown>>((acc, field) => {
    const headerKey = headerMode === 'fieldKey' ? field.fieldKey : field.label

    if (field.type === 'address') {
      const addressValue = record[field.fieldKey] as Record<string, string> | undefined
      const headers = buildAddressHeaders(field)
      acc[headers[0]] = addressValue?.province || ''
      if (headers[1]) acc[headers[1]] = addressValue?.city || ''
      if (headers[2]) acc[headers[2]] = addressValue?.district || ''
      return acc
    }

    const value = record[field.fieldKey]
    acc[headerKey] = typeof value === 'object' && value !== null ? JSON.stringify(value) : value ?? ''
    return acc
  }, {})
}

function compareValues(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0
  if (a == null) return -1
  if (b == null) return 1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b))
}

function matchesFilter(record: Record<string, unknown>, filter: CrudFilterItem): boolean {
  if (filter.value === undefined || filter.value === null || filter.value === '') {
    return true
  }

  const recordValue = record[filter.field]

  switch (filter.operator) {
    case 'like':
      if (typeof recordValue === 'string' && typeof filter.value === 'string') {
        return recordValue.toLowerCase().includes(filter.value.toLowerCase())
      }
      return false
    case 'gte':
      return compareValues(recordValue, filter.value) >= 0
    case 'lte':
      return compareValues(recordValue, filter.value) <= 0
    case 'eq':
    default:
      return recordValue === filter.value
  }
}

export function listTransferCollectionsMock() {
  return {
    list: toCollectionOptions(),
  }
}

export function downloadImportTemplateMock(payload: DownloadImportTemplatePayload): DownloadImportTemplateResult {
  const fields = getImportableFields(payload.collectionName)
  const headers = fields.flatMap((field) => field.type === 'address' ? buildAddressHeaders(field) : [field.label])
  const row = headers.reduce<Record<string, string>>((acc, header) => {
    acc[header] = ''
    return acc
  }, {})
  const exported = exportRowsToBase64([row], payload.format)

  return {
    fileName: `${payload.collectionName}_template.${payload.format}`,
    mimeType: exported.mimeType,
    fileContentBase64: exported.fileContentBase64,
    fields,
  }
}

export function exportRecordsMock(payload: ExportRecordsPayload): ExportRecordsResult {
  const fields = getAllFields(payload.collectionName).filter((field) => payload.fieldKeys.includes(field.fieldKey))
  let sourceRows = listRecords(payload.collectionName).slice()

  if (payload.filters?.length) {
    sourceRows = sourceRows.filter((item) => payload.filters?.every((filter) => matchesFilter(item, filter)))
  }

  if (payload.sort?.field) {
    const { field, order } = payload.sort
    sourceRows.sort((a, b) => {
      const result = compareValues(a[field], b[field])
      return order === 'desc' ? -result : result
    })
  }

  const rows = sourceRows.map((record) => buildExportRow(record, fields, payload.headerMode || 'label'))
  const exported = exportRowsToBase64(rows, payload.format)
  const job = getJobBase(payload.collectionName, 'export', payload.format)
  job.fieldKeys = payload.fieldKeys
  job.headerMode = payload.headerMode || 'label'
  job.filters = payload.filters || []
  job.sort = payload.sort
  job.totalRows = rows.length
  job.successRows = rows.length
  job.failedRows = 0
  job.summary = `导出 ${rows.length} 条记录`
  saveJob(job)

  return {
    job,
    fileName: `${payload.fileName || payload.collectionName}.${payload.format}`,
    mimeType: exported.mimeType,
    fileContentBase64: exported.fileContentBase64,
  }
}

function parseRowsFromPayload(payload: PreviewImportPayload) {
  if (!payload.mockFileBase64) {
    return []
  }

  const bytes = decodeBase64ToUint8Array(payload.mockFileBase64)
  if (payload.format === 'json') {
    const parsed = JSON.parse(decodeTextWithFallback(bytes))
    return Array.isArray(parsed) ? parsed : []
  }

  if (payload.format === 'csv') {
    const csvText = decodeTextWithFallback(bytes).replace(/^\uFEFF/, '')
    const workbook = XLSX.read(csvText, { type: 'string' })
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
    return XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: '' })
  }

  const workbook = XLSX.read(bytes, { type: 'array' })
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: '' })
}

function inferColumnMappings(rows: Array<Record<string, unknown>>, fields: RuntimeField[]): ImportColumnMapping[] {
  const headers = Object.keys(rows[0] || {})
  const mappings: ImportColumnMapping[] = []

  headers.forEach((header) => {
    const addressField = fields.find((field) => field.type === 'address' && buildAddressHeaders(field).includes(header))
    if (addressField) {
      mappings.push({ columnKey: header, columnLabel: header, fieldKey: addressField.fieldKey })
      return
    }

    const matchedField = fields.find((field) => field.label === header || field.fieldKey === header)
    mappings.push({ columnKey: header, columnLabel: header, fieldKey: matchedField?.fieldKey || '' })
  })

  return mappings
}

function resolveColumnMappings(payload: PreviewImportPayload, rows: Array<Record<string, unknown>>, fields: RuntimeField[]) {
  if (Array.isArray(payload.columnMappings) && payload.columnMappings.length > 0) {
    return payload.columnMappings.map((item) => ({
      columnKey: String(item.columnKey || ''),
      columnLabel: String(item.columnLabel || item.columnKey || ''),
      fieldKey: String(item.fieldKey || ''),
    }))
  }

  return inferColumnMappings(rows, fields)
}

function normalizeFieldValue(field: RuntimeField, rawValue: unknown) {
  if (rawValue === '' || rawValue === null || rawValue === undefined) {
    return undefined
  }

  if (field.type === 'number') {
    const numericValue = Number(rawValue)
    if (Number.isNaN(numericValue)) {
      throw new Error(`${field.label} 必须是数字`)
    }
    return numericValue
  }

  if (field.type === 'boolean') {
    if (rawValue === true || rawValue === 'true' || rawValue === 'TRUE' || rawValue === '1' || rawValue === 1) {
      return true
    }
    if (rawValue === false || rawValue === 'false' || rawValue === 'FALSE' || rawValue === '0' || rawValue === 0) {
      return false
    }
    throw new Error(`${field.label} 必须是布尔值`)
  }

  if (field.type === 'json') {
    if (typeof rawValue === 'string') {
      return JSON.parse(rawValue)
    }
    return rawValue
  }

  if (field.type === 'multi-enum') {
    if (Array.isArray(rawValue)) {
      return rawValue
    }
    return String(rawValue)
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }

  return rawValue
}

function findMatchConflicts(collectionName: string, fieldKey: string, matchValue: unknown) {
  if (matchValue === '' || matchValue === undefined || matchValue === null) {
    return []
  }
  return listRecords(collectionName).filter((record) => String(record[fieldKey] ?? '') === String(matchValue))
}

export function previewImportMock(payload: PreviewImportPayload): PreviewImportResult {
  const rows = parseRowsFromPayload(payload)
  if (rows.length > 1000) {
    throw new Error('单次导入最多支持 1000 行')
  }

  const fields = getImportableFields(payload.collectionName)
  const mappings = resolveColumnMappings(payload, rows, fields)
  const mappingByField = new Map<string, ImportColumnMapping[]>(fields.map((field) => [field.fieldKey, mappings.filter((item) => item.fieldKey === field.fieldKey)]))
  const errors: ImportConflictDetail[] = []
  const conflicts: ImportConflictDetail[] = []
  const validRows: Array<Record<string, unknown>> = []
  const duplicateMatchRows = new Map<string, number[]>()
  const matchFieldKey = payload.matchFieldKey || '_id'

  rows.forEach((row, index) => {
    const rowNo = index + 2
    const nextRecord: Record<string, unknown> = {}

    try {
      fields.forEach((field) => {
        if (field.type === 'address') {
          const headers = buildAddressHeaders(field)
          const province = row[headers[0]]
          const city = headers[1] ? row[headers[1]] : ''
          const district = headers[2] ? row[headers[2]] : ''
          if (province || city || district) {
            nextRecord[field.fieldKey] = {
              province: String(province || '').trim(),
              city: String(city || '').trim(),
              district: String(district || '').trim(),
            }
          }
          return
        }

        const mapping = mappingByField.get(field.fieldKey)?.[0]
        if (!mapping) {
          return
        }

        const rawValue = row[mapping.columnKey]
        const normalizedValue = normalizeFieldValue(field, rawValue)
        if (normalizedValue !== undefined) {
          nextRecord[field.fieldKey] = normalizedValue
        }
      })

      fields.forEach((field) => {
        if (field.required && (nextRecord[field.fieldKey] === undefined || nextRecord[field.fieldKey] === '')) {
          throw new Error(`${field.label} 为必填项`)
        }
      })
    } catch (error) {
      errors.push({
        rowNo,
        fieldKey: '',
        message: error instanceof Error ? error.message : '字段校验失败',
      })
      return
    }

    if (payload.mode !== 'createOnly') {
      const matchValue = nextRecord[matchFieldKey] ?? row[matchFieldKey]
      if (matchValue === undefined || matchValue === '') {
        errors.push({
          rowNo,
          fieldKey: matchFieldKey,
          message: `匹配字段 ${matchFieldKey} 不能为空`,
        })
        return
      }

      const duplicateRows = duplicateMatchRows.get(String(matchValue)) || []
      duplicateRows.push(rowNo)
      duplicateMatchRows.set(String(matchValue), duplicateRows)

      const matched = findMatchConflicts(payload.collectionName, matchFieldKey, matchValue)
      if (matched.length > 1) {
        conflicts.push({
          rowNo,
          fieldKey: matchFieldKey,
          matchValue: String(matchValue),
          matchedRecordIds: matched.map((item) => item._id),
          message: '匹配到多条已有记录',
        })
        return
      }
      if (payload.mode === 'updateOnly' && matched.length === 0) {
        errors.push({
          rowNo,
          fieldKey: matchFieldKey,
          matchValue: String(matchValue),
          message: '未匹配到待更新记录',
        })
        return
      }
    }

    validRows.push(nextRecord)
  })

  duplicateMatchRows.forEach((rowNos, matchValue) => {
    if (rowNos.length <= 1) {
      return
    }
    rowNos.forEach((rowNo) => {
      conflicts.push({
        rowNo,
        fieldKey: matchFieldKey,
        matchValue,
        message: '导入文件内匹配值重复',
      })
    })
  })

  const summary = {
    totalRows: rows.length,
    validRows: Math.max(validRows.length - conflicts.filter((item) => item.message === '导入文件内匹配值重复').length, 0),
    errorRows: errors.length,
    conflictRows: conflicts.length,
  }
  const job = getJobBase(payload.collectionName, 'import_preview', payload.format)
  job.mode = payload.mode
  job.matchFieldKey = payload.matchFieldKey || '_id'
  job.fileMeta = { fileID: payload.fileID, name: payload.mockFileName || '' }
  job.totalRows = rows.length
  job.successRows = summary.validRows
  job.failedRows = summary.errorRows + summary.conflictRows
  job.summary = `预检 ${rows.length} 行，成功 ${summary.validRows} 行`
  job.detail = { summary, errors, conflicts }

  previewJobCache.set(job.jobId, {
    job,
    payload,
    rows: validRows,
    errors,
    conflicts,
    summary,
  })
  saveJob(job)

  return {
    job,
    summary,
    columnMappings: mappings,
    supportedFields: fields,
    conflicts,
    errors,
  }
}

export function confirmImportMock(payload: ConfirmImportPayload): ConfirmImportResult {
  const cached = previewJobCache.get(payload.jobId)
  if (!cached) {
    throw new Error('未找到预检结果，请重新执行预检')
  }
  if (payload.skipErrorRows !== true && (cached.errors.length > 0 || cached.conflicts.length > 0)) {
    throw new Error('预检存在错误或冲突，请修正后重试或启用跳过错误行')
  }

  let successRows = 0
  cached.rows.forEach((row) => {
    const matchFieldKey = payload.matchFieldKey || '_id'
    const matchValue = row[matchFieldKey]
    const matched = payload.mode === 'createOnly' ? [] : findMatchConflicts(payload.collectionName, matchFieldKey, matchValue)

    if (payload.mode === 'createOnly') {
      insertRecord(payload.collectionName, row)
      successRows += 1
      return
    }

    if (matched.length === 1) {
      updateRecord(payload.collectionName, matched[0]._id, row)
      successRows += 1
      return
    }

    if (payload.mode === 'upsert') {
      insertRecord(payload.collectionName, row)
      successRows += 1
    }
  })

  const job = getJobBase(payload.collectionName, 'import_confirm', payload.format)
  job.sourcePreviewJobId = cached.job.jobId
  job.mode = payload.mode
  job.matchFieldKey = payload.matchFieldKey || '_id'
  job.totalRows = cached.summary.totalRows
  job.successRows = successRows
  job.failedRows = cached.errors.length + cached.conflicts.length
  job.status = successRows === 0 && job.failedRows > 0
    ? 'failed'
    : job.failedRows > 0
      ? 'partialSuccess'
      : 'success'
  job.summary = `导入 ${cached.summary.totalRows} 行，成功 ${successRows} 行`
  job.detail = {
    summary: {
      totalRows: cached.summary.totalRows,
      validRows: successRows,
      errorRows: cached.errors.length,
      conflictRows: cached.conflicts.length,
    },
    errors: cached.errors,
    conflicts: cached.conflicts,
  }
  saveJob(job)

  return {
    job,
    summary: {
      totalRows: cached.summary.totalRows,
      validRows: successRows,
      errorRows: cached.errors.length,
      conflictRows: cached.conflicts.length,
    },
    errors: cached.errors,
    conflicts: cached.conflicts,
  }
}

export function getTransferJobDetailMock(jobId: string) {
  return {
    job: transferJobs.find((item) => item.jobId === jobId) || null,
  }
}

export function listTransferJobsMock(payload?: {
  jobType?: TransferJobItem['jobType']
  collectionName?: string
  status?: TransferJobItem['status']
  format?: TransferJobItem['format']
  pageNo?: number
  pageSize?: number
}): ListTransferJobsResult {
  const filtered = transferJobs.filter((item) => {
    if (payload?.jobType && item.jobType !== payload.jobType) return false
    if (payload?.collectionName && item.collectionName !== payload.collectionName) return false
    if (payload?.status && item.status !== payload.status) return false
    if (payload?.format && item.format !== payload.format) return false
    return true
  })
  const pageNo = Math.max(1, Number(payload?.pageNo) || 1)
  const pageSize = Math.max(1, Number(payload?.pageSize) || 20)
  const start = (pageNo - 1) * pageSize
  return {
    list: filtered.slice(start, start + pageSize),
    pagination: {
      pageNo,
      pageSize,
      total: filtered.length,
    },
  }
}
