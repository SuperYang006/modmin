const XLSX = require('xlsx')
const {
  omitImmutableFields,
  rejectReadonlyFieldChanges,
  stripSystemFields,
  validateAndNormalizeFieldValue,
  writeStructuredFieldToFlatRecord,
  hydrateRecordFromSchemaFields,
} = require('../shared/crud-fields.js')
const {
  buildAddressHeaders,
  getFieldKey,
  listImportableFields,
  listModelFields,
} = require('./schema.js')
const { buildJob } = require('./export-actions.js')

const MAX_IMPORT_ROWS = 1000
const QUERY_BATCH_SIZE = 1000
const EXECUTION_STATE_FLUSH_BATCH_SIZE = 50
const IMPORT_JOB_ID_FIELD = 'modmin_importJobId'
const IMPORT_ROW_NO_FIELD = 'modmin_importRowNo'

function decodeFileContent(base64) {
  return Buffer.from(base64, 'base64')
}

function decodeTextWithFallback(fileContent) {
  const utf8Text = new TextDecoder('utf-8').decode(fileContent)
  if (!utf8Text.includes('\uFFFD')) {
    return utf8Text
  }

  try {
    return new TextDecoder('gb18030').decode(fileContent)
  } catch {
    return utf8Text
  }
}

function inferColumnMappings(rows, fields) {
  const headers = Object.keys(rows[0] || {})
  const mappings = []

  headers.forEach((header) => {
    const addressField = fields.find((field) => field.type === 'address' && buildAddressHeaders(field).includes(header))
    if (addressField) {
      mappings.push({ columnKey: header, columnLabel: header, fieldKey: getFieldKey(addressField) })
      return
    }

    const field = fields.find((item) => (item.label || item.fieldKey) === header || getFieldKey(item) === header)
    mappings.push({ columnKey: header, columnLabel: header, fieldKey: field ? getFieldKey(field) : '' })
  })

  return mappings
}

function resolveColumnMappings(payload, rows, fields) {
  if (Array.isArray(payload?.columnMappings) && payload.columnMappings.length > 0) {
    return payload.columnMappings.map((item) => ({
      columnKey: String(item.columnKey || ''),
      columnLabel: String(item.columnLabel || item.columnKey || ''),
      fieldKey: String(item.fieldKey || ''),
    }))
  }

  return inferColumnMappings(rows, fields)
}

function parseRowsFromContent(fileContent, format) {
  if (format === 'json') {
    const parsed = JSON.parse(decodeTextWithFallback(fileContent))
    return Array.isArray(parsed) ? parsed : []
  }

  if (format === 'csv') {
    const csvText = decodeTextWithFallback(fileContent).replace(/^\uFEFF/, '')
    const workbook = XLSX.read(csvText, { type: 'string' })
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
    return XLSX.utils.sheet_to_json(firstSheet, { defval: '' })
  }

  const workbook = XLSX.read(fileContent, { type: 'buffer' })
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
  return XLSX.utils.sheet_to_json(firstSheet, { defval: '' })
}

async function readImportFile(app, payload, allowMockFileBase64) {
  if (allowMockFileBase64 && payload?.mockFileBase64) {
    return decodeFileContent(payload.mockFileBase64)
  }

  const result = await app.downloadFile({ fileID: payload.fileID })
  return Buffer.isBuffer(result?.fileContent) ? result.fileContent : Buffer.from(result?.fileContent || '')
}

function normalizeSimpleValue(field, value) {
  if (value === '' || value === null || value === undefined) {
    return undefined
  }
  return validateAndNormalizeFieldValue(field, value)
}

function findRowMatch(records, matchFieldKey, matchValue) {
  return records.filter((record) => String(record?.[matchFieldKey] ?? '') === String(matchValue ?? ''))
}

