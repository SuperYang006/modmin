const {
  normalizeOptionalNumber,
  normalizeEnumOptions,
  normalizeMediaAcceptByType,
} = require('./field-normalizer-utils.js')
const {
  validateLocationValue,
  validateAddressValue,
  validateJsonDefaultValue,
  validateRelationConfig,
  validatePolyRelationConfig,
} = require('./field-type-validators.js')

function createFieldNormalizers(deps) {
  const {
    getFieldMeta,
    FIELD_TYPES,
    TEXT_LIKE_TYPES,
    NUMBER_TYPES,
    ARRAY_TYPES,
    ENUM_TYPES,
    MEDIA_TYPES,
    ITEM_COUNT_TYPES,
    MULTI_VALUE_TYPES,
    RELATION_TYPES,
    POLY_RELATION_TYPES,
    ALL_RELATION_TYPES,
    RESERVED_FIELD_KEYS,
  } = deps

  function validateAndNormalizeFieldDraft(field, index) {
    if (!field || typeof field !== 'object') {
      return {
        ok: false,
        message: `第 ${index + 1} 个字段配置无效`,
      }
    }

    const key = typeof field.key === 'string' ? field.key.trim() : ''
    const title = typeof field.title === 'string' ? field.title.trim() : ''
    const type = typeof field.type === 'string' ? field.type.trim() : ''

    if (!key || !title) {
      return {
        ok: false,
        message: `第 ${index + 1} 个字段缺少字段名或展示名`,
      }
    }

    if (RESERVED_FIELD_KEYS.has(key)) {
      return {
        ok: false,
        message: `字段名 ${key} 为系统保留字段，不允许手动创建`,
      }
    }

    if (key === '_id') {
      return {
        ok: false,
        message: '_id 为系统主键，不能作为业务字段配置',
      }
    }

    if (!FIELD_TYPES.has(type)) {
      return {
        ok: false,
        message: `字段 ${title} 使用了不支持的字段类型 ${type}`,
      }
    }

    const minLength = normalizeOptionalNumber(field.minLength)
    const maxLength = normalizeOptionalNumber(field.maxLength)
    const minValue = normalizeOptionalNumber(field.minValue)
    const maxValue = normalizeOptionalNumber(field.maxValue)
    const minItems = normalizeOptionalNumber(field.minItems)
    const maxItems = normalizeOptionalNumber(field.maxItems)
    const maxFileSizeMB = normalizeOptionalNumber(field.maxFileSizeMB)

    if ([minLength, maxLength, minValue, maxValue, minItems, maxItems, maxFileSizeMB].some((item) => item === null)) {
      return {
        ok: false,
        message: `字段 ${title} 的约束值不是合法数字`,
      }
    }

    if (typeof minLength === 'number' && typeof maxLength === 'number' && minLength > maxLength) {
      return {
        ok: false,
        message: `字段 ${title} 的最小长度不能大于最大长度`,
      }
    }

    if (typeof minValue === 'number' && typeof maxValue === 'number' && minValue > maxValue) {
      return {
        ok: false,
        message: `字段 ${title} 的最小值不能大于最大值`,
      }
    }

    if (typeof minItems === 'number' && typeof maxItems === 'number' && minItems > maxItems) {
      return {
        ok: false,
        message: `字段 ${title} 的最少项数不能大于最多项数`,
      }
    }

    const enumOptions = normalizeEnumOptions(field.enumOptions)
    if (ENUM_TYPES.has(type) && enumOptions.length === 0) {
      return {
        ok: false,
        message: `字段 ${title} 至少需要一个枚举选项`,
      }
    }

    const enumValueType = ENUM_TYPES.has(type) && field.enumValueType === 'number' ? 'number' : ENUM_TYPES.has(type) ? 'string' : undefined
    if (enumValueType === 'number' && enumOptions.some((item) => !Number.isFinite(Number(item.value)))) {
      return {
        ok: false,
        message: `字段 ${title} 的数字枚举所有选项值必须能转换为数字`,
      }
    }

    const allowMultiple = MULTI_VALUE_TYPES.has(type) && !ARRAY_TYPES.has(type) ? field.allowMultiple === true : false
    const assetStorageMode = MEDIA_TYPES.has(type) && field.assetStorageMode === 'url' ? 'url' : 'object'
    const itemType = ARRAY_TYPES.has(type) && typeof field.itemType === 'string' ? field.itemType.trim() : undefined
    const jsonValueType =
      type === 'json' && (field.jsonValueType === 'object' || field.jsonValueType === 'array' || field.jsonValueType === 'any')
        ? field.jsonValueType
        : type === 'json'
          ? 'any'
          : undefined

    if (ARRAY_TYPES.has(type) && (!itemType || !FIELD_TYPES.has(itemType) || itemType === 'array')) {
      return {
        ok: false,
        message: `字段 ${title} 的数组元素类型无效`,
      }
    }

    const jsonResult = validateJsonDefaultValue(type, field, jsonValueType, title)
    if (!jsonResult.ok) {
      return jsonResult
    }

    if (type === 'location') {
      const result = validateLocationValue(field.defaultValue, {
        locationRequireAddress: field.locationRequireAddress === true,
        locationRequireName: field.locationRequireName === true,
      })

      if (!result.ok) {
        return {
          ok: false,
          message: `字段 ${title} 的${result.message}`,
        }
      }
    }

    const addressGranularity =
      type === 'address' && (field.addressGranularity === 'province' || field.addressGranularity === 'city' || field.addressGranularity === 'district')
        ? field.addressGranularity
        : undefined

    if (type === 'address') {
      const result = validateAddressValue(field.defaultValue, addressGranularity || 'district')

      if (!result.ok) {
        return {
          ok: false,
          message: `字段 ${title} 的${result.message}`,
        }
      }
    }

    const relationResult = validateRelationConfig(type, field, title, RELATION_TYPES)
    if (!relationResult.ok) {
      return relationResult
    }

    const polyRelationResult = validatePolyRelationConfig(type, field, title, POLY_RELATION_TYPES)
    if (!polyRelationResult.ok) {
      return polyRelationResult
    }

    return {
      ok: true,
      field: {
        key,
        title,
        type,
        description: typeof field.description === 'string' ? field.description.trim() : '',
        defaultValue:
          ALL_RELATION_TYPES.has(type) ? '' : field.defaultValue === undefined || field.defaultValue === null ? '' : String(field.defaultValue),
        minLength: TEXT_LIKE_TYPES.has(type) ? minLength : undefined,
        maxLength: TEXT_LIKE_TYPES.has(type) ? maxLength : undefined,
        minValue: NUMBER_TYPES.has(type) ? minValue : undefined,
        maxValue: NUMBER_TYPES.has(type) ? maxValue : undefined,
        minItems: ITEM_COUNT_TYPES.has(type) && type !== 'multiPolyRelation' ? minItems : undefined,
        maxItems: ITEM_COUNT_TYPES.has(type) && type !== 'multiPolyRelation' ? maxItems : undefined,
        itemType,
        jsonValueType,
        dateStorageFormat: (type === 'date' || type === 'datetime') ? (field.dateStorageFormat || 'string') : undefined,
        addressGranularity: type === 'address' ? (addressGranularity || 'district') : undefined,
        addressStorageMode: type === 'address' && field.addressStorageMode === 'flat' ? 'flat' : type === 'address' ? 'object' : undefined,
        addressProvinceField: type === 'address' && field.addressStorageMode === 'flat' ? String(field.addressProvinceField || '').trim() : undefined,
        addressCityField: type === 'address' && field.addressStorageMode === 'flat' ? String(field.addressCityField || '').trim() : undefined,
        addressDistrictField: type === 'address' && field.addressStorageMode === 'flat' ? String(field.addressDistrictField || '').trim() : undefined,
        locationCoordinateSystem: type === 'location' && field.locationCoordinateSystem === 'wgs84' ? 'wgs84' : type === 'location' ? 'gcj02' : undefined,
        locationRequireAddress: type === 'location' ? field.locationRequireAddress === true : undefined,
        locationRequireName: type === 'location' ? field.locationRequireName === true : undefined,
        locationStorageMode: type === 'location' && field.locationStorageMode === 'flat' ? 'flat' : type === 'location' ? 'object' : undefined,
        locationLngField: type === 'location' && field.locationStorageMode === 'flat' ? String(field.locationLngField || '').trim() : undefined,
        locationLatField: type === 'location' && field.locationStorageMode === 'flat' ? String(field.locationLatField || '').trim() : undefined,
        locationAddressField: type === 'location' && field.locationStorageMode === 'flat' ? String(field.locationAddressField || '').trim() : undefined,
        locationNameField: type === 'location' && field.locationStorageMode === 'flat' ? String(field.locationNameField || '').trim() : undefined,
        relationModelCollection: RELATION_TYPES.has(type) ? relationResult.relationModelCollection : undefined,
        relationModelCollections: POLY_RELATION_TYPES.has(type) ? polyRelationResult.relationModelCollections : undefined,
        polyRelationDisplayMap: POLY_RELATION_TYPES.has(type) ? polyRelationResult.polyRelationDisplayMap : undefined,
        polyRelationLimitMap: type === 'multiPolyRelation' ? polyRelationResult.polyRelationLimitMap : undefined,
        relationRecordsUnique: type === 'multiPolyRelation' ? field.relationRecordsUnique !== false : undefined,
        relationDisplayFields: RELATION_TYPES.has(type) ? relationResult.relationDisplayFields : undefined,
        enumOptions: ENUM_TYPES.has(type) ? enumOptions : [],
        enumValueType: ENUM_TYPES.has(type) ? enumValueType : undefined,
        accept: MEDIA_TYPES.has(type)
          ? normalizeMediaAcceptByType(
              type,
              Array.isArray(field.accept) && field.accept.length > 0 ? field.accept : getFieldMeta(type)?.defaultAccept || [],
              getFieldMeta,
            )
          : [],
        maxFileSizeMB: MEDIA_TYPES.has(type) ? maxFileSizeMB : undefined,
        allowMultiple,
        assetStorageMode: MEDIA_TYPES.has(type) ? assetStorageMode : undefined,
        required: field.required === true,
        hidden: field.hidden === true,
        sortable: field.sortable === true,
        sortDirection: field.sortable === true && field.sortDirection === 'asc' ? 'asc' : 'desc',
      },
    }
  }

  return {
    validateAndNormalizeFieldDraft,
  }
}

module.exports = {
  createFieldNormalizers,
}
