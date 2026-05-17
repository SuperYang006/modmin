const SYSTEM_FIELD_KEYS = new Set([
  '_id',
  'modmin_createTime',
  'modmin_createBy',
  'modmin_updateTime',
  'modmin_updateBy',
  'modmin_isDeleted',
  'modmin_deleteTime',
  'modmin_deleteBy',
])

function normalizeRecordValueByType(type, value) {
  if (value === '' || value === null || value === undefined) {
    return value
  }

  if (type === 'number') {
    return typeof value === 'number' ? value : Number(value)
  }

  if (type === 'boolean') {
    if (value === true || value === false) {
      return value
    }

    if (value === 'true') {
      return true
    }

    if (value === 'false') {
      return false
    }
  }

  if (type === 'json') {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value)
      } catch {
        return value
      }
    }
  }

  if (type === 'location') {
    const parsed = normalizeLocationValue(value)
    return parsed || value
  }

  if (type === 'address') {
    const parsed = normalizeAddressValue(value)
    return parsed || value
  }

  return value
}

function formatDateFieldValue(field, nextDate) {
  if (field?.dateStorageFormat === 'timestamp') {
    return Math.floor(nextDate.getTime() / 1000)
  }

  if (field?.dateStorageFormat === 'timestampMs') {
    return nextDate.getTime()
  }

  return valueToIsoString(field.type, nextDate)
}

function parseDateFieldValue(field, value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(value.getTime())
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const time =
      field?.dateStorageFormat === 'timestamp'
        ? value * 1000
        : field?.dateStorageFormat === 'timestampMs'
          ? value
          : value < 1e11
            ? value * 1000
            : value
    const date = new Date(time)
    return Number.isNaN(date.getTime()) ? null : date
  }

  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()

  if (!trimmed) {
    return null
  }

  if (/^\d+$/.test(trimmed)) {
    const numericValue = Number(trimmed)
    if (!Number.isFinite(numericValue)) {
      return null
    }
    const time =
      field?.dateStorageFormat === 'timestamp'
        ? numericValue * 1000
        : field?.dateStorageFormat === 'timestampMs'
          ? numericValue
          : trimmed.length <= 10 || numericValue < 1e11
            ? numericValue * 1000
            : numericValue
    const date = new Date(time)
    return Number.isNaN(date.getTime()) ? null : date
  }

  const date = new Date(trimmed)
  return Number.isNaN(date.getTime()) ? null : date
}

function valueToIsoString(type, date) {
  if (type === 'date') {
    return date.toISOString().slice(0, 10)
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

function parseAssetValue(value) {
  if (!value) {
    return null
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (parsed && typeof parsed === 'object') {
        return parsed
      }
    } catch {
      if (value.startsWith('cloud://') || value.startsWith('http')) {
        return {
          fileID: value.startsWith('cloud://') ? value : '',
          url: value,
          name: value.split('/').pop() || 'file',
        }
      }
    }
  }

  if (typeof value === 'object') {
    return value
  }

  return null
}

function normalizeAssetValue(value) {
  const asset = parseAssetValue(value)

  if (!asset || typeof asset !== 'object') {
    return null
  }

  const nextValue = {
    fileID: typeof asset.fileID === 'string' ? asset.fileID : '',
    path: typeof asset.path === 'string' ? asset.path : '',
    fullPath: typeof asset.fullPath === 'string' ? asset.fullPath : '',
    url: typeof asset.url === 'string' ? asset.url : '',
    name: typeof asset.name === 'string' ? asset.name : '',
    contentType: typeof asset.contentType === 'string' ? asset.contentType : '',
    size: typeof asset.size === 'number' && asset.size >= 0 ? asset.size : undefined,
  }

  if (!nextValue.path && nextValue.fileID.startsWith('cloud://')) {
    const matched = nextValue.fileID.match(/^cloud:\/\/[^/]+\/(.+)$/)
    nextValue.path = matched?.[1] || ''
  }

  if (!nextValue.fullPath) {
    nextValue.fullPath = nextValue.fileID || nextValue.url || nextValue.path
  }

  if (!nextValue.fileID && !nextValue.path && !nextValue.fullPath && !nextValue.url) {
    return null
  }

  if (!nextValue.name) {
    nextValue.name =
      nextValue.path.split('/').pop() ||
      nextValue.fullPath.split('/').pop() ||
      nextValue.fileID.split('/').pop() ||
      'file'
  }

  return nextValue
}

function isImageContentType(contentType) {
  return typeof contentType === 'string' && contentType.startsWith('image/')
}

function isVideoContentType(contentType) {
  return typeof contentType === 'string' && contentType.startsWith('video/')
}

function isAudioContentType(contentType) {
  return typeof contentType === 'string' && contentType.startsWith('audio/')
}

function parsePossibleArrayValue(value) {
  if (Array.isArray(value)) {
    return value
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : null
    } catch {
      return null
    }
  }

  return null
}