async function fetchAllCollectionRows(query, batchSize = QUERY_BATCH_SIZE) {
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

function buildFieldMappingMap(fields, mappings) {
  return new Map(fields.map((field) => [getFieldKey(field), mappings.filter((item) => item.fieldKey === getFieldKey(field))]))
}

function buildCreateOnlyImportMarker(jobId, rowNo) {
  return {
    [IMPORT_JOB_ID_FIELD]: String(jobId || ''),
    [IMPORT_ROW_NO_FIELD]: Number(rowNo) || 0,
  }
}

async function persistExecutionState(jobs, jobRecordId, patch) {
  if (!jobRecordId) {
    return
  }
  await jobs.updateJobById(jobRecordId, patch)
}

function normalizeRowRecord(row, fields, mappingByField) {
  const nextRecord = {}

  for (const field of fields) {
    if (field.type === 'address') {
      const headers = buildAddressHeaders(field)
      const province = row[headers[0]]
      const city = headers[1] ? row[headers[1]] : ''
      const district = headers[2] ? row[headers[2]] : ''
      if (province || city || district) {
        const normalized = normalizeSimpleValue(field, {
          province: String(province || '').trim(),
          city: String(city || '').trim(),
          district: String(district || '').trim(),
        })
        if (!normalized || normalized.value === undefined) {
          continue
        }
        if (!normalized.ok) {
          throw new Error(normalized.message)
        }
        nextRecord[getFieldKey(field)] = normalized.value
      }
      continue
    }

    const mapping = mappingByField.get(getFieldKey(field))?.[0]
    if (!mapping) {
      continue
    }

    const normalized = normalizeSimpleValue(field, row[mapping.columnKey])
    if (!normalized || normalized.value === undefined) {
      continue
    }
    if (!normalized.ok) {
      throw new Error(normalized.message)
    }
    nextRecord[getFieldKey(field)] = normalized.value
  }

  for (const field of fields) {
    const fieldKey = getFieldKey(field)
    if (field.required && (nextRecord[fieldKey] === undefined || nextRecord[fieldKey] === '')) {
      throw new Error(`${field.label || fieldKey} 为必填项`)
    }
  }

  return nextRecord
}

function analyzeImportRows(rows, fields, mappings, currentRecords, mode, matchFieldKey) {
  const mappingByField = buildFieldMappingMap(fields, mappings)
  const errors = []
  const conflicts = []
  const duplicateValues = new Map()
  const validRowItems = []

  rows.forEach((row, index) => {
    const rowNo = index + 2
    let nextRecord = {}

    try {
      nextRecord = normalizeRowRecord(row, fields, mappingByField)
    } catch (error) {
      errors.push({
        rowNo,
        fieldKey: '',
        message: error instanceof Error ? error.message : '字段校验失败',
      })
      return
    }

    let matchValue
    let matched = []

    if (mode !== 'createOnly') {
      matchValue = nextRecord[matchFieldKey] ?? row[matchFieldKey]
      if (matchValue === undefined || matchValue === '') {
        errors.push({
          rowNo,
          fieldKey: matchFieldKey,
          message: `匹配字段 ${matchFieldKey} 不能为空`,
        })
        return
      }

      const rowNos = duplicateValues.get(String(matchValue)) || []
      rowNos.push(rowNo)
      duplicateValues.set(String(matchValue), rowNos)

      matched = findRowMatch(currentRecords, matchFieldKey, matchValue)
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

      if (mode === 'updateOnly' && matched.length === 0) {
        errors.push({
          rowNo,
          fieldKey: matchFieldKey,
          matchValue: String(matchValue),
          message: '未匹配到待更新记录',
        })
        return
      }
    }

    validRowItems.push({
      rowNo,
      row,
      nextRecord,
      matchValue,
      matched,
    })
  })

  duplicateValues.forEach((rowNos, matchValue) => {
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

  const duplicatedRowNos = new Set(conflicts.filter((item) => item.message === '导入文件内匹配值重复').map((item) => item.rowNo))
  const conflictRowNos = new Set(conflicts.map((item) => item.rowNo))
  const executableRows = validRowItems.filter((item) => !conflictRowNos.has(item.rowNo))

  return {
    errors,
    conflicts,
    duplicatedRowNos,
    validRowItems,
    executableRows,
    summary: {
      totalRows: rows.length,
      validRows: executableRows.length,
      errorRows: errors.length,
      conflictRows: conflicts.length,
    },
  }
}

function createImportActions(deps) {
  const {
    db,
    app,
    success,
    fail,
    jobs,
    getCollectionDoc,
    ensureTransferPermission,
    pickOperator,
    emitAuditLogSafe,
    enqueueWebhookDeliveries,
    allowMockFileBase64 = false,
  } = deps

  async function previewImport(event) {
    const payload = event?.data || {}
    const collectionName = payload.collectionName
    const format = payload.format || 'xlsx'
    const mode = payload.mode || 'createOnly'

    if (!collectionName || (!payload.fileID && !(allowMockFileBase64 && payload.mockFileBase64))) {
      return fail(event, 40001, 'collectionName and fileID are required')
    }

    const permission = await ensureTransferPermission(event, collectionName, mode)
    if (!permission.ok) {
      return permission.response
    }

    const modelDoc = await getCollectionDoc(collectionName)
    if (!modelDoc) {
      return fail(event, 40404, '模型不存在')
    }

    const fileContent = await readImportFile(app, payload, allowMockFileBase64)
    const rows = parseRowsFromContent(fileContent, format)
    if (rows.length > MAX_IMPORT_ROWS) {
      return fail(event, 40002, `单次导入最多支持 ${MAX_IMPORT_ROWS} 行`)
    }

    const fields = listImportableFields(modelDoc)
    const mappings = resolveColumnMappings(payload, rows, fields)
    const matchFieldKey = payload.matchFieldKey || '_id'
    const currentRecords = await fetchAllCollectionRows(
      db.collection(collectionName).where({ modmin_isDeleted: db.command.neq(true) }),
    )
    const analyzed = analyzeImportRows(rows, fields, mappings, currentRecords, mode, matchFieldKey)
    const operator = pickOperator(event)
    const job = buildJob(collectionName, 'import_preview', format, {
      fileMeta: {
        fileID: payload.fileID,
        name: payload.mockFileName || '',
      },
      operator,
      mode,
      matchFieldKey,
      detail: {
        summary: analyzed.summary,
        errors: analyzed.errors,
        conflicts: analyzed.conflicts,
      },
      totalRows: rows.length,
      processedRows: rows.length,
      successRows: analyzed.summary.validRows,
      failedRows: analyzed.summary.errorRows + analyzed.summary.conflictRows,
      summary: `预检 ${rows.length} 行，成功 ${analyzed.summary.validRows} 行`,
    })

    await jobs.saveJob(job)
    await emitAuditLogSafe(event, {
      eventType: 'data_import.preview',
      resourceType: 'import_export_job',
      collectionName,
      recordId: job.jobId,
      actor: operator,
      result: 'success',
      after: {
        jobId: job.jobId,
        format,
        mode,
        matchFieldKey,
        summary: analyzed.summary,
      },
    })

    return success(event, {
      job,
      summary: analyzed.summary,
      columnMappings: mappings,
      supportedFields: fields,
      conflicts: analyzed.conflicts,
      errors: analyzed.errors,
    })
  }

  async function confirmImport(event) {
    const payload = event?.data || {}
    const collectionName = payload.collectionName
    const format = payload.format || 'xlsx'
    const mode = payload.mode || 'createOnly'
    const skipErrorRows = payload.skipErrorRows === true

    if (!collectionName || !payload.jobId || (!payload.fileID && !(allowMockFileBase64 && payload.mockFileBase64))) {
      return fail(event, 40001, 'jobId, collectionName and fileID are required')
    }

    const permission = await ensureTransferPermission(event, collectionName, mode)
    if (!permission.ok) {
      return permission.response
    }

    const previewJob = await jobs.getJobByJobId(payload.jobId)
    if (!previewJob) {
      return fail(event, 40404, '未找到预检任务，请重新预检')
    }
    if (previewJob.collectionName !== collectionName || previewJob.format !== format || previewJob.mode !== mode) {
      return fail(event, 40002, '预检任务与当前导入参数不一致，请重新预检')
    }
    if (previewJob.fileMeta?.fileID && payload.fileID !== previewJob.fileMeta.fileID) {
      return fail(event, 40002, '当前导入文件与预检文件不一致，请重新预检')
    }

    const modelDoc = await getCollectionDoc(collectionName)
    if (!modelDoc) {
      return fail(event, 40404, '模型不存在')
    }

    const fileContent = await readImportFile(app, payload, allowMockFileBase64)
    const rows = parseRowsFromContent(fileContent, format)
    if (rows.length > MAX_IMPORT_ROWS) {
      return fail(event, 40002, `单次导入最多支持 ${MAX_IMPORT_ROWS} 行`)
    }
    const fields = listImportableFields(modelDoc)
    const mappings = resolveColumnMappings(payload, rows, fields)
    const operator = pickOperator(event)
    const matchFieldKey = payload.matchFieldKey || '_id'
    const currentRecords = await fetchAllCollectionRows(
      db.collection(collectionName).where({ modmin_isDeleted: db.command.neq(true) }),
    )
    const analyzed = analyzeImportRows(rows, fields, mappings, currentRecords, mode, matchFieldKey)
    if (!skipErrorRows && (analyzed.errors.length > 0 || analyzed.conflicts.length > 0)) {
      return fail(event, 40002, '预检存在错误或冲突，请修正后重试或启用跳过错误行')
    }
    const confirmJobBase = buildJob(collectionName, 'import_confirm', format, {
      sourcePreviewJobId: previewJob.jobId,
      fileMeta: previewJob.fileMeta,
      operator,
      mode,
      matchFieldKey,
      detail: {
        summary: analyzed.summary,
        errors: analyzed.errors,
        conflicts: analyzed.conflicts,
      },
      totalRows: rows.length,
      processedRows: 0,
      successRows: 0,
      failedRows: analyzed.summary.errorRows + analyzed.summary.conflictRows,
      summary: `导入 ${rows.length} 行，成功 0 行`,
      executionState: {
        cursor: 0,
        completedRowNos: [],
      },
    })
    const confirmJobRecord = await jobs.saveJob({
      ...confirmJobBase,
      status: 'processing',
    })

    const completedRowNos = new Set(
      Array.isArray(confirmJobRecord.executionState?.completedRowNos) ? confirmJobRecord.executionState.completedRowNos.map(Number) : [],
    )
    let successRows = completedRowNos.size
    let processedRows = completedRowNos.size
    let lastCursor = confirmJobRecord.executionState?.cursor || 0
    let lastFlushedProcessedRows = processedRows

    const flushExecutionState = async (status, force = false) => {
      if (!force && processedRows - lastFlushedProcessedRows < EXECUTION_STATE_FLUSH_BATCH_SIZE) {
        return
      }
      await persistExecutionState(jobs, confirmJobRecord._id, {
        status,
        updateTime: Date.now(),
        executionState: {
          cursor: lastCursor,
          completedRowNos: Array.from(completedRowNos),
        },
      })
      lastFlushedProcessedRows = processedRows
    }

    try {
      for (const item of analyzed.executableRows) {
        const { rowNo, nextRecord, matched } = item
        if (completedRowNos.has(rowNo)) {
          continue
        }

        const now = Date.now()

        if (matched.length === 1) {
          const currentRecord = matched[0]
          const readonlyCheck = rejectReadonlyFieldChanges(listModelFields(modelDoc), currentRecord, nextRecord, 'edit')
          if (!readonlyCheck.ok) {
            analyzed.errors.push({ rowNo, fieldKey: readonlyCheck.fieldKey, message: readonlyCheck.message })
            continue
          }
          const updatedRecord = {
            ...omitImmutableFields(stripSystemFields(nextRecord)),
            modmin_updateTime: now,
            modmin_updateBy: operator.userId,
          }
          Object.keys(nextRecord).forEach((fieldKey) => {
            const field = fields.find((fieldItem) => getFieldKey(fieldItem) === fieldKey)
            if (field) {
              writeStructuredFieldToFlatRecord(field, nextRecord[fieldKey], updatedRecord)
            }
          })
          await db.collection(collectionName).doc(currentRecord._id).update(updatedRecord)
          const latest = await db.collection(collectionName).doc(currentRecord._id).get()
          const after = hydrateRecordFromSchemaFields(listModelFields(modelDoc), latest.data?.[0] || {})
          await emitAuditLogSafe(event, {
            eventType: 'record.update',
            resourceType: 'record',
            collectionName,
            recordId: currentRecord._id,
            actor: operator,
            result: 'success',
            before: hydrateRecordFromSchemaFields(listModelFields(modelDoc), currentRecord),
            after,
          })
          try {
            await enqueueWebhookDeliveries(event, {
              eventType: 'record.update',
              actor: operator,
              resource: { type: 'record', collectionName, recordId: currentRecord._id },
              data: {
                before: hydrateRecordFromSchemaFields(listModelFields(modelDoc), currentRecord),
                after,
              },
              meta: { requestId: event?.meta?.requestId || '', source: 'modmin' },
            })
          } catch (error) {
            console.warn('[webhook] enqueue failed', error)
          }
        } else {
          if (mode === 'updateOnly') {
            continue
          }

          if (mode === 'createOnly') {
            const existingImported = await db.collection(collectionName).where({
              ...buildCreateOnlyImportMarker(payload.jobId, rowNo),
              modmin_isDeleted: db.command.neq(true),
            }).limit(1).get()
            if ((existingImported.data || []).length > 0) {
              completedRowNos.add(rowNo)
              successRows = completedRowNos.size
              processedRows += 1
              lastCursor = rowNo
              await flushExecutionState('processing')
              continue
            }
          }

          const readonlyCheck = rejectReadonlyFieldChanges(listModelFields(modelDoc), {}, nextRecord, 'create')
          if (!readonlyCheck.ok) {
            analyzed.errors.push({ rowNo, fieldKey: readonlyCheck.fieldKey, message: readonlyCheck.message })
            continue
          }
          const createdRecord = {
            ...omitImmutableFields(stripSystemFields(nextRecord)),
            modmin_createTime: now,
            modmin_createBy: operator.userId,
            modmin_updateTime: now,
            modmin_updateBy: operator.userId,
            modmin_isDeleted: false,
            modmin_deleteTime: null,
            modmin_deleteBy: '',
            ...(mode === 'createOnly' ? buildCreateOnlyImportMarker(payload.jobId, rowNo) : {}),
          }
          Object.keys(nextRecord).forEach((fieldKey) => {
            const field = fields.find((fieldItem) => getFieldKey(fieldItem) === fieldKey)
            if (field) {
              writeStructuredFieldToFlatRecord(field, nextRecord[fieldKey], createdRecord)
            }
          })
          const createResult = await db.collection(collectionName).add(createdRecord)
          const latest = await db.collection(collectionName).doc(createResult.id).get()
          const after = hydrateRecordFromSchemaFields(listModelFields(modelDoc), latest.data?.[0] || {})
          await emitAuditLogSafe(event, {
            eventType: 'record.create',
            resourceType: 'record',
            collectionName,
            recordId: createResult.id,
            actor: operator,
            result: 'success',
            after,
          })
          try {
            await enqueueWebhookDeliveries(event, {
              eventType: 'record.create',
              actor: operator,
              resource: { type: 'record', collectionName, recordId: createResult.id },
              data: { before: null, after },
              meta: { requestId: event?.meta?.requestId || '', source: 'modmin' },
            })
          } catch (error) {
            console.warn('[webhook] enqueue failed', error)
          }
        }

        completedRowNos.add(rowNo)
        successRows = completedRowNos.size
        processedRows += 1
        lastCursor = rowNo
        await flushExecutionState('processing')
      }
    } catch (error) {
      await persistExecutionState(jobs, confirmJobRecord._id, {
        status: 'failed',
        updateTime: Date.now(),
        operator,
        detail: {
          summary: {
            totalRows: rows.length,
            validRows: successRows,
            errorRows: analyzed.errors.length,
            conflictRows: analyzed.conflicts.length,
          },
          errors: analyzed.errors,
          conflicts: analyzed.conflicts,
        },
        processedRows,
        successRows,
        failedRows: analyzed.errors.length + analyzed.conflicts.length,
        summary: `导入 ${rows.length} 行，成功 ${successRows} 行`,
        executionState: {
          cursor: lastCursor,
          completedRowNos: Array.from(completedRowNos),
        },
      })
      throw error
    }

    const finalSummary = {
      totalRows: rows.length,
      validRows: successRows,
      errorRows: analyzed.errors.length,
      conflictRows: analyzed.conflicts.length,
    }
    const skippedRows = finalSummary.totalRows - finalSummary.validRows
    const finalStatus = successRows === 0 && skippedRows > 0
      ? 'failed'
      : skippedRows > 0
        ? 'partialSuccess'
        : 'success'

    await persistExecutionState(jobs, confirmJobRecord._id, {
      status: finalStatus,
      updateTime: Date.now(),
      operator,
      detail: {
        summary: finalSummary,
        errors: analyzed.errors,
        conflicts: analyzed.conflicts,
      },
      totalRows: rows.length,
      processedRows,
      successRows,
      failedRows: analyzed.errors.length + analyzed.conflicts.length,
      summary: `导入 ${rows.length} 行，成功 ${successRows} 行`,
      executionState: {
        cursor: lastCursor,
        completedRowNos: Array.from(completedRowNos),
      },
    })

    const job = {
      ...confirmJobRecord,
      status: finalStatus,
      updateTime: Date.now(),
      operator,
      sourcePreviewJobId: previewJob.jobId,
      mode,
      matchFieldKey,
      detail: {
        summary: finalSummary,
        errors: analyzed.errors,
        conflicts: analyzed.conflicts,
      },
      totalRows: rows.length,
      processedRows,
      successRows,
      failedRows: analyzed.errors.length + analyzed.conflicts.length,
      summary: `导入 ${rows.length} 行，成功 ${successRows} 行`,
      executionState: {
        cursor: lastCursor,
        completedRowNos: Array.from(completedRowNos),
      },
    }
    await emitAuditLogSafe(event, {
      eventType: 'data_import.execute',
      resourceType: 'import_export_job',
      collectionName,
      recordId: job.jobId,
      actor: operator,
      result: 'success',
      after: {
        jobId: job.jobId,
        format,
        mode,
        matchFieldKey,
        summary: finalSummary,
      },
    })

    return success(event, {
      job,
      summary: finalSummary,
      conflicts: analyzed.conflicts,
      errors: analyzed.errors,
    })
  }

  return {
    previewImport,
    confirmImport,
  }
}

module.exports = {
  createImportActions,
}
