const cloudbase = require('@cloudbase/node-sdk')
const fieldMetaConfig = require('./field-meta.js')
const { success, fail } = require('./response.js')
const { getJwtSecret, createAuthHelpers } = require('./auth.js')
const { createModelPermissionHelpers } = require('./model-permission.js')
const { createSchemaHelpers } = require('./schema-helpers.js')
const { createSchemaActions } = require('./actions.js')
const { createAuditLogger } = require('../shared/audit-log.js')

const fieldMeta = Array.isArray(fieldMetaConfig?.fields) ? fieldMetaConfig.fields : []
const app = cloudbase.init({
  env: cloudbase.SYMBOL_CURRENT_ENV,
})

const db = app.database()
const collectionPrefix = process.env.MODMIN_COLLECTION_PREFIX || 'modmin_'
const jwtSecret = getJwtSecret()
const { emitAuditLogSafe } = createAuditLogger({ db })

const COLLECTIONS = {
  collections: process.env.MODMIN_COLLECTIONS_COLLECTION || `${collectionPrefix}collections`,
  rolePermissions: `${collectionPrefix}role_permissions`,
  adminRoles: process.env.MODMIN_ADMIN_ROLES_COLLECTION || `${collectionPrefix}admin_roles`,
}

const { getCurrentRoleCode, isSuperAdmin, requireSuperAdmin, pickOperator } = createAuthHelpers({
  jwtSecret,
  fail,
})
const { getAllowedCollectionNames, getCollectionDoc } = createModelPermissionHelpers({
  db,
  collections: COLLECTIONS,
})
const {
  isBuiltinPrimaryKeyField,
  validateAndNormalizeFieldDraft,
  normalizeCollectionSummary,
  compareCollectionSortOrder,
  normalizeSystemFieldSettings,
  buildRuntimeField,
  buildStoredField,
  listFieldDocs,
  buildSchemaDetail,
} = createSchemaHelpers({ fieldMeta })
const {
  listCollectionSchemas,
  getCollectionSchemaDetail,
  listBusinessDirectories,
  saveCollectionSchema,
  deleteCollectionSchema,
  sortCollectionSchemas,
  assignMenuGroup,
} = createSchemaActions({
  db,
  collections: COLLECTIONS,
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
})

const ACTION_HANDLERS = {
  listCollectionSchemas,
  getCollectionSchemaDetail,
  saveCollectionSchema,
  deleteCollectionSchema,
  sortCollectionSchemas,
  assignMenuGroup,
}

exports.main = async (event) => {
  const { action = '' } = event || {}

  try {
    const handler = ACTION_HANDLERS[action]
    return handler ? await handler(event) : fail(event, 40002, 'illegal action')
  } catch (error) {
    return fail(event, 50001, error instanceof Error ? error.message : 'schema function failed')
  }
}