function parseRelationManyValue(value) {
  if (Array.isArray(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = parsePossibleArrayValue(value)
    if (parsed) {
      return parsed
    }

    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }

  return null
}

function parseLocationValue(value) {
  if (!value) {
    return null
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
    } catch {
      return null
    }
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    return value
  }

  return null
}

function normalizeLocationValue(value) {
  const location = parseLocationValue(value)

  if (!location) {
    return null
  }

  const lng = typeof location.lng === 'number' ? location.lng : Number(location.lng)
  const lat = typeof location.lat === 'number' ? location.lat : Number(location.lat)

  if (Number.isNaN(lng) || Number.isNaN(lat)) {
    return null
  }

  return {
    lng,
    lat,
    address: typeof location.address === 'string' ? location.address : '',
    name: typeof location.name === 'string' ? location.name : '',
    coordinateSystem: location.coordinateSystem === 'wgs84' ? 'wgs84' : 'gcj02',
  }
}

function parseAddressValue(value) {
  if (!value) {
    return null
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
    } catch {
      return null
    }
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    return value
  }

  return null
}

function normalizeAddressValue(value) {
  const address = parseAddressValue(value)

  if (!address) {
    return null
  }

  return {
    province: typeof address.province === 'string' ? address.province.trim() : '',
    city: typeof address.city === 'string' ? address.city.trim() : '',
    district: typeof address.district === 'string' ? address.district.trim() : '',
  }
}

function buildLocationValueFromFlatRecord(field, record) {
  const lngField = field.locationLngField
  const latField = field.locationLatField

  if (!lngField || !latField) {
    return undefined
  }

  const lng = record?.[lngField]
  const lat = record?.[latField]
  const address = field.locationAddressField ? record?.[field.locationAddressField] : ''
  const name = field.locationNameField ? record?.[field.locationNameField] : ''

  if (
    (lng === undefined || lng === null || lng === '') &&
    (lat === undefined || lat === null || lat === '') &&
    (address === undefined || address === null || address === '') &&
    (name === undefined || name === null || name === '')
  ) {
    return undefined
  }

  return {
    lng,
    lat,
    address,
    name,
    coordinateSystem: field.locationCoordinateSystem === 'wgs84' ? 'wgs84' : 'gcj02',
  }
}

function buildAddressValueFromFlatRecord(field, record) {
  const provinceField = field.addressProvinceField

  if (!provinceField) {
    return undefined
  }

  const province = record?.[provinceField]
  const city = field.addressCityField ? record?.[field.addressCityField] : ''
  const district = field.addressDistrictField ? record?.[field.addressDistrictField] : ''

  if (
    (province === undefined || province === null || province === '') &&
    (city === undefined || city === null || city === '') &&
    (district === undefined || district === null || district === '')
  ) {
    return undefined
  }

  return {
    province,
    city,
    district,
  }
}

function hydrateStructuredFieldValue(field, record) {
  const fieldKey = field.fieldKey || field.key

  if (field.type === 'location' && field.locationStorageMode === 'flat') {
    return buildLocationValueFromFlatRecord(field, record)
  }

  if (field.type === 'address' && field.addressStorageMode === 'flat') {
    return buildAddressValueFromFlatRecord(field, record)
  }

  return record?.[fieldKey]
}

