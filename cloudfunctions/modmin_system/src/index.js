const cloudbase = require('@cloudbase/node-sdk')
const { success, fail, resolveFriendlyErrorMessage } = require('./response.js')
const { getJwtSecret, createAuthHelpers } = require('./auth.js')
const { createSystemHelpers } = require('./system-helpers.js')
const { hashPassword, generateSalt } = require('./password.js')
const { createSystemActions } = require('./actions.js')
const { createAuditLogger } = require('../shared/audit-log.js')

const app = cloudbase.init({
  env: cloudbase.SYMBOL_CURRENT_ENV,
})

const db = app.database()
const command = db.command
const collectionPrefix = process.env.MODMIN_COLLECTION_PREFIX || 'modmin_'
const jwtSecret = getJwtSecret()
const { emitAuditLogSafe } = createAuditLogger({ db })

const COLLECTIONS = {
  adminRoles: process.env.MODMIN_ADMIN_ROLES_COLLECTION || `${collectionPrefix}admin_roles`,
  menuGroups: process.env.MODMIN_MENU_GROUPS_COLLECTION || `${collectionPrefix}menu_groups`,
  collections: process.env.MODMIN_COLLECTIONS_COLLECTION || `${collectionPrefix}collections`,
  adminUsers: `${collectionPrefix}admin_users`,
  rolePermissions: `${collectionPrefix}role_permissions`,
  sessions: `${collectionPrefix}sessions`,
  webhooks: `${collectionPrefix}webhooks`,
  webhookDeliveries: `${collectionPrefix}webhook_deliveries`,
}

const {
  parseAccessToken,
  getCurrentRoleCode,
  ensureSuperAdmin,
  pickOperator,
} = createAuthHelpers({ jwtSecret })
const {
  BUILTIN_ROLE_CODES,
  safeDbGet,
  normalizeRoleItem,
  normalizeMenuGroupItem,
  isRoleDisabled,
  normalizeAdminUser,
} = createSystemHelpers({
  db,
  collections: COLLECTIONS,
  command,
  pickOperator,
})
const {
  listRoles,
  saveRole,
  listMenuGroups,
  saveMenuGroup,
  deleteMenuGroup,
  getMyPermissions,
  getRolePermissions,
  saveRolePermissions,
  listAdminUsers,
  saveAdminUser,
  deleteAdminUser,
  disableAdminUser,
  getConsoleOverview,
} = createSystemActions({
  db,
  collections: COLLECTIONS,
  command,
  success,
  fail,
  parseAccessToken,
  getCurrentRoleCode,
  ensureSuperAdmin,
  pickOperator,
  BUILTIN_ROLE_CODES,
  safeDbGet,
  normalizeRoleItem,
  normalizeMenuGroupItem,
  isRoleDisabled,
  normalizeAdminUser,
  hashPassword,
  generateSalt,
  emitAuditLogSafe,
})

const ACTION_HANDLERS = {
  listRoles,
  saveRole,
  listMenuGroups,
  saveMenuGroup,
  deleteMenuGroup,
  getMyPermissions,
  getRolePermissions,
  saveRolePermissions,
  listAdminUsers,
  saveAdminUser,
  deleteAdminUser,
  disableAdminUser,
  getConsoleOverview,
}

exports.main = async (event) => {
  const { action = '' } = event || {}

  try {
    const handler = ACTION_HANDLERS[action]
    return handler ? await handler(event) : fail(event, 40002, 'illegal action')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'system function failed'
    return fail(event, 50001, resolveFriendlyErrorMessage(message))
  }
}
