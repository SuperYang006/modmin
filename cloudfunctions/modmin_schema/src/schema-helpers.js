const { createFieldNormalizers } = require('./field-normalizers.js')
const { createSchemaBuilders } = require('./schema-builders.js')

function createSchemaHelpers({ fieldMeta }) {
  const DEFAULT_ROLE_OPTIONS = [
    { roleCode: 'role_super_admin', roleName: '超级管理员' },
    { roleCode: 'role_operator', roleName: '运营人员' },
  ]

  const fieldMetaMap = new Map(fieldMeta.map((item) => [item.value, item]))
  const RESERVED_FIELD_KEYS = new Set([
    'modmin_createTime',
    'modmin_createBy',
    'modmin_updateTime',
    'modmin_updateBy',
    'modmin_isDeleted',
    'modmin_deleteTime',
    'modmin_deleteBy',
  ])
  function isBuiltinPrimaryKeyField(fieldKey) {
    return String(fieldKey || '').trim() === '_id'
  }

  function getFieldMeta(type) {
    return fieldMetaMap.get(type) || fieldMetaMap.get('text')
  }

  function listFieldTypesBySupport(key) {
    return new Set(fieldMeta.filter((item) => item?.supports?.[key]).map((item) => item.value))
  }

  const FIELD_TYPES = new Set(fieldMeta.map((item) => item.value))
  const TEXT_LIKE_TYPES = listFieldTypesBySupport('minLength')
  const NUMBER_TYPES = listFieldTypesBySupport('minValue')
  const ARRAY_TYPES = listFieldTypesBySupport('itemType')
  const ENUM_TYPES = listFieldTypesBySupport('enumOptions')
  const MEDIA_TYPES = listFieldTypesBySupport('accept')
  const ITEM_COUNT_TYPES = new Set(
    fieldMeta.filter((item) => item?.supports?.minItems || item?.supports?.maxItems).map((item) => item.value),
  )
  const MULTI_VALUE_TYPES = listFieldTypesBySupport('allowMultiple')
  const RELATION_TYPES = listFieldTypesBySupport('relationModelCollection')
  const POLY_RELATION_TYPES = listFieldTypesBySupport('relationModelCollections')
  const ALL_RELATION_TYPES = new Set([...RELATION_TYPES, ...POLY_RELATION_TYPES])

  const { validateAndNormalizeFieldDraft } = createFieldNormalizers({
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
  })
  const {
    normalizeCollectionSummary,
    compareCollectionSortOrder,
    normalizeSystemFieldSettings,
    buildRuntimeField,
    buildLayoutSchema,
    buildPages,
    buildStoredField,
    listFieldDocs,
    buildSchemaDetail,
  } = createSchemaBuilders({
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
  })

  return {
    DEFAULT_ROLE_OPTIONS,
    FIELD_TYPES,
    TEXT_LIKE_TYPES,
    NUMBER_TYPES,
    ARRAY_TYPES,
    ENUM_TYPES,
    MEDIA_TYPES,
    ITEM_COUNT_TYPES,
    RELATION_TYPES,
    POLY_RELATION_TYPES,
    isBuiltinPrimaryKeyField,
    getFieldMeta,
    validateAndNormalizeFieldDraft,
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
  createSchemaHelpers,
}