function writeStructuredFieldToFlatRecord(field, normalizedValue, targetRecord) {
  if (field.type === 'location' && field.locationStorageMode === 'flat') {
    targetRecord[field.locationLngField] = normalizedValue?.lng ?? null
    targetRecord[field.locationLatField] = normalizedValue?.lat ?? null

    if (field.locationAddressField) {
      targetRecord[field.locationAddressField] = normalizedValue?.address || ''
    }

    if (field.locationNameField) {
      targetRecord[field.locationNameField] = normalizedValue?.name || ''
    }

    delete targetRecord[field.fieldKey || field.key]
  }

  if (field.type === 'address' && field.addressStorageMode === 'flat') {
    targetRecord[field.addressProvinceField] = normalizedValue?.province || ''

    if (field.addressCityField) {
      targetRecord[field.addressCityField] = normalizedValue?.city || ''
    }

    if (field.addressDistrictField) {
      targetRecord[field.addressDistrictField] = normalizedValue?.district || ''
    }

    delete targetRecord[field.fieldKey || field.key]
  }
}

function hydrateRecordFromSchemaFields(fields, record) {
  if (!record || typeof record !== 'object') {
    return record
  }

  const nextRecord = { ...record }

  for (const field of fields || []) {
    const fieldKey = field.fieldKey || field.key

    if (!fieldKey || !field?.type) {
      continue
    }

    if (field.type === 'location' && field.locationStorageMode === 'flat') {
      const value = buildLocationValueFromFlatRecord(field, record)
      if (value !== undefined) {
        nextRecord[fieldKey] = value
      }
    }

    if (field.type === 'address' && field.addressStorageMode === 'flat') {
      const value = buildAddressValueFromFlatRecord(field, record)
      if (value !== undefined) {
        nextRecord[fieldKey] = value
      }
    }
  }

  return nextRecord
}

function pickRecordFields(record, fieldKeys = []) {
  if (!record || typeof record !== 'object') {
    return record
  }

  if (!Array.isArray(fieldKeys) || fieldKeys.filter(Boolean).length === 0) {
    return record
  }

  const requiredKeys = new Set([
    '_id',
    'modmin_createTime',
    'modmin_updateTime',
    ...fieldKeys.filter(Boolean),
  ])

  return Array.from(requiredKeys).reduce((acc, key) => {
    if (Object.prototype.hasOwnProperty.call(record, key)) {
      acc[key] = record[key]
    }

    return acc
  }, {})
}

function omitImmutableFields(record) {
  if (!record || typeof record !== 'object') {
    return {}
  }

  const { _id, ...rest } = record
  return rest
}

function inferContentTypeFromName(name) {
  const lowerName = typeof name === 'string' ? name.toLowerCase().split('?')[0].split('#')[0] : ''

  if (/\.(png|jpg|jpeg|gif|webp|svg|bmp|avif)$/.test(lowerName)) {
    return 'image/*'
  }

  if (/\.(mp4|webm|mov|m4v|mpeg|mpg|avi)$/.test(lowerName)) {
    return 'video/*'
  }

  if (/\.(mp3|wav|ogg|aac|m4a|flac)$/.test(lowerName)) {
    return 'audio/*'
  }

  return ''
}

function matchAcceptRule(contentType, name, rule) {
  if (!rule) {
    return true
  }

  const nextContentType = contentType || inferContentTypeFromName(name)

  if (rule.endsWith('/*')) {
    const prefix = rule.slice(0, -1)
    return typeof nextContentType === 'string' && nextContentType.startsWith(prefix)
  }

  if (rule.startsWith('.')) {
    return typeof name === 'string' && name.toLowerCase().endsWith(rule.toLowerCase())
  }

  return nextContentType === rule
}

function validateAssetAccept(asset, accept) {
  if (!Array.isArray(accept) || accept.length === 0) {
    return true
  }

  return accept.some((rule) => matchAcceptRule(asset.contentType, asset.name, rule))
}

function normalizeAssetValues(value, allowMultiple) {
  if (allowMultiple) {
    if (Array.isArray(value)) {
      return value.map((item) => normalizeAssetValue(item)).filter(Boolean)
    }

    const parsed = parseAssetValue(value)
    if (Array.isArray(parsed)) {
      return parsed.map((item) => normalizeAssetValue(item)).filter(Boolean)
    }

    const single = normalizeAssetValue(value)
    return single ? [single] : []
  }

  const single = normalizeAssetValue(value)
  return single ? [single] : []
}

