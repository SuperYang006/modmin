function createRecordHandlers(deps) {
  const {
    db,
    checkModelPermission,
    getModelDoc,
    buildWhereCondition,
    buildListQuery,
    success,
    fail,
    pickOperator,
    hydrateStructuredFieldValue,
    writeStructuredFieldToFlatRecord,
    hydrateRecordFromSchemaFields,
    pickRecordFields,
    omitImmutableFields,
    validateAndNormalizeFieldValue,
    stripSystemFields,
    rejectReadonlyFieldChanges,
    emitAuditLogSafe,
    enqueueWebhookDeliveries,
  } = deps

  async function getDocData(collectionName, id) {
    const result = await db.collection(collectionName).doc(id).get()

    if (result && result.data && typeof result.data === 'object' && !Array.isArray(result.data)) {
      return result.data
    }

    if (result && Array.isArray(result.data)) {
      return result.data[0] || null
    }

    return null
  }

  async function normalizeRecordBySchema(collectionName, record) {
    const modelDoc = await getModelDoc(collectionName)

    if (!modelDoc?.fields || !record || typeof record !== 'object') {
      return {
        ok: true,
        record,
      }
    }

    const fieldMap = new Map((modelDoc.fields || []).map((field) => [field.fieldKey || field.key, field]))
    const normalizedRecord = { ...record }

    for (const field of modelDoc.fields || []) {
      const fieldKey = field.fieldKey || field.key
      const currentValue = hydrateStructuredFieldValue(field, normalizedRecord)
      const hasMinItemsRequirement = typeof field.minItems === 'number' && field.minItems > 0

      if ((field.required || hasMinItemsRequirement) && (currentValue === '' || currentValue === null || currentValue === undefined)) {
        if (hasMinItemsRequirement) {
          const normalized = validateAndNormalizeFieldValue(field, currentValue)
          if (!normalized.ok) {
            return {
              ok: false,
              fieldKey: normalized.fieldKey,
              message: normalized.message,
            }
          }
        }
        return {
          ok: false,
          fieldKey,
          message: `${field.title || field.label || fieldKey} 为必填项`,
        }
      }
    }

    for (const key of Object.keys(normalizedRecord)) {
      const field = fieldMap.get(key)

      if (!field?.type) {
        continue
      }

      const normalized = validateAndNormalizeFieldValue(field, normalizedRecord[key])

      if (!normalized.ok) {
        return {
          ok: false,
          fieldKey: normalized.fieldKey,
          message: normalized.message,
        }
      }

      normalizedRecord[key] = normalized.value
    }

    for (const field of modelDoc.fields || []) {
      const fieldKey = field.fieldKey || field.key

      if (!fieldKey || normalizedRecord[fieldKey] === undefined) {
        continue
      }

      writeStructuredFieldToFlatRecord(field, normalizedRecord[fieldKey], normalizedRecord)
    }

    return {
      ok: true,
      record: normalizedRecord,
    }
  }

  async function listRecords(event) {
    const collectionName = event?.data?.collectionName

    if (!collectionName) {
      return fail(event, 40001, 'collectionName is required')
    }

    const permission = await checkModelPermission(event, collectionName, 'list')
    if (!permission.ok) {
      return permission.response
    }

    const pagination = event?.data?.pagination || {}
    const pageNo = Number(pagination.pageNo || 1)
    const pageSize = Number(pagination.pageSize || 20)
    const filters = Array.isArray(event?.data?.filters) ? event.data.filters : []
    const sort = event?.data?.sort
    const fieldKeys = Array.isArray(event?.data?.fieldKeys) ? event.data.fieldKeys.map((item) => String(item).trim()).filter(Boolean) : []
    const modelFields = permission.modelDoc?.fields || []
    const where = buildWhereCondition(filters, modelFields)
    const start = (pageNo - 1) * pageSize
    const countQuery = buildListQuery(collectionName, where)
    const listQuery = buildListQuery(collectionName, where, sort)
    const countResult = await countQuery.count()
    const result = await listQuery.skip(start).limit(pageSize).get()
    const listFields =
      fieldKeys.length > 0
        ? modelFields.filter((field) => fieldKeys.includes(field.fieldKey || field.key))
        : modelFields
    const list = (result.data || []).map((record) =>
      pickRecordFields(hydrateRecordFromSchemaFields(listFields, record), fieldKeys),
    )
    const total = Number(countResult?.total || 0)

    return success(event, {
      list,
      pagination: {
        pageNo,
        pageSize,
        total,
      },
    })
  }

  async function getDetail(event) {
    const collectionName = event?.data?.collectionName
    const id = event?.data?.id

    if (!collectionName || !id) {
      return fail(event, 40001, 'collectionName and id are required')
    }

    const permission = await checkModelPermission(event, collectionName, 'list')
    if (!permission.ok) {
      return permission.response
    }

    const currentRecord = await getDocData(collectionName, id)

    if (!currentRecord || currentRecord.modmin_isDeleted === true) {
      return fail(event, 40404, '记录不存在')
    }

    return success(event, {
      record: hydrateRecordFromSchemaFields(permission.modelDoc?.fields || [], currentRecord),
    })
  }

  async function createRecord(event) {
    const collectionName = event?.data?.collectionName
    const record = event?.data?.record

    if (!collectionName || !record || typeof record !== 'object') {
      return fail(event, 40001, 'collectionName and record are required')
    }

    const permission = await checkModelPermission(event, collectionName, 'create')
    if (!permission.ok) {
      return permission.response
    }

    const now = Date.now()
    const operator = pickOperator(event)
    const inputRecord = stripSystemFields(record)
    const readonlyCheck = rejectReadonlyFieldChanges(permission.modelDoc?.fields || [], {}, inputRecord, 'create')

    if (!readonlyCheck.ok) {
      return fail(event, 40002, readonlyCheck.message, {
        fieldKey: readonlyCheck.fieldKey,
      })
    }

    const normalized = await normalizeRecordBySchema(collectionName, inputRecord)

    if (!normalized.ok) {
      return fail(event, 40002, normalized.message, {
        fieldKey: normalized.fieldKey,
      })
    }

    const normalizedRecord = normalized.record
    const nextRecord = {
      ...omitImmutableFields(normalizedRecord),
      modmin_createTime: now,
      modmin_createBy: operator.userId,
      modmin_updateTime: now,
      modmin_updateBy: operator.userId,
      modmin_isDeleted: false,
      modmin_deleteTime: null,
      modmin_deleteBy: '',
    }

    const result = await db.collection(collectionName).add(nextRecord)
    const detail = await getDocData(collectionName, result.id)
    const hydratedDetail = detail ? hydrateRecordFromSchemaFields(permission.modelDoc?.fields || [], detail) : null

    await emitAuditLogSafe(event, {
      eventType: 'record.create',
      resourceType: 'record',
      collectionName,
      recordId: result.id,
      actor: operator,
      result: 'success',
      after: hydratedDetail,
    })

    try {
      await enqueueWebhookDeliveries(event, {
        eventType: 'record.create',
        actor: operator,
        resource: {
          type: 'record',
          collectionName,
          recordId: result.id,
        },
        data: {
          before: null,
          after: hydratedDetail,
        },
        meta: {
          requestId: event?.meta?.requestId || '',
          source: 'modmin',
        },
      })
    } catch (error) {
      console.warn('[webhook] enqueue failed', error)
    }

    return success(event, {
      record: hydratedDetail,
    })
  }

  async function updateRecord(event) {
    const collectionName = event?.data?.collectionName
    const id = event?.data?.id
    const record = event?.data?.record

    if (!collectionName || !id || !record || typeof record !== 'object') {
      return fail(event, 40001, 'collectionName, id and record are required')
    }

    const permission = await checkModelPermission(event, collectionName, 'update')
    if (!permission.ok) {
      return permission.response
    }

    const currentRecord = (await getDocData(collectionName, id)) || {}
    const operator = pickOperator(event)
    const now = Date.now()

    if (!currentRecord._id || currentRecord.modmin_isDeleted === true) {
      return fail(event, 40404, '记录不存在')
    }

    const inputRecord = stripSystemFields(record)
    const readonlyCheck = rejectReadonlyFieldChanges(permission.modelDoc?.fields || [], currentRecord, inputRecord, 'edit')

    if (!readonlyCheck.ok) {
      return fail(event, 40002, readonlyCheck.message, {
        fieldKey: readonlyCheck.fieldKey,
      })
    }

    const normalized = await normalizeRecordBySchema(collectionName, inputRecord)

    if (!normalized.ok) {
      return fail(event, 40002, normalized.message, {
        fieldKey: normalized.fieldKey,
      })
    }

    const normalizedRecord = normalized.record

    await db.collection(collectionName).doc(id).update({
      ...omitImmutableFields(currentRecord),
      ...normalizedRecord,
      modmin_updateTime: now,
      modmin_updateBy: operator.userId,
    })

    const detail = await getDocData(collectionName, id)
    const beforeRecord = hydrateRecordFromSchemaFields(permission.modelDoc?.fields || [], currentRecord)
    const hydratedDetail = detail ? hydrateRecordFromSchemaFields(permission.modelDoc?.fields || [], detail) : null

    await emitAuditLogSafe(event, {
      eventType: 'record.update',
      resourceType: 'record',
      collectionName,
      recordId: id,
      actor: operator,
      result: 'success',
      before: beforeRecord,
      after: hydratedDetail,
    })

    try {
      await enqueueWebhookDeliveries(event, {
        eventType: 'record.update',
        actor: operator,
        resource: {
          type: 'record',
          collectionName,
          recordId: id,
        },
        data: {
          before: beforeRecord,
          after: hydratedDetail,
        },
        meta: {
          requestId: event?.meta?.requestId || '',
          source: 'modmin',
        },
      })
    } catch (error) {
      console.warn('[webhook] enqueue failed', error)
    }

    return success(event, {
      record: hydratedDetail,
    })
  }

  async function deleteRecord(event) {
    const collectionName = event?.data?.collectionName
    const id = event?.data?.id

    if (!collectionName || !id) {
      return fail(event, 40001, 'collectionName and id are required')
    }

    const permission = await checkModelPermission(event, collectionName, 'delete')
    if (!permission.ok) {
      return permission.response
    }

    const currentRecord = (await getDocData(collectionName, id)) || {}

    if (!currentRecord._id || currentRecord.modmin_isDeleted === true) {
      return fail(event, 40404, '记录不存在')
    }

    const now = Date.now()
    const operator = pickOperator(event)
    const beforeRecord = hydrateRecordFromSchemaFields(permission.modelDoc?.fields || [], currentRecord)

    await db.collection(collectionName).doc(id).update({
      ...omitImmutableFields(currentRecord),
      modmin_isDeleted: true,
      modmin_deleteTime: now,
      modmin_deleteBy: operator.userId,
      modmin_updateTime: now,
      modmin_updateBy: operator.userId,
    })

    await emitAuditLogSafe(event, {
      eventType: 'record.delete',
      resourceType: 'record',
      collectionName,
      recordId: id,
      actor: operator,
      result: 'success',
      before: beforeRecord,
      after: {
        ...beforeRecord,
        modmin_isDeleted: true,
        modmin_deleteTime: now,
        modmin_deleteBy: operator.userId,
        modmin_updateTime: now,
        modmin_updateBy: operator.userId,
      },
    })

    try {
      await enqueueWebhookDeliveries(event, {
        eventType: 'record.delete',
        actor: operator,
        resource: {
          type: 'record',
          collectionName,
          recordId: id,
        },
        data: {
          before: beforeRecord,
          after: {
            ...beforeRecord,
            modmin_isDeleted: true,
            modmin_deleteTime: now,
            modmin_deleteBy: operator.userId,
            modmin_updateTime: now,
            modmin_updateBy: operator.userId,
          },
        },
        meta: {
          requestId: event?.meta?.requestId || '',
          source: 'modmin',
        },
      })
    } catch (error) {
      console.warn('[webhook] enqueue failed', error)
    }

    return success(event, {
      record: null,
    })
  }

  return {
    listRecords,
    getDetail,
    createRecord,
    updateRecord,
    deleteRecord,
  }
}

module.exports = {
  createRecordHandlers,
}
