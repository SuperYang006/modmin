const XLSX = require('xlsx')
const {
  hydrateRecordFromSchemaFields,
} = require('../shared/crud-fields.js')
const {
  buildAddressHeaders,
  getFieldKey,
  listExportableFields,
  listImportableFields,
} = require('./schema.js')

function encodeUtf8Base64(text) {
  return Buffer.from(text, 'utf8').toString('base64')
}

function encodeCsvBase64(text) {
  return Buffer.from(`\uFEFF${text}`, 'utf8').toString('base64')
}

function buildJob(collectionName, jobType, format, extra = {}) {
  const now = Date.now()
  const failedRows = Number(extra.failedRows || 0)
  return {
    jobId: `${jobType}_${collectionName}_${now}`,
    jobType,
    collectionName,
    format,
    status: jobType === 'import_preview' ? 'previewed' : (failedRows > 0 ? 'partialSuccess' : 'success'),
    createTime: now,
    updateTime: now,
    ...extra,
  }
}

function exportRowsToFile(rows, format) {
  if (format === 'json') {
    return {
      mimeType: 'application/json;charset=utf-8',
      fileContentBase64: encodeUtf8Base64(JSON.stringify(rows, null, 2)),
    }
  }

  const worksheet = XLSX.utils.json_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1')

  if (format === 'csv') {
    return {
      mimeType: 'text/csv;charset=utf-8',
      fileContentBase64: encodeCsvBase64(XLSX.utils.sheet_to_csv(worksheet)),
    }
  }

  return {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    fileContentBase64: XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' }),
  }
}

function buildTemplateHeaders(fields) {
  return fields.flatMap((field) => field.type === 'address' ? buildAddressHeaders(field) : [field.label || field.fieldKey])
}

function buildExportRow(record, fields, headerMode) {
  return fields.reduce((acc, field) => {
    const headerKey = headerMode === 'fieldKey' ? getFieldKey(field) : (field.label || field.fieldKey)
    const fieldKey = getFieldKey(field)

    if (field.type === 'address') {
      const value = record[fieldKey] || {}
      const headers = buildAddressHeaders(field)
      acc[headers[0]] = value.province || ''
      if (headers[1]) acc[headers[1]] = value.city || ''
      if (headers[2]) acc[headers[2]] = value.district || ''
      return acc
    }

    const value = record[fieldKey]
    acc[headerKey] = value && typeof value === 'object' ? JSON.stringify(value) : value ?? ''
    return acc
  }, {})
}

async function fetchAllQueryRows(query, batchSize = 1000) {
  const rows = []
  let skip = 0

  while (true) {
    const result = await query.skip(skip).limit(batchSize).get()
    const batch = result.data || []
    rows.push(...batch)
    if (batch.length < batchSize) {
      break
    }
    skip += batch.length
  }

  return rows
}

function createExportActions(deps) {
  const {
    db,
    success,
    fail,
    jobs,
    buildWhereCondition,
    buildListQuery,
    getCollectionDoc,
    ensureTransferPermission,
    pickOperator,
    emitAuditLogSafe,
  } = deps

  async function downloadImportTemplate(event) {
    const collectionName = event?.data?.collectionName
    const format = event?.data?.format || 'xlsx'

    if (!collectionName) {
      return fail(event, 40001, 'collectionName is required')
    }

    const permission = await ensureTransferPermission(event, collectionName, 'createOnly')
    if (!permission.ok) {
      return permission.response
    }

    const modelDoc = await getCollectionDoc(collectionName)
    if (!modelDoc) {
      return fail(event, 40404, '模型不存在')
    }

    const fields = listImportableFields(modelDoc).filter((field) => field.readonlyOnCreate !== true)
    const headers = buildTemplateHeaders(fields)
    const row = headers.reduce((acc, header) => {
      acc[header] = ''
      return acc
    }, {})
    const exported = exportRowsToFile([row], format)

    return success(event, {
      fileName: `${collectionName}_template.${format}`,
      mimeType: exported.mimeType,
      fileContentBase64: exported.fileContentBase64,
      fields,
    })
  }

  async function exportRecords(event) {
    const collectionName = event?.data?.collectionName
    const format = event?.data?.format || 'xlsx'
    const fieldKeys = Array.isArray(event?.data?.fieldKeys) ? event.data.fieldKeys.map(String).filter(Boolean) : []
    const headerMode = event?.data?.headerMode === 'fieldKey' ? 'fieldKey' : 'label'

    if (!collectionName || fieldKeys.length === 0) {
      return fail(event, 40001, 'collectionName and fieldKeys are required')
    }

    const permission = await ensureTransferPermission(event, collectionName, 'export')
    if (!permission.ok) {
      return permission.response
    }

    const modelDoc = await getCollectionDoc(collectionName)
    if (!modelDoc) {
      return fail(event, 40404, '模型不存在')
    }

    const exportFields = listExportableFields(modelDoc).filter((field) => fieldKeys.includes(getFieldKey(field)))
    const where = buildWhereCondition(event?.data?.filters || [], modelDoc.fields || [])
    const query = buildListQuery(collectionName, where, event?.data?.sort)
    const rows = (await fetchAllQueryRows(query)).map((record) => hydrateRecordFromSchemaFields(modelDoc.fields || [], record))
    const exportedRows = rows.map((record) => buildExportRow(record, exportFields, headerMode))
    const exported = exportRowsToFile(exportedRows, format)
    const operator = pickOperator(event)
    const job = buildJob(collectionName, 'export', format, {
      fileName: `${event?.data?.fileName || collectionName}.${format}`,
      operator,
      fieldKeys,
      headerMode,
      filters: Array.isArray(event?.data?.filters) ? event.data.filters : [],
      sort: event?.data?.sort || undefined,
      totalRows: exportedRows.length,
      successRows: exportedRows.length,
      failedRows: 0,
      summary: `导出 ${exportedRows.length} 条记录`,
    })

    await jobs.saveJob(job)
    await emitAuditLogSafe(event, {
      eventType: 'data_export.create',
      resourceType: 'import_export_job',
      collectionName,
      recordId: job.jobId,
      actor: operator,
      result: 'success',
      after: {
        jobId: job.jobId,
        format,
        fieldKeys,
        totalRows: exportedRows.length,
      },
    })

    return success(event, {
      job,
      fileName: job.fileName,
      mimeType: exported.mimeType,
      fileContentBase64: exported.fileContentBase64,
    })
  }

  return {
    downloadImportTemplate,
    exportRecords,
  }
}

module.exports = {
  createExportActions,
  buildJob,
}