function pickAssetUrlValue(asset) {
  if (!asset || typeof asset !== 'object') {
    return ''
  }

  return asset.fileID || asset.fullPath || asset.url || asset.path || ''
}

// ─── Field helper utilities ────────────────────────────────────────────────

function getFieldKey(field) {
  return field.fieldKey || field.key
}

function getFieldLabel(field) {
  return field.title || field.label || field.fieldKey
}

function fieldError(field, message) {
  return { ok: false, fieldKey: getFieldKey(field), message }
}

// ─── Per-type field validators ─────────────────────────────────────────────

function validateTextField(field, value) {
  if (typeof value !== 'string') return { ok: true, value }
  if (typeof field.minLength === 'number' && value.length < field.minLength) {
    return fieldError(field, `${getFieldLabel(field)} 长度不能少于 ${field.minLength}`)
  }
  if (typeof field.maxLength === 'number' && value.length > field.maxLength) {
    return fieldError(field, `${getFieldLabel(field)} 长度不能超过 ${field.maxLength}`)
  }
  return { ok: true, value }
}

function validateNumberField(field, value) {
  const nextValue = typeof value === 'number' ? value : Number(value)
  if (Number.isNaN(nextValue)) {
    return fieldError(field, `${getFieldLabel(field)} 必须是数字`)
  }
  if (typeof field.minValue === 'number' && nextValue < field.minValue) {
    return fieldError(field, `${getFieldLabel(field)} 不能小于 ${field.minValue}`)
  }
  if (typeof field.maxValue === 'number' && nextValue > field.maxValue) {
    return fieldError(field, `${getFieldLabel(field)} 不能大于 ${field.maxValue}`)
  }
  return { ok: true, value: nextValue }
}

function validateBooleanField(field, value) {
  if (value === true || value === false) return { ok: true, value }
  if (value === 'true') return { ok: true, value: true }
  if (value === 'false') return { ok: true, value: false }
  return fieldError(field, `${getFieldLabel(field)} 必须是布尔值`)
}

function validateJsonField(field, value) {
  if (typeof value !== 'string') return { ok: true, value }
  let parsed
  try {
    parsed = JSON.parse(value)
  } catch {
    return fieldError(field, `${getFieldLabel(field)} 必须是合法 JSON`)
  }
  if (field.jsonValueType === 'object' && (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))) {
    return fieldError(field, `${getFieldLabel(field)} 必须是合法 JSON 对象`)
  }
  if (field.jsonValueType === 'array' && !Array.isArray(parsed)) {
    return fieldError(field, `${getFieldLabel(field)} 必须是合法 JSON 数组`)
  }
  return { ok: true, value: parsed }
}

function validateLocationField(field, value) {
  const nextValue = normalizeLocationValue(value)
  if (!nextValue) {
    return fieldError(field, `${getFieldLabel(field)} 必须是合法位置对象，且包含 lng 和 lat`)
  }
  if (field.locationRequireAddress === true && !nextValue.address) {
    return fieldError(field, `${getFieldLabel(field)} 必须包含 address`)
  }
  if (field.locationRequireName === true && !nextValue.name) {
    return fieldError(field, `${getFieldLabel(field)} 必须包含 name`)
  }
  return {
    ok: true,
    value: { ...nextValue, coordinateSystem: field.locationCoordinateSystem === 'wgs84' ? 'wgs84' : 'gcj02' },
  }
}

function validateAddressField(field, value) {
  const nextValue = normalizeAddressValue(value)
  const granularity = field.addressGranularity || 'district'
  if (!nextValue || !nextValue.province) {
    return fieldError(field, `${getFieldLabel(field)} 必须包含省`)
  }
  if ((granularity === 'city' || granularity === 'district') && !nextValue.city) {
    return fieldError(field, `${getFieldLabel(field)} 必须包含市`)
  }
  if (granularity === 'district' && !nextValue.district) {
    return fieldError(field, `${getFieldLabel(field)} 必须包含区`)
  }
  return { ok: true, value: nextValue }
}

