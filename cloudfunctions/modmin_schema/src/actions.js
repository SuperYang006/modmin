function createSchemaActions(deps) {
  const {
    db,
    collections,
    success,
    fail,
    isSuperAdmin,
    getCurrentRoleCode,
    requireSuperAdmin,
    pickOperator,
    getAllowedCollectionNames,
    getCollectionDoc,
    isBuiltinPrimaryKeyField,
    validateAndNormalizeFieldDraft,
    normalizeCollectionSummary,
    compareCollectionSortOrder,
    normalizeSystemFieldSettings,
    buildRuntimeField,
    buildStoredField,
    listFieldDocs,
    buildSchemaDetail,
    emitAuditLogSafe,
  } = deps

  async function listCollectionSchemas(event) {
    const result = await db.collection(collections.collections).get()
    const all = (result.data || []).filter((item) => item.status !== 'deleted')

    let filtered
    if (isSuperAdmin(event)) {
      filtered = all
    } else {
      const roleCode = getCurrentRoleCode(event)
      if (!roleCode) {
        return fail(event, 40101, '未登录或登录已过期')
      }
      const allowed = await getAllowedCollectionNames(roleCode)
      filtered = all.filter((item) => allowed.has(item.collectionName))
    }

    return success(event, {
      list: filtered.sort(compareCollectionSortOrder).map(normalizeCollectionSummary),
    })
  }

  async function getCollectionSchemaDetail(event) {
    const collectionName = event?.data?.collectionName

    if (!collectionName) {
      return fail(event, 40001, 'collectionName is required')
    }

    const collectionDoc = await getCollectionDoc(collectionName)
    if (!collectionDoc) {
      return fail(event, 40404, '模型不存在')
    }

    if (!isSuperAdmin(event)) {
      const roleCode = getCurrentRoleCode(event)
      if (!roleCode) return fail(event, 40101, '未登录或登录已过期')
      const allowed = await getAllowedCollectionNames(roleCode)
      if (!allowed.has(collectionName)) {
        return fail(event, 40301, '无权查看当前模型')
      }
    }

    const fieldDocs = listFieldDocs(collectionDoc)
    const runtimeFields = fieldDocs.map((field, index) =>
      buildRuntimeField(
        {
          key: field.fieldKey,
          title: field.title || field.label,
          type: field.type,
          description: field.description,
          defaultValue: field.defaultValue,
          minLength: field.minLength,
          maxLength: field.maxLength,
          minValue: field.minValue,
          maxValue: field.maxValue,
          minItems: field.minItems,
          maxItems: field.maxItems,
          itemType: field.itemType,
          jsonValueType: field.jsonValueType,
          dateStorageFormat: field.dateStorageFormat,
          addressGranularity: field.addressGranularity,
          addressStorageMode: field.addressStorageMode,
          addressProvinceField: field.addressProvinceField,
          addressCityField: field.addressCityField,
          addressDistrictField: field.addressDistrictField,
          locationCoordinateSystem: field.locationCoordinateSystem,
          locationRequireAddress: field.locationRequireAddress,
          locationRequireName: field.locationRequireName,
          locationStorageMode: field.locationStorageMode,
          locationLngField: field.locationLngField,
          locationLatField: field.locationLatField,
          locationAddressField: field.locationAddressField,
          locationNameField: field.locationNameField,
          relationModelCollection: field.relationModelCollection,
          relationModelCollections: Array.isArray(field.relationModelCollections) ? field.relationModelCollections : [],
          polyRelationDisplayMap: field.polyRelationDisplayMap && typeof field.polyRelationDisplayMap === 'object' ? field.polyRelationDisplayMap : {},
          polyRelationLimitMap: field.polyRelationLimitMap && typeof field.polyRelationLimitMap === 'object' ? field.polyRelationLimitMap : {},
          relationRecordsUnique: field.relationRecordsUnique !== false,
          relationDisplayFields: Array.isArray(field.relationDisplayFields)
            ? field.relationDisplayFields
            : typeof field.relationDisplayField === 'string' && field.relationDisplayField.trim()
              ? [field.relationDisplayField.trim()]
              : [],
          enumOptions: field.enumOptions,
          enumValueType: field.enumValueType,
          accept: field.accept,
          maxFileSizeMB: field.maxFileSizeMB,
          allowMultiple: field.allowMultiple,
          assetStorageMode: field.assetStorageMode,
          required: field.required,
          hidden: field.hidden,
          sortable: field.sortable,
          sortDirection: field.sortDirection || undefined,
        },
        index,
      ),
    )

    return success(event, {
      detail: buildSchemaDetail(
        collectionDoc,
        runtimeFields,
        normalizeSystemFieldSettings(collectionDoc.systemFieldSettings),
      ),
    })
  }

  async function saveCollectionSchema(event) {
    const authError = requireSuperAdmin(event)
    if (authError) return authError

    const payload = event?.data?.schema

    if (!payload?.collectionName || !payload?.modelName || !payload?.pageCode) {
      return fail(event, 40001, '缺少必要的模型基础信息')
    }

    if (!Array.isArray(payload.fields) || payload.fields.length === 0) {
      return fail(event, 40002, '请至少配置一个字段')
    }

    const fieldKeys = new Set()
    const normalizedFields = []

    for (let index = 0; index < payload.fields.length; index += 1) {
      if (isBuiltinPrimaryKeyField(payload.fields[index]?.key || payload.fields[index]?.fieldKey)) {
        continue
      }

      const normalized = validateAndNormalizeFieldDraft(payload.fields[index], index)
      if (!normalized.ok) {
        return fail(event, 40003, normalized.message)
      }

      const normalizedFieldKey = String(normalized.field.key || '').trim()
      if (fieldKeys.has(normalizedFieldKey)) {
        return fail(event, 40004, `字段 ${normalizedFieldKey} 重复，请保持字段名唯一`)
      }

      fieldKeys.add(normalizedFieldKey)
      normalizedFields.push(normalized.field)
    }

    const now = Date.now()
    const operator = pickOperator(event)
    const current = await getCollectionDoc(payload.collectionName)
    const beforeDetail = current
      ? buildSchemaDetail(
          current,
          listFieldDocs(current).map((field, index) =>
            buildRuntimeField(
              {
                key: field.fieldKey,
                title: field.title || field.label,
                type: field.type,
                description: field.description,
                defaultValue: field.defaultValue,
                minLength: field.minLength,
                maxLength: field.maxLength,
                minValue: field.minValue,
                maxValue: field.maxValue,
                minItems: field.minItems,
                maxItems: field.maxItems,
                itemType: field.itemType,
                jsonValueType: field.jsonValueType,
                dateStorageFormat: field.dateStorageFormat,
                addressGranularity: field.addressGranularity,
                addressStorageMode: field.addressStorageMode,
                addressProvinceField: field.addressProvinceField,
                addressCityField: field.addressCityField,
                addressDistrictField: field.addressDistrictField,
                locationCoordinateSystem: field.locationCoordinateSystem,
                locationRequireAddress: field.locationRequireAddress,
                locationRequireName: field.locationRequireName,
                locationStorageMode: field.locationStorageMode,
                locationLngField: field.locationLngField,
                locationLatField: field.locationLatField,
                locationAddressField: field.locationAddressField,
                locationNameField: field.locationNameField,
                relationModelCollection: field.relationModelCollection,
                relationModelCollections: Array.isArray(field.relationModelCollections) ? field.relationModelCollections : [],
                polyRelationDisplayMap: field.polyRelationDisplayMap && typeof field.polyRelationDisplayMap === 'object' ? field.polyRelationDisplayMap : {},
                polyRelationLimitMap: field.polyRelationLimitMap && typeof field.polyRelationLimitMap === 'object' ? field.polyRelationLimitMap : {},
                relationRecordsUnique: field.relationRecordsUnique !== false,
                relationDisplayFields: Array.isArray(field.relationDisplayFields)
                  ? field.relationDisplayFields
                  : typeof field.relationDisplayField === 'string' && field.relationDisplayField.trim()
                    ? [field.relationDisplayField.trim()]
                    : [],
                enumOptions: field.enumOptions,
                enumValueType: field.enumValueType,
                accept: field.accept,
                maxFileSizeMB: field.maxFileSizeMB,
                allowMultiple: field.allowMultiple,
                assetStorageMode: field.assetStorageMode,
                required: field.required,
                hidden: field.hidden,
                sortable: field.sortable,
                sortDirection: field.sortDirection || undefined,
              },
              index,
            ),
          ),
          normalizeSystemFieldSettings(current.systemFieldSettings),
        )
      : null
    const allCollectionResult = await db.collection(collections.collections).get()
    const existingCollections = (allCollectionResult.data || []).filter((item) => item.status !== 'deleted')
    const maxSortOrder = existingCollections.reduce((max, item) => {
      const sortOrder = Number(item?.sortOrder)
      return Number.isFinite(sortOrder) ? Math.max(max, sortOrder) : max
    }, 0)

    if (payload.mode === 'create' && current && current.status !== 'deleted') {
      return fail(event, 40005, `集合「${payload.collectionName}」对应的模型已存在，请更换集合名称`)
    }

    if (payload.mode === 'edit' && !current) {
      return fail(event, 40404, '当前编辑的模型不存在')
    }

    if (payload.mode === 'edit' && current) {
      const ASSET_FIELD_TYPES = new Set(['image', 'file', 'video', 'audio'])
      const previousAssetFieldMap = new Map(
        (current.fields || [])
          .filter((field) => field && ASSET_FIELD_TYPES.has(field.type))
          .map((field) => [field.fieldKey || field.key, field]),
      )
      const upgradedAssetFields = normalizedFields.filter((field) => {
        if (!ASSET_FIELD_TYPES.has(field.type)) {
          return false
        }
        const previous = previousAssetFieldMap.get(field.key)
        if (!previous) {
          return false
        }
        return previous.allowMultiple !== true && field.allowMultiple === true
      })

      if (upgradedAssetFields.length > 0) {
        const recordCountResult = await db.collection(payload.collectionName).count()
        const recordCount = Number(recordCountResult?.total || 0)
        if (recordCount > 0) {
          const fieldNames = upgradedAssetFields.map((field) => field.title || field.key).join('、')
          return fail(
            event,
            40010,
            `字段「${fieldNames}」从单项切换到支持多项会导致已有记录的存储结构（对象 → 数组）无法兼容，当前模型已存在 ${recordCount} 条数据，禁止变更。请新建字段替代。`,
          )
        }
      }
    }

    const runtimeFields = normalizedFields.map((field, index) => buildRuntimeField(field, index))
    const systemFieldSettings = normalizeSystemFieldSettings(payload.systemFieldSettings)
    const existingFields = listFieldDocs(current)
    const existingFieldMap = new Map(existingFields.map((field) => [field.fieldKey, field]))
    const storedFields = normalizedFields.map((field, index) => {
      const existingField = existingFieldMap.get(field.key)

      return {
        ...buildStoredField(field, index, now, operator),
        createTime: existingField?.createTime || now,
        createBy: existingField?.createBy || operator,
      }
    })

    const menuGroupIdProvided = Object.prototype.hasOwnProperty.call(payload, 'menuGroupId')
    let nextMenuGroupId
    if (menuGroupIdProvided) {
      if (payload.menuGroupId === null || payload.menuGroupId === '' || payload.menuGroupId === undefined) {
        nextMenuGroupId = ''
      } else {
        nextMenuGroupId = String(payload.menuGroupId).trim()
      }
    } else {
      nextMenuGroupId = typeof current?.menuGroupId === 'string' ? current.menuGroupId : ''
    }

    const nextCollectionDoc = {
      collectionName: payload.collectionName,
      modelCode: payload.modelCode,
      modelName: payload.modelName,
      description: payload.description || '',
      pageCode: payload.pageCode,
      icon: typeof payload.icon === 'string' && payload.icon.trim() ? payload.icon.trim() : '',
      sortOrder:
        typeof current?.sortOrder === 'number'
          ? current.sortOrder
          : typeof payload.sortOrder === 'number'
            ? payload.sortOrder
            : maxSortOrder + 10,
      menuGroupId: nextMenuGroupId,
      fieldCount: normalizedFields.length,
      fields: storedFields,
      systemFieldSettings,
      status: 'enabled',
      createTime: current?.createTime || now,
      updateTime: now,
      createBy: current?.createBy || operator,
      updateBy: operator,
    }

    if (current?._id) {
      await db.collection(collections.collections).doc(current._id).update(nextCollectionDoc)
    } else {
      await db.collection(collections.collections).add({
        ...nextCollectionDoc,
      })
    }

    const detail = buildSchemaDetail(
      nextCollectionDoc,
      runtimeFields,
      systemFieldSettings,
    )

    await emitAuditLogSafe(event, {
      eventType: current?._id ? 'schema.update' : 'schema.create',
      resourceType: 'schema',
      collectionName: payload.collectionName,
      recordId: current?._id || '',
      actor: operator,
      result: 'success',
      before: beforeDetail,
      after: detail,
    })

    return success(event, { detail })
  }

  async function deleteCollectionSchema(event) {
    const authError = requireSuperAdmin(event)
    if (authError) return authError

    const collectionName = event?.data?.collectionName
    if (!collectionName) {
      return fail(event, 40001, 'collectionName is required')
    }

    const current = await getCollectionDoc(collectionName)
    if (!current) {
      return fail(event, 40404, '模型不存在')
    }

    const now = Date.now()
    const operator = pickOperator(event)
    const beforeDetail = buildSchemaDetail(
      current,
      listFieldDocs(current).map((field, index) =>
        buildRuntimeField(
          {
            key: field.fieldKey,
            title: field.title || field.label,
            type: field.type,
            description: field.description,
            defaultValue: field.defaultValue,
            minLength: field.minLength,
            maxLength: field.maxLength,
            minValue: field.minValue,
            maxValue: field.maxValue,
            minItems: field.minItems,
            maxItems: field.maxItems,
            itemType: field.itemType,
            jsonValueType: field.jsonValueType,
            dateStorageFormat: field.dateStorageFormat,
            addressGranularity: field.addressGranularity,
            addressStorageMode: field.addressStorageMode,
            addressProvinceField: field.addressProvinceField,
            addressCityField: field.addressCityField,
            addressDistrictField: field.addressDistrictField,
            locationCoordinateSystem: field.locationCoordinateSystem,
            locationRequireAddress: field.locationRequireAddress,
            locationRequireName: field.locationRequireName,
            locationStorageMode: field.locationStorageMode,
            locationLngField: field.locationLngField,
            locationLatField: field.locationLatField,
            locationAddressField: field.locationAddressField,
            locationNameField: field.locationNameField,
            relationModelCollection: field.relationModelCollection,
            relationModelCollections: Array.isArray(field.relationModelCollections) ? field.relationModelCollections : [],
            polyRelationDisplayMap: field.polyRelationDisplayMap && typeof field.polyRelationDisplayMap === 'object' ? field.polyRelationDisplayMap : {},
            polyRelationLimitMap: field.polyRelationLimitMap && typeof field.polyRelationLimitMap === 'object' ? field.polyRelationLimitMap : {},
            relationRecordsUnique: field.relationRecordsUnique !== false,
            relationDisplayFields: Array.isArray(field.relationDisplayFields)
              ? field.relationDisplayFields
              : typeof field.relationDisplayField === 'string' && field.relationDisplayField.trim()
                ? [field.relationDisplayField.trim()]
                : [],
            enumOptions: field.enumOptions,
            enumValueType: field.enumValueType,
            accept: field.accept,
            maxFileSizeMB: field.maxFileSizeMB,
            allowMultiple: field.allowMultiple,
            assetStorageMode: field.assetStorageMode,
            required: field.required,
            hidden: field.hidden,
            sortable: field.sortable,
            sortDirection: field.sortDirection || undefined,
          },
          index,
        ),
      ),
      normalizeSystemFieldSettings(current.systemFieldSettings),
    )

    await db.collection(collections.collections).doc(current._id).update({
      status: 'deleted',
      updateTime: now,
      updateBy: operator,
    })

    await emitAuditLogSafe(event, {
      eventType: 'schema.delete',
      resourceType: 'schema',
      collectionName,
      recordId: current._id,
      actor: operator,
      result: 'success',
      before: beforeDetail,
      after: {
        ...beforeDetail,
        collection: {
          ...beforeDetail.collection,
          status: 'deleted',
        },
      },
    })

    return success(event, {
      collectionName,
    })
  }

  async function sortCollectionSchemas(event) {
    const authError = requireSuperAdmin(event)
    if (authError) return authError

    const items = Array.isArray(event?.data?.items) ? event.data.items : []
    if (items.length === 0) {
      return fail(event, 40001, 'items is required')
    }

    const now = Date.now()
    const operator = pickOperator(event)
    const result = await db.collection(collections.collections).get()
    const collectionDocs = (result.data || []).filter((item) => item.status !== 'deleted')
    const collectionDocMap = new Map(collectionDocs.map((item) => [item.collectionName, item]))

    for (const item of items) {
      const collectionName = String(item?.collectionName || '').trim()
      const sortOrder = Number(item?.sortOrder)

      if (!collectionName || !Number.isFinite(sortOrder)) {
        return fail(event, 40002, 'invalid sort items')
      }

      const current = collectionDocMap.get(collectionName)
      if (!current?._id) {
        return fail(event, 40404, `模型 ${collectionName} 不存在`)
      }
    }

    await Promise.all(
      items.map((item) => {
        const collectionName = String(item.collectionName).trim()
        const current = collectionDocMap.get(collectionName)

        return db.collection(collections.collections).doc(current._id).update({
          sortOrder: Number(item.sortOrder),
          updateTime: now,
          updateBy: operator,
        })
      }),
    )

    const list = collectionDocs
      .map((item) => {
        const matched = items.find((sortItem) => sortItem.collectionName === item.collectionName)
        return matched ? { ...item, sortOrder: Number(matched.sortOrder), updateTime: now, updateBy: operator } : item
      })
      .sort(compareCollectionSortOrder)
      .map(normalizeCollectionSummary)

    return success(event, { list })
  }

  async function assignMenuGroup(event) {
    const authError = requireSuperAdmin(event)
    if (authError) return authError

    const collectionNames = Array.isArray(event?.data?.collectionNames) ? event.data.collectionNames : []
    const menuGroupId = event?.data?.menuGroupId ?? null

    if (collectionNames.length === 0) {
      return fail(event, 40001, 'collectionNames is required')
    }

    const now = Date.now()
    const operator = pickOperator(event)
    const result = await db.collection(collections.collections).get()
    const collectionDocs = (result.data || []).filter((item) => item.status !== 'deleted')
    const collectionDocMap = new Map(collectionDocs.map((item) => [item.collectionName, item]))

    for (const name of collectionNames) {
      if (!collectionDocMap.get(String(name).trim())?._id) {
        return fail(event, 40404, `模型 ${name} 不存在`)
      }
    }

    const nextMenuGroupId = menuGroupId === null || menuGroupId === '' ? '' : String(menuGroupId).trim()

    await Promise.all(
      collectionNames.map((name) => {
        const current = collectionDocMap.get(String(name).trim())
        return db.collection(collections.collections).doc(current._id).update({
          menuGroupId: nextMenuGroupId,
          updateTime: now,
          updateBy: operator,
        })
      }),
    )

    return success(event, {})
  }

  return {
    listCollectionSchemas,
    getCollectionSchemaDetail,
    saveCollectionSchema,
    deleteCollectionSchema,
    sortCollectionSchemas,
    assignMenuGroup,
  }
}

module.exports = {
  createSchemaActions,
}
