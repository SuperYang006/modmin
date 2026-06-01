const SYSTEM_FIELDS = [
  { fieldKey: '_id', fieldName: '_id', label: '记录 ID', type: 'text' },
  { fieldKey: 'modmin_createTime', fieldName: 'modmin_createTime', label: '创建时间', type: 'datetime' },
  { fieldKey: 'modmin_createBy', fieldName: 'modmin_createBy', label: '创建人', type: 'text' },
  { fieldKey: 'modmin_updateTime', fieldName: 'modmin_updateTime', label: '更新时间', type: 'datetime' },
  { fieldKey: 'modmin_updateBy', fieldName: 'modmin_updateBy', label: '更新人', type: 'text' },
]

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

function getFieldKey(field) {
  return field?.fieldKey || field?.key || ''
}

function getFieldLabel(field) {
  return field?.title || field?.label || getFieldKey(field)
}

function listModelFields(modelDoc) {
  return Array.isArray(modelDoc?.fields) ? modelDoc.fields : []
}

function listExportableFields(modelDoc) {
  return [...listModelFields(modelDoc), ...SYSTEM_FIELDS]
}

function listImportableFields(modelDoc) {
  return listModelFields(modelDoc).filter((field) => {
    const fieldKey = getFieldKey(field)
    return IMPORTABLE_TYPES.has(field.type) && !RESERVED_IMPORT_FIELD_KEYS.has(fieldKey)
  })
}

function buildAddressHeaders(field) {
  const baseLabel = getFieldLabel(field)
  const headers = [`${baseLabel}-省`]
  if (field.addressGranularity === 'city' || field.addressGranularity === 'district') {
    headers.push(`${baseLabel}-市`)
  }
  if (field.addressGranularity === 'district') {
    headers.push(`${baseLabel}-区`)
  }
  return headers
}

module.exports = {
  SYSTEM_FIELDS,
  RESERVED_IMPORT_FIELD_KEYS,
  getFieldKey,
  getFieldLabel,
  listModelFields,
  listExportableFields,
  listImportableFields,
  buildAddressHeaders,
}