function validateEnumField(field, value) {
  const enumOptions = Array.isArray(field.enumOptions) ? field.enumOptions : []
  const normalizedValue = String(value)
  if (!enumOptions.some((item) => item?.value === normalizedValue)) {
    return fieldError(field, `${getFieldLabel(field)} 必须在枚举选项内`)
  }
  if (field.enumValueType === 'number') {
    const numericValue = Number(normalizedValue)
    if (!Number.isFinite(numericValue)) {
      return fieldError(field, `${getFieldLabel(field)} 必须是数字`)
    }
    return { ok: true, value: numericValue }
  }
  return { ok: true, value: normalizedValue }
}

function validateArrayField(field, value) {
  const items = parsePossibleArrayValue(value)
  if (!items) {
    if ((value === '' || value === null || value === undefined) && typeof field.minItems === 'number') {
      return fieldError(field, `${getFieldLabel(field)} 至少需要 ${field.minItems} 项`)
    }
    return fieldError(field, `${getFieldLabel(field)} 必须是数组`)
  }
  const itemType = typeof field.itemType === 'string' ? field.itemType : 'text'
  if (itemType !== 'boolean') {
    const emptyIndex = items.findIndex((item) => {
      if (item === null || item === undefined) return true
      if (itemType === 'number') {
        return typeof item === 'number' ? !Number.isFinite(item) : !Number.isFinite(Number(String(item).trim()))
      }
      return typeof item === 'string' ? item.trim() === '' : String(item) === ''
    })
    if (emptyIndex >= 0) {
      return fieldError(field, `${getFieldLabel(field)} 第 ${emptyIndex + 1} 项不能为空`)
    }
  }
  if (typeof field.minItems === 'number' && items.length < field.minItems) {
    return fieldError(field, `${getFieldLabel(field)} 至少需要 ${field.minItems} 项`)
  }
  if (typeof field.maxItems === 'number' && items.length > field.maxItems) {
    return fieldError(field, `${getFieldLabel(field)} 最多支持 ${field.maxItems} 项`)
  }
  return { ok: true, value: items }
}

function validateRelationField(field, value) {
  const normalizedValue = String(value).trim()
  if (!normalizedValue) {
    return fieldError(field, `${getFieldLabel(field)} 必须是有效关联 ID`)
  }
  return { ok: true, value: normalizedValue }
}

function validateMultiRelationField(field, value) {
  const items = parseRelationManyValue(value)
  if (!items) {
    if ((value === '' || value === null || value === undefined) && typeof field.minItems === 'number') {
      return fieldError(field, `${getFieldLabel(field)} 至少需要 ${field.minItems} 项`)
    }
    return fieldError(field, `${getFieldLabel(field)} 必须是关联 ID 数组`)
  }
  const normalizedItems = items.map((item) => String(item).trim()).filter(Boolean)
  if (typeof field.minItems === 'number' && normalizedItems.length < field.minItems) {
    return fieldError(field, `${getFieldLabel(field)} 至少需要 ${field.minItems} 项`)
  }
  if (typeof field.maxItems === 'number' && normalizedItems.length > field.maxItems) {
    return fieldError(field, `${getFieldLabel(field)} 最多支持 ${field.maxItems} 项`)
  }
  return { ok: true, value: normalizedItems }
}

function validatePolyRelationField(field, value) {
  let parsed = value
  if (typeof value === 'string') {
    try { parsed = JSON.parse(value) } catch { parsed = null }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return fieldError(field, `${getFieldLabel(field)} 必须是合法关联对象`)
  }
  const collection = typeof parsed.collection === 'string' ? parsed.collection.trim() : ''
  const id = typeof parsed.id === 'string' ? parsed.id.trim() : ''
  if (!collection || !id) {
    return fieldError(field, `${getFieldLabel(field)} 必须包含 collection 和 id`)
  }
  if (Array.isArray(field.relationModelCollections) && field.relationModelCollections.length > 0 && !field.relationModelCollections.includes(collection)) {
    return fieldError(field, `${getFieldLabel(field)} 关联模型不在允许范围内`)
  }
  return { ok: true, value: { collection, id } }
}

