function createRuntimeSchemaBuilders({ fieldMeta }) {
  const fieldMetaMap = new Map(fieldMeta.map((item) => [item.value, item]))
  const DEFAULT_SYSTEM_FIELD_SETTINGS = {
    showCmsCreateTime: true,
    showCmsUpdateTime: true,
    defaultSortField: 'modmin_createTime',
    defaultSortOrder: 'desc',
    searchFieldKeys: [],
  }

  function isBuiltinPrimaryKeyField(fieldKey) {
    return String(fieldKey || '').trim() === '_id'
  }

  function getFieldMeta(type) {
    return fieldMetaMap.get(type) || fieldMetaMap.get('text')
  }

  function getFieldComponentByType(type) {
    const renderer = getFieldMeta(type)?.formRenderer

    if (renderer === 'textarea') return 'textarea'
    if (type === 'number') return 'text'
    if (renderer === 'boolean') return 'boolean'
    if (renderer === 'date') return 'date'
    if (renderer === 'datetime') return 'datetime'
    if (renderer === 'image') return 'image'
    if (renderer === 'file') return 'file'
    if (renderer === 'video') return 'video'
    if (renderer === 'audio') return 'audio'
    if (renderer === 'select') return 'select'
    if (renderer === 'array') return 'array'
    if (renderer === 'polyRelation') return 'polyRelation'
    if (renderer === 'multiPolyRelation') return 'multiPolyRelation'
    if (renderer === 'json') return 'json'

    return 'text'
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
      validationRules.push({
        ruleType: 'required',
        message: `请输入${field.title}`,
      })
    }

    if (typeof field.minLength === 'number') {
      validationRules.push({
        ruleType: 'minLength',
        value: field.minLength,
        message: `${field.title}至少需要 ${field.minLength} 个字符`,
      })
    }

    if (typeof field.maxLength === 'number') {
      validationRules.push({
        ruleType: 'maxLength',
        value: field.maxLength,
        message: `${field.title}最多支持 ${field.maxLength} 个字符`,
      })
    }

    if (typeof field.minValue === 'number') {
      validationRules.push({
        ruleType: 'minValue',
        value: field.minValue,
        message: `${field.title}不能小于 ${field.minValue}`,
      })
    }

    if (typeof field.maxValue === 'number') {
      validationRules.push({
        ruleType: 'maxValue',
        value: field.maxValue,
        message: `${field.title}不能大于 ${field.maxValue}`,
      })
    }

    if (typeof field.minItems === 'number') {
      validationRules.push({
        ruleType: 'minItems',
        value: field.minItems,
        message: `${field.title}至少需要 ${field.minItems} 项`,
      })
    }

    if (typeof field.maxItems === 'number') {
      validationRules.push({
        ruleType: 'maxItems',
        value: field.maxItems,
        message: `${field.title}最多支持 ${field.maxItems} 项`,
      })
    }

    return {
      fieldKey: field.fieldKey || field.key,
      fieldName: field.fieldName || field.key,
      label: field.title || field.label || field.key,
      type: field.type,
      required: field.required || false,
      hidden: field.hidden || false,
      allowMultiple: field.allowMultiple || false,
      description: field.description || '',
      defaultValue: field.defaultValue || '',
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
      enumOptions: Array.isArray(field.enumOptions) ? field.enumOptions : [],
      accept: Array.isArray(field.accept) ? field.accept : [],
      maxFileSizeMB: field.maxFileSizeMB,
      assetStorageMode: field.assetStorageMode === 'url' ? 'url' : 'object',
      readonlyOnCreate: field.key === '_id' ? true : field.readonlyOnCreate === true,
      readonlyOnEdit: field.key === '_id' || String(field.key).startsWith('modmin_') ? true : field.readonlyOnEdit === true,
      sortable: ['text', 'textarea', 'richtext', 'markdown', 'number', 'boolean', 'date', 'datetime', 'enum'].includes(field.type)
        ? field.sortable || false
        : false,
      sortDirection: field.sortDirection || undefined,
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
        visibleOnCreate: isBuiltinPrimaryKeyField(field.fieldKey || field.key) ? false : true,
        visibleOnEdit: true,
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
        visible: true,
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

  function buildSystemRuntimeFields(systemFieldSettings = DEFAULT_SYSTEM_FIELD_SETTINGS, startIndex = 0) {
    const settings = normalizeSystemFieldSettings(systemFieldSettings)
    const fields = [
      {
        ...buildRuntimeField(
          {
            key: '_id',
            title: '文档 ID',
            type: 'text',
            description: '数据库自动生成的主键 ID',
            hidden: false,
            readonlyOnCreate: true,
            readonlyOnEdit: true,
          },
          startIndex,
        ),
        listConfig: {
          visible: settings.showIdInList !== false,
          width: 220,
          sortOrder: (startIndex + 1) * 10,
        },
        searchConfig: {
          visible: false,
          operator: 'eq',
          component: 'input',
          sortOrder: (startIndex + 1) * 10,
        },
        formConfig: {
          visibleOnCreate: false,
          visibleOnEdit: true,
          readonlyOnCreate: true,
          readonlyOnEdit: true,
          component: 'text',
          groupKey: 'basic',
          span: 24,
          sortOrder: (startIndex + 1) * 10,
        },
        detailConfig: {
          visible: true,
          groupKey: 'basic',
          sortOrder: (startIndex + 1) * 10,
        },
      },
    ]

    if (settings.showCmsCreateTime) {
      fields.push(
        buildRuntimeField(
          {
            key: 'modmin_createTime',
            title: '系统创建时间',
            type: 'datetime',
            description: '系统自动记录的创建时间',
            dateStorageFormat: 'timestampMs',
            sortable: true,
            sortDirection: settings.defaultSortField === 'modmin_createTime' ? settings.defaultSortOrder : undefined,
            hidden: false,
          },
          startIndex + fields.length,
        ),
      )
    }

    if (settings.showCmsUpdateTime) {
      fields.push(
        buildRuntimeField(
          {
            key: 'modmin_updateTime',
            title: '系统更新时间',
            type: 'datetime',
            description: '系统自动记录的最后更新时间',
            dateStorageFormat: 'timestampMs',
            sortable: true,
            sortDirection: settings.defaultSortField === 'modmin_updateTime' ? settings.defaultSortOrder : undefined,
            hidden: false,
          },
          startIndex + fields.length,
        ),
      )
    }

    return fields
  }

  function buildPermissionKey(collectionName, action) {
    return `${collectionName}:${action}`
  }

  function buildPageRuntimeSchema(modelDoc, perm) {
    const canCreate = perm ? perm.canCreate === true : true
    const canUpdate = perm ? perm.canUpdate === true : true
    const canDelete = perm ? perm.canDelete === true : true

    const modelFields = [...(modelDoc.fields || [])]
      .filter((field) => !isBuiltinPrimaryKeyField(field?.fieldKey || field?.key))
      .map((field, index) => buildRuntimeField(field, index))
    const systemFieldSettings = normalizeSystemFieldSettings(modelDoc.systemFieldSettings)
    const systemFields = buildSystemRuntimeFields(systemFieldSettings, modelFields.length)
    const fields = [...modelFields, ...systemFields]
    const fieldByKey = new Map(fields.map((field) => [field.fieldKey, field]))
    const searchFieldKeys = Array.isArray(systemFieldSettings.searchFieldKeys) ? systemFieldSettings.searchFieldKeys : []
    const searchConfigVisibleKeys = new Set(searchFieldKeys.filter((fieldKey) => fieldByKey.get(fieldKey)?.searchConfig?.visible))
    const searchFields = fields.filter((field) => searchConfigVisibleKeys.has(field.fieldKey))
    const canList = true

    return {
      page: {
        pageCode: modelDoc.pageCode,
        pageName: modelDoc.modelName || modelDoc.collectionName,
        pageType: 'generatedCrud',
      },
      collection: {
        collectionName: modelDoc.collectionName,
        title: modelDoc.modelName || modelDoc.collectionName,
        primaryKey: '_id',
      },
      fields,
      systemFieldSettings,
      dictMap: {},
      tableSchema: {
        rowKey: '_id',
        selection: false,
      },
      formSchema: {
        mode: 'drawer',
      },
      detailSchema: {
        enabled: true,
      },
      layoutSchema: buildLayoutSchema(fields),
      searchFields,
      actions: {
        toolbar: !canCreate
          ? []
          : [
              {
                actionKey: 'create',
                label: '新增',
                actionType: 'builtin',
                permissionKey: buildPermissionKey(modelDoc.collectionName, 'create'),
              },
            ],
        row: [
          ...(!canUpdate
            ? []
            : [
                {
                  actionKey: 'edit',
                  label: '编辑',
                  actionType: 'builtin',
                  permissionKey: buildPermissionKey(modelDoc.collectionName, 'update'),
                },
              ]),
          ...(!canDelete
            ? []
            : [
                {
                  actionKey: 'delete',
                  label: '删除',
                  actionType: 'builtin',
                  permissionKey: buildPermissionKey(modelDoc.collectionName, 'delete'),
                  confirmText: '确认删除该记录吗',
                },
              ]),
        ],
        batch: [],
      },
      permissions: {
        canList,
        canCreate,
        canUpdate,
        canDelete,
        fieldPermissions: {},
      },
    }
  }

  return {
    isBuiltinPrimaryKeyField,
    getFieldMeta,
    getFieldComponentByType,
    getSearchOperatorByType,
    getSearchComponentByType,
    buildRuntimeField,
    buildLayoutSchema,
    normalizeSystemFieldSettings,
    buildSystemRuntimeFields,
    buildPermissionKey,
    buildPageRuntimeSchema,
  }
}

module.exports = {
  createRuntimeSchemaBuilders,
}
