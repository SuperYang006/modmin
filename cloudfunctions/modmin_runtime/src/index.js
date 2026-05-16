const cloudbase = require('@cloudbase/node-sdk')
const fieldMetaConfig = require('./field-meta.js')
const { success, fail } = require('./response.js')
const { getJwtSecret, createAuthHelpers } = require('./auth.js')
const { createModelPermissionHelpers } = require('./model-permission.js')
const { createRuntimeSchemaBuilders } = require('./runtime-schema.js')
const { createRuntimeActions } = require('./actions.js')

const fieldMeta = Array.isArray(fieldMetaConfig?.fields) ? fieldMetaConfig.fields : []

const app = cloudbase.init({
  env: cloudbase.SYMBOL_CURRENT_ENV,
})

const db = app.database()
const collectionPrefix = process.env.MODMIN_COLLECTION_PREFIX || 'modmin_'
const jwtSecret = getJwtSecret()

const COLLECTIONS = {
  collections: process.env.MODMIN_COLLECTIONS_COLLECTION || `${collectionPrefix}collections`,
  rolePermissions: `${collectionPrefix}role_permissions`,
  adminRoles: process.env.MODMIN_ADMIN_ROLES_COLLECTION || `${collectionPrefix}admin_roles`,
}
const { getCurrentRoleCode, isSuperAdmin } = createAuthHelpers({ jwtSecret })
const { checkModelPermission, getModelByPageCode } = createModelPermissionHelpers({
  db,
  collections: COLLECTIONS,
  getCurrentRoleCode,
  isSuperAdmin,
})
const { buildPageRuntimeSchema } = createRuntimeSchemaBuilders({ fieldMeta })
const { getPageRuntimeSchema } = createRuntimeActions({
  success,
  fail,
  isSuperAdmin,
  checkModelPermission,
  getModelByPageCode,
  buildPageRuntimeSchema,
})

const ACTION_HANDLERS = {
  getPageRuntimeSchema,
}

exports.main = async (event) => {
  const { action = '' } = event || {}

  try {
    const handler = ACTION_HANDLERS[action]
    return handler ? await handler(event) : fail(event, 40002, 'illegal action')
  } catch (error) {
    return fail(event, 50001, error instanceof Error ? error.message : 'runtime function failed')
  }
}