function validateMultiPolyRelationField(field, value) {
  const items = parsePossibleArrayValue(value)
  if (!items) {
    if ((value === '' || value === null || value === undefined) && typeof field.minItems === 'number') {
      return fieldError(field, `${getFieldLabel(field)} 至少需要 ${field.minItems} 项`)
    }
    return fieldError(field, `${getFieldLabel(field)} 必须是关联对象数组`)
  }
  const normalizedItems = []
  const uniqueSet = new Set()
  const groupedCount = {}
  for (const item of items) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return fieldError(field, `${getFieldLabel(field)} 中每一项都必须是对象`)
    }
    const collection = typeof item.collection === 'string' ? item.collection.trim() : ''
    const id = typeof item.id === 'string' ? item.id.trim() : ''
    if (!collection || !id) {
      return fieldError(field, `${getFieldLabel(field)} 中每一项都必须包含 collection 和 id`)
    }
    if (Array.isArray(field.relationModelCollections) && field.relationModelCollections.length > 0 && !field.relationModelCollections.includes(collection)) {
      return fieldError(field, `${getFieldLabel(field)} 中存在不允许的关联模型`)
    }
    const uniqueKey = `${collection}::${id}`
    if (field.relationRecordsUnique !== false) {
      if (uniqueSet.has(uniqueKey)) {
        return fieldError(field, `${getFieldLabel(field)} 不能包含重复关联记录`)
      }
      uniqueSet.add(uniqueKey)
    }
    normalizedItems.push({ collection, id })
    groupedCount[collection] = (groupedCount[collection] || 0) + 1
  }
  const limitMap = field.polyRelationLimitMap && typeof field.polyRelationLimitMap === 'object' ? field.polyRelationLimitMap : {}
  const collectionKeys = Array.isArray(field.relationModelCollections) ? field.relationModelCollections : Object.keys(groupedCount)
  for (const collection of collectionKeys) {
    const currentCount = groupedCount[collection] || 0
    const limit = limitMap[collection] && typeof limitMap[collection] === 'object' ? limitMap[collection] : {}
    if (typeof limit.minItems === 'number' && currentCount < limit.minItems) {
      return fieldError(field, `${getFieldLabel(field)} 中模型 ${collection} 至少需要 ${limit.minItems} 条关联`)
    }
    if (typeof limit.maxItems === 'number' && currentCount > limit.maxItems) {
      return fieldError(field, `${getFieldLabel(field)} 中模型 ${collection} 最多支持 ${limit.maxItems} 条关联`)
    }
  }
  return { ok: true, value: normalizedItems }
}

function validateDateField(field, value) {
  const nextDate = parseDateFieldValue(field, value)
  if (!nextDate) {
    return fieldError(field, `${getFieldLabel(field)} 必须是合法日期`)
  }
  return { ok: true, value: formatDateFieldValue(field, nextDate) }
}

function validateAssetField(field, value) {
  const assets = normalizeAssetValues(value, field.allowMultiple)
  if (!assets.length) {
    if (typeof field.minItems === 'number') {
      return fieldError(field, `${getFieldLabel(field)} 至少需要上传 ${field.minItems} 个资源`)
    }
    return fieldError(field, `${getFieldLabel(field)} 必须是合法的上传文件`)
  }
  if (field.type === 'image' && assets.some((asset) => asset.contentType && !isImageContentType(asset.contentType))) {
    return fieldError(field, `${getFieldLabel(field)} 必须是图片文件`)
  }
  if (field.type === 'file' && assets.some((asset) => asset.contentType && isImageContentType(asset.contentType))) {
    return fieldError(field, `${getFieldLabel(field)} 应上传通用文件，不是图片字段`)
  }
  if (field.type === 'video' && assets.some((asset) => asset.contentType && !isVideoContentType(asset.contentType))) {
    return fieldError(field, `${getFieldLabel(field)} 必须是视频文件`)
  }
  if (field.type === 'audio' && assets.some((asset) => asset.contentType && !isAudioContentType(asset.contentType))) {
    return fieldError(field, `${getFieldLabel(field)} 必须是音频文件`)
  }
  if (typeof field.minItems === 'number' && assets.length < field.minItems) {
    return fieldError(field, `${getFieldLabel(field)} 至少需要上传 ${field.minItems} 个资源`)
  }
  if (typeof field.maxItems === 'number' && assets.length > field.maxItems) {
    return fieldError(field, `${getFieldLabel(field)} 最多支持上传 ${field.maxItems} 个资源`)
  }
  if (assets.some((asset) => !validateAssetAccept(asset, field.accept))) {
    return fieldError(field, `${getFieldLabel(field)} 上传资源类型不符合限制`)
  }
  return {
    ok: true,
    value: field.assetStorageMode === 'url'
      ? field.allowMultiple
        ? assets.map((asset) => pickAssetUrlValue(asset)).filter(Boolean)
        : pickAssetUrlValue(assets[0])
      : field.allowMultiple ? assets : assets[0],
  }
}

