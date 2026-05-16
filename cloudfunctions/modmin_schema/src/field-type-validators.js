const {
  normalizePolyRelationDisplayMap,
  normalizePolyRelationLimitMap,
} = require('./field-normalizer-utils.js')

function validateLocationValue(value, config = {}) {
  if (value === '' || value === null || value === undefined) {
    return { ok: true }
  }

  let parsed = value

  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value)
    } catch {
      return {
        ok: false,
        message: '位置字段默认值必须是合法 JSON 对象',
      }
    }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      ok: false,
      message: '位置字段默认值必须是合法 JSON 对象',
    }
  }

  if (typeof parsed.lng !== 'number' || Number.isNaN(parsed.lng)) {
    return {
      ok: false,
      message: '位置字段默认值必须包含数字类型的 lng',
    }
  }

  if (typeof parsed.lat !== 'number' || Number.isNaN(parsed.lat)) {
    return {
      ok: false,
      message: '位置字段默认值必须包含数字类型的 lat',
    }
  }

  if (config.locationRequireAddress && (typeof parsed.address !== 'string' || !parsed.address.trim())) {
    return {
      ok: false,
      message: '位置字段默认值必须包含 address',
    }
  }

  if (config.locationRequireName && (typeof parsed.name !== 'string' || !parsed.name.trim())) {
    return {
      ok: false,
      message: '位置字段默认值必须包含 name',
    }
  }

  return { ok: true }
}

function validateAddressValue(value, granularity) {
  if (value === '' || value === null || value === undefined) {
    return { ok: true }
  }

  let parsed = value

  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value)
    } catch {
      return {
        ok: false,
        message: '地址字段默认值必须是合法 JSON 对象',
      }
    }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      ok: false,
      message: '地址字段默认值必须是合法 JSON 对象',
    }
  }

  if (typeof parsed.province !== 'string' || !parsed.province.trim()) {
    return {
      ok: false,
      message: '地址字段默认值必须包含 province',
    }
  }

  if ((granularity === 'city' || granularity === 'district') && (typeof parsed.city !== 'string' || !parsed.city.trim())) {
    return {
      ok: false,
      message: '当前地址粒度必须包含 city',
    }
  }

  if (granularity === 'district' && (typeof parsed.district !== 'string' || !parsed.district.trim())) {
    return {
      ok: false,
      message: '当前地址粒度必须包含 district',
    }
  }

  return { ok: true }
}

function validateJsonDefaultValue(type, field, jsonValueType, title) {
  if (type !== 'json' || field.defaultValue === '' || field.defaultValue === null || field.defaultValue === undefined) {
    return { ok: true }
  }

  try {
    const parsed = typeof field.defaultValue === 'string' ? JSON.parse(field.defaultValue) : field.defaultValue

    if (jsonValueType === 'object' && (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))) {
      return {
        ok: false,
        message: `字段 ${title} 的默认值必须是合法 JSON 对象`,
      }
    }

    if (jsonValueType === 'array' && !Array.isArray(parsed)) {
      return {
        ok: false,
        message: `字段 ${title} 的默认值必须是合法 JSON 数组`,
      }
    }
  } catch {
    return {
      ok: false,
      message: `字段 ${title} 的默认值必须是合法 JSON`,
    }
  }

  return { ok: true }
}

function validateRelationConfig(type, field, title, RELATION_TYPES) {
  const relationModelCollection = RELATION_TYPES.has(type) && typeof field.relationModelCollection === 'string'
    ? field.relationModelCollection.trim()
    : ''
  const relationDisplayFields = RELATION_TYPES.has(type)
    ? Array.isArray(field.relationDisplayFields)
      ? field.relationDisplayFields.map((item) => String(item).trim()).filter(Boolean)
      : typeof field.relationDisplayField === 'string' && field.relationDisplayField.trim()
        ? [field.relationDisplayField.trim()]
        : []
    : []

  if (RELATION_TYPES.has(type)) {
    if (!relationModelCollection) {
      return {
        ok: false,
        message: `字段 ${title} 必须配置关联模型`,
      }
    }

    if (relationDisplayFields.length === 0) {
      return {
        ok: false,
        message: `字段 ${title} 至少需要配置一个展示字段`,
      }
    }
  }

  return {
    ok: true,
    relationModelCollection,
    relationDisplayFields,
  }
}

function validatePolyRelationConfig(type, field, title, POLY_RELATION_TYPES) {
  const relationModelCollections = POLY_RELATION_TYPES.has(type) && Array.isArray(field.relationModelCollections)
    ? field.relationModelCollections.map((item) => String(item).trim()).filter(Boolean)
    : []
  const polyRelationDisplayMap = POLY_RELATION_TYPES.has(type) ? normalizePolyRelationDisplayMap(field.polyRelationDisplayMap) : {}
  const polyRelationLimitMap = type === 'multiPolyRelation' ? normalizePolyRelationLimitMap(field.polyRelationLimitMap) : {}

  if (POLY_RELATION_TYPES.has(type) && relationModelCollections.length === 0) {
    return {
      ok: false,
      message: `字段 ${title} 至少需要配置一个可关联模型`,
    }
  }

  if (POLY_RELATION_TYPES.has(type)) {
    for (const collection of relationModelCollections) {
      const fields = Array.isArray(polyRelationDisplayMap[collection]) ? polyRelationDisplayMap[collection] : []

      if (fields.length === 0) {
        return {
          ok: false,
          message: `字段 ${title} 中模型 ${collection} 至少需要配置一个展示字段`,
        }
      }

      if (type === 'multiPolyRelation') {
        const limit = polyRelationLimitMap[collection] && typeof polyRelationLimitMap[collection] === 'object'
          ? polyRelationLimitMap[collection]
          : {}

        if (
          typeof limit.minItems === 'number' &&
          typeof limit.maxItems === 'number' &&
          limit.minItems > limit.maxItems
        ) {
          return {
            ok: false,
            message: `字段 ${title} 中模型 ${collection} 的最少关联数不能大于最多关联数`,
          }
        }
      }
    }
  }

  return {
    ok: true,
    relationModelCollections,
    polyRelationDisplayMap,
    polyRelationLimitMap,
  }
}

module.exports = {
  validateLocationValue,
  validateAddressValue,
  validateJsonDefaultValue,
  validateRelationConfig,
  validatePolyRelationConfig,
}
