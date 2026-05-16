function createSchemaBuilders(deps) {
  const {
    getFieldMeta,
    TEXT_LIKE_TYPES,
    NUMBER_TYPES,
    ARRAY_TYPES,
    ENUM_TYPES,
    MEDIA_TYPES,
    ITEM_COUNT_TYPES,
    RELATION_TYPES,
    POLY_RELATION_TYPES,
    isBuiltinPrimaryKeyField,
  } = deps

  function formatDateTime(timestamp) {
    const date = new Date(timestamp)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const seconds = String(date.getSeconds()).padStart(2, '0')

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
  }

  function normalizeCollectionSummary(doc) {
    const updatedAt = doc?.updateTime || doc?.createTime || Date.now()

    return {
      collectionName: doc.collectionName,
      modelCode: doc.modelCode,
      modelName: doc.modelName,
      description: doc.description || '',
      pageCode: doc.pageCode,
      icon: typeof doc.icon === 'string' && doc.icon.trim() ? doc.icon.trim() : undefined,
      sortOrder: typeof doc.sortOrder === 'number' ? doc.sortOrder : undefined,
      menuGroupId: typeof doc.menuGroupId === 'string' && doc.menuGroupId.trim() ? doc.menuGroupId.trim() : undefined,
      fieldCount: doc.fieldCount || 0,
      updatedAt: formatDateTime(updatedAt),
    }
  }

  function compareCollectionSortOrder(a, b) {
    const aHasSortOrder = typeof a?.sortOrder === 'number'
    const bHasSortOrder = typeof b?.sortOrder === 'number'

    if (aHasSortOrder && bHasSortOrder && a.sortOrder !== b.sortOrder) {
      return a.sortOrder - b.sortOrder
    }

    if (aHasSortOrder && !bHasSortOrder) return -1
    if (!aHasSortOrder && bHasSortOrder) return 1

    const aCreateTime = Number(a?.createTime || 0)
    const bCreateTime = Number(b?.createTime || 0)

    if (aCreateTime !== bCreateTime) {
      return aCreateTime - bCreateTime
    }

    return String(a?.collectionName || '').localeCompare(String(b?.collectionName || ''))
  }

  function normalizeSystemFieldSettings(settings) {
    const source = settings && typeof settings === 'object' ? settings : {}
    const defaultSortField = source.defaultSortField === 'modmin_updateTime' ? 'modmin_updateTime' : 'modmin_createTime'
    const defaultSortOrder = source.defaultSortOrder === 'asc' ? 'asc' : 'desc'
    const searchFieldKeys = Array.isArray(source.searchFieldKeys)
      ? source.searchFieldKeys.map((item) => String(item).trim()).filter(Boolean)
      : []

    return {
      showIdInList: source.showIdInList !== false,
      showCmsCreateTime: source.showCmsCreateTime !== false,
      showCmsUpdateTime: source.showCmsUpdateTime !== false,
      defaultSortField,
      defaultSortOrder,
      searchFieldKeys,
    }
  }

  function getFieldComponentByType(type) {
    const renderer = getFieldMeta(type)?.formRenderer

    if (renderer === 'textarea') return 'textarea'
    if (type === 'number') return 'numberInput'
    if (renderer === 'boolean') return 'switch'
    if (renderer === 'date') return 'datePicker'
    if (renderer === 'datetime') return 'dateTimePicker'
    if (renderer === 'image') return 'imageUpload'
    if (renderer === 'file') return 'fileUpload'
    if (renderer === 'video') return 'videoUpload'
    if (renderer === 'audio') return 'audioUpload'
    if (renderer === 'select') return 'select'
    if (renderer === 'array') return 'arrayEditor'
    if (renderer === 'json') return 'jsonEditor'

    return 'input'
  }

  function getSearchOperatorByType(type) {
    if (!['text', 'textarea', 'richtext', 'markdown', 'number', 'boolean', 'date', 'datetime', 'enum'].includes(type)) {
      return 'eq'
    }

    if (getFieldMeta(type)?.searchRenderer === 'textarea') {
      return 'like'
    }

    return 'eq'
  }

  function getSearchComponentByType(type) {
    if (!['text', 'textarea', 'richtext', 'markdown', 'number', 'boolean', 'date', 'datetime', 'enum'].includes(type)) {
      return 'input'
    }

    const renderer = getFieldMeta(type)?.searchRenderer

    if (renderer === 'boolean') return 'boolean'
    if (renderer === 'date') return 'date'
    if (renderer === 'datetime') return 'datetime'
    if (renderer === 'select') return 'select'

    return 'input'
  }

  function buildRuntimeField(field, index) {
    const sortOrder = (index + 1) * 10
    const validationRules = []

    if (field.required) {
      validationRules.push({ ruleType: 'required', message: `请输入${field.title}` })
    }

    if (typeof field.minLength === 'number') {
      validationRules.push({ ruleType: 'minLength', value: field.minLength, message: `${field.title}至少需要 ${field.minLength} 个字符` })
    }

    if (typeof field.maxLength === 'number') {
      validationRules.push({ ruleType: 'maxLength', value: field.maxLength, message: `${field.title}最多支持 ${field.maxLength} 个字符` })
    }

    if (typeof field.minValue === 'number') {
      validationRules.push({ ruleType: 'minValue', value: field.minValue, message: `${field.title}不能小于 ${field.minValue}` })
    }

    if (typeof field.maxValue === 'number') {
      validationRules.push({ ruleType: 'maxValue', value: field.maxValue, message: `${field.title}不能大于 ${field.maxValue}` })
    }

    if (typeof field.minItems === 'number') {
      validationRules.push({ ruleType: 'minItems', value: field.minItems, message: `${field.title}至少需要 ${field.minItems} 项` })
    }

    if (typeof field.maxItems === 'number') {
      validationRules.push({ ruleType: 'maxItems', value: field.maxItems, message: `${field.title}最多支持 ${field.maxItems} 项` })
    }

    return {
      fieldKey: field.key,
      fieldName: field.key,
      label: field.title,
      type: field.type,
      required: field.required || false,
      hidden: field.hidden || false,
      allowMultiple: field.allowMultiple || false,
      sortable: ['text', 'textarea', 'richtext', 'markdown', 'number', 'boolean', 'date', 'datetime', 'enum'].includes(field.type)
        ? field.sortable || false
        : false,
      sortDirection: field.sortDirection,
      description: field.description || '',
      defaultValue: field.defaultValue || '',
      ...(TEXT_LIKE_TYPES.has(field.type) ? { minLength: field.minLength, maxLength: field.maxLength } : {}),
      ...(NUMBER_TYPES.has(field.type) ? { minValue: field.minValue, maxValue: field.maxValue } : {}),
      ...(ITEM_COUNT_TYPES.has(field.type) ? { minItems: field.minItems, maxItems: field.maxItems } : {}),
      ...(ARRAY_TYPES.has(field.type) ? { itemType: field.itemType } : {}),
      ...(field.type === 'json' ? { jsonValueType: field.jsonValueType } : {}),
      ...(field.type === 'date' || field.type === 'datetime' ? { dateStorageFormat: field.dateStorageFormat } : {}),
      ...(field.type === 'address' ? {
        addressGranularity: field.addressGranularity,
        addressStorageMode: field.addressStorageMode,
        addressProvinceField: field.addressProvinceField,
        addressCityField: field.addressCityField,
        addressDistrictField: field.addressDistrictField,
      } : {}),
      ...(field.type === 'location' ? {
        locationCoordinateSystem: field.locationCoordinateSystem,
        locationRequireAddress: field.locationRequireAddress,
        locationRequireName: field.locationRequireName,
        locationStorageMode: field.locationStorageMode,
        locationLngField: field.locationLngField,
        locationLatField: field.locationLatField,
        locationAddressField: field.locationAddressField,
        locationNameField: field.locationNameField,
      } : {}),
      ...(RELATION_TYPES.has(field.type) ? {
        relationModelCollection: field.relationModelCollection,
        relationDisplayFields: Array.isArray(field.relationDisplayFields)
          ? field.relationDisplayFields
          : typeof field.relationDisplayField === 'string' && field.relationDisplayField.trim()
            ? [field.relationDisplayField.trim()]
            : [],
      } : {}),
      ...(POLY_RELATION_TYPES.has(field.type) ? {
        relationModelCollections: Array.isArray(field.relationModelCollections) ? field.relationModelCollections : [],
        polyRelationDisplayMap: field.polyRelationDisplayMap && typeof field.polyRelationDisplayMap === 'object' ? field.polyRelationDisplayMap : {},
        polyRelationLimitMap: field.polyRelationLimitMap && typeof field.polyRelationLimitMap === 'object' ? field.polyRelationLimitMap : {},
        relationRecordsUnique: field.relationRecordsUnique !== false,
      } : {}),
      ...(ENUM_TYPES.has(field.type) ? {
        enumOptions: Array.isArray(field.enumOptions) ? field.enumOptions : [],
        enumValueType: field.enumValueType === 'number' ? 'number' : 'string',
      } : {}),
      ...(MEDIA_TYPES.has(field.type) ? {
        accept: Array.isArray(field.accept) ? field.accept : [],
        maxFileSizeMB: field.maxFileSizeMB,
        assetStorageMode: field.assetStorageMode === 'url' ? 'url' : 'object',
      } : {}),
      readonlyOnCreate: field.key === '_id' ? true : field.readonlyOnCreate === true,
      readonlyOnEdit: field.key === '_id' || String(field.key).startsWith('modmin_') ? true : field.readonlyOnEdit === true,
      listConfig: {
        visible: !field.hidden,
        width: field.type === 'image' ? 120 : 180,
        sortOrder,
      },
      searchConfig: {
        visible: ['text', 'textarea', 'richtext', 'markdown', 'number', 'boolean', 'date', 'datetime', 'enum'].includes(field.type)
          ? !field.hidden
          : false,
        operator: getSearchOperatorByType(field.type),
        component: getSearchComponentByType(field.type),
        sortOrder,
      },
      formConfig: {
        visibleOnCreate: !field.hidden,
        visibleOnEdit: !field.hidden,
        readonlyOnCreate: field.key === '_id' ? true : field.readonlyOnCreate === true,
        readonlyOnEdit: field.key === '_id' || String(field.key).startsWith('modmin_') ? true : field.readonlyOnEdit === true,
        component: getFieldComponentByType(field.type),
        groupKey: 'basic',
        span:
          field.type === 'textarea' ||
          field.type === 'richtext' ||
          field.type === 'markdown' ||
          field.type === 'json' ||
          field.type === 'location' ||
          field.type === 'address' ||
          field.type === 'multiRelation' ||
          field.type === 'multiPolyRelation' ||
          field.type === 'array'
            ? 24
            : 12,
        sortOrder,
      },
      detailConfig: {
        visible: !field.hidden,
        groupKey: 'basic',
        sortOrder,
      },
      validationRules,
    }
  }

  function buildLayoutSchema(fields) {
    return {
      layoutMode: 'form',
      groups: [
        {
          groupKey: 'basic',
          title: '基础信息',
          layout: 'twoColumn',
          sortOrder: 10,
          fields: fields.map((field, index) => ({
            fieldKey: field.fieldKey,
            span: field.formConfig?.span || 12,
            sortOrder: (index + 1) * 10,
          })),
        },
      ],
    }
  }

  function buildPages(payload) {
    return [
      {
        pageCode: payload.pageCode,
        pageName: payload.modelName || payload.collectionName,
        pageType: 'generatedCrud',
      },
    ]
  }

  function buildStoredField(field, index, now, operator) {
    const type = field.type
    const isTextLike = TEXT_LIKE_TYPES.has(type)
    const isNumber = NUMBER_TYPES.has(type)
    const isItemCount = ITEM_COUNT_TYPES.has(type)
    const isArray = ARRAY_TYPES.has(type)
    const isEnum = ENUM_TYPES.has(type)
    const isMedia = MEDIA_TYPES.has(type)
    const isDate = type === 'date' || type === 'datetime'
    const isJson = type === 'json'
    const isLocation = type === 'location'
    const isAddress = type === 'address'
    const isRelation = RELATION_TYPES.has(type)
    const isPolyRelation = POLY_RELATION_TYPES.has(type)

    return {
      fieldKey: field.key,
      fieldName: field.key,
      title: field.title,
      label: field.title,
      type,
      description: field.description || '',
      defaultValue: field.defaultValue || '',
      ...(isTextLike ? { minLength: field.minLength, maxLength: field.maxLength } : {}),
      ...(isNumber ? { minValue: field.minValue, maxValue: field.maxValue } : {}),
      ...(isItemCount ? { minItems: field.minItems, maxItems: field.maxItems } : {}),
      ...(isArray ? { itemType: field.itemType || '' } : {}),
      ...(isJson ? { jsonValueType: field.jsonValueType || 'any' } : {}),
      ...(isDate ? { dateStorageFormat: field.dateStorageFormat || 'string' } : {}),
      ...(isAddress ? {
        addressGranularity: field.addressGranularity || 'district',
        addressStorageMode: field.addressStorageMode || 'object',
        addressProvinceField: field.addressProvinceField || '',
        addressCityField: field.addressCityField || '',
        addressDistrictField: field.addressDistrictField || '',
      } : {}),
      ...(isLocation ? {
        locationCoordinateSystem: field.locationCoordinateSystem || 'gcj02',
        locationRequireAddress: field.locationRequireAddress === true,
        locationRequireName: field.locationRequireName === true,
        locationStorageMode: field.locationStorageMode || 'object',
        locationLngField: field.locationLngField || '',
        locationLatField: field.locationLatField || '',
        locationAddressField: field.locationAddressField || '',
        locationNameField: field.locationNameField || '',
      } : {}),
      ...(isRelation ? {
        relationModelCollection: field.relationModelCollection || '',
        relationDisplayFields: Array.isArray(field.relationDisplayFields)
          ? field.relationDisplayFields
          : typeof field.relationDisplayField === 'string' && field.relationDisplayField.trim()
            ? [field.relationDisplayField.trim()]
            : [],
      } : {}),
      ...(isPolyRelation ? {
        relationModelCollections: Array.isArray(field.relationModelCollections) ? field.relationModelCollections : [],
        polyRelationDisplayMap: field.polyRelationDisplayMap && typeof field.polyRelationDisplayMap === 'object' ? field.polyRelationDisplayMap : {},
        polyRelationLimitMap: field.polyRelationLimitMap && typeof field.polyRelationLimitMap === 'object' ? field.polyRelationLimitMap : {},
        relationRecordsUnique: field.relationRecordsUnique !== false,
      } : {}),
      ...(isEnum ? {
        enumOptions: Array.isArray(field.enumOptions) ? field.enumOptions : [],
        enumValueType: field.enumValueType === 'number' ? 'number' : 'string',
      } : {}),
      ...(isMedia ? {
        accept: Array.isArray(field.accept) ? field.accept : [],
        maxFileSizeMB: field.maxFileSizeMB,
        allowMultiple: field.allowMultiple || false,
        assetStorageMode: field.assetStorageMode === 'url' ? 'url' : 'object',
      } : {}),
      required: field.required || false,
      hidden: field.hidden || false,
      readonlyOnCreate: field.key === '_id' ? true : field.readonlyOnCreate === true,
      readonlyOnEdit: field.key === '_id' || String(field.key).startsWith('modmin_') ? true : field.readonlyOnEdit === true,
      sortable: field.sortable || false,
      sortDirection: field.sortDirection || null,
      status: 'enabled',
      createTime: now,
      updateTime: now,
      createBy: operator,
      updateBy: operator,
    }
  }

  function listFieldDocs(collectionDoc) {
    return [...(collectionDoc?.fields || [])].filter((field) => !isBuiltinPrimaryKeyField(field?.fieldKey || field?.key))
  }

  function buildSchemaDetail(collectionDoc, runtimeFields, systemFieldSettings) {
    return {
      collection: normalizeCollectionSummary(collectionDoc),
      fields: runtimeFields,
      systemFieldSettings,
      layoutSchema: buildLayoutSchema(runtimeFields),
      pages: buildPages(collectionDoc),
    }
  }

  return {
    normalizeCollectionSummary,
    compareCollectionSortOrder,
    normalizeSystemFieldSettings,
    buildRuntimeField,
    buildLayoutSchema,
    buildPages,
    buildStoredField,
    listFieldDocs,
    buildSchemaDetail,
  }
}

module.exports = {
  createSchemaBuilders,
}