// ─── Field validator registry ──────────────────────────────────────────────

const FIELD_VALIDATORS = new Map([
  ['text', validateTextField],
  ['textarea', validateTextField],
  ['richtext', validateTextField],
  ['markdown', validateTextField],
  ['number', validateNumberField],
  ['boolean', validateBooleanField],
  ['json', validateJsonField],
  ['location', validateLocationField],
  ['address', validateAddressField],
  ['enum', validateEnumField],
  ['array', validateArrayField],
  ['relation', validateRelationField],
  ['multiRelation', validateMultiRelationField],
  ['polyRelation', validatePolyRelationField],
  ['multiPolyRelation', validateMultiPolyRelationField],
  ['date', validateDateField],
  ['datetime', validateDateField],
  ['image', validateAssetField],
  ['file', validateAssetField],
  ['video', validateAssetField],
  ['audio', validateAssetField],
])

function validateAndNormalizeFieldValue(field, value) {
  if (!field?.type) return { ok: true, value }
  if (
    (value === '' || value === null || value === undefined) &&
    !(typeof field.minItems === 'number' && field.minItems > 0)
  ) {
    return { ok: true, value }
  }
  const validator = FIELD_VALIDATORS.get(field.type)
  if (!validator) return { ok: true, value: normalizeRecordValueByType(field.type, value) }
  return validator(field, value)
}

function stripSystemFields(record) {
  if (!record || typeof record !== 'object') {
    return {}
  }

  return Object.keys(record).reduce((acc, key) => {
    if (!SYSTEM_FIELD_KEYS.has(key)) {
      acc[key] = record[key]
    }

    return acc
  }, {})
}

function getReadonlyFieldKeys(fields, mode) {
  return new Set(
    (Array.isArray(fields) ? fields : [])
      .filter((field) => {
        const fieldKey = field.fieldKey || field.key

        if (!fieldKey) {
          return false
        }

        if (fieldKey === '_id') {
          return true
        }

        if (mode === 'create') {
          return field.readonlyOnCreate === true
        }

        return field.readonlyOnEdit === true || String(fieldKey).startsWith('modmin_')
      })
      .map((field) => field.fieldKey || field.key),
  )
}

function rejectReadonlyFieldChanges(fields, currentRecord, inputRecord, mode) {
  const readonlyFieldKeys = getReadonlyFieldKeys(fields, mode)

  for (const key of readonlyFieldKeys) {
    if (mode === 'create') {
      if (inputRecord[key] !== undefined && inputRecord[key] !== '' && inputRecord[key] !== null) {
        return {
          ok: false,
          fieldKey: key,
          message: `${key} 为只读字段，不允许手动设置`,
        }
      }
      continue
    }

    if (Object.prototype.hasOwnProperty.call(inputRecord, key) && inputRecord[key] !== currentRecord?.[key]) {
      return {
        ok: false,
        fieldKey: key,
        message: `${key} 为只读字段，不允许修改`,
      }
    }
  }

  return { ok: true }
}

module.exports = {
  hydrateStructuredFieldValue,
  writeStructuredFieldToFlatRecord,
  hydrateRecordFromSchemaFields,
  pickRecordFields,
  omitImmutableFields,
  validateAndNormalizeFieldValue,
  stripSystemFields,
  rejectReadonlyFieldChanges,
}
