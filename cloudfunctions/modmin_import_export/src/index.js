const cloudbase = require('@cloudbase/node-sdk')
const { getJwtSecret, createAuthHelpers } = require('./auth.js')
const { success, fail, resolveFriendlyErrorMessage } = require('./response.js')
const { createPermissionHelpers } = require('./permissions.js')
const { createImportExportActions } = require('./actions.js')
const { createQueryHelpers } = require('../shared/query-helpers.js')
const { createJobHelpers } = require('./jobs.js')
const { createAuditLogger } = require('../shared/audit-log.js')
const { createWebhookDeliveryHelpers } = require('../shared/webhook-delivery.js')

const app = cloudbase.init({
  env: cloudbase.SYMBOL_CURRENT_ENV,
})

const db = app.database()
const command = db.command
const collectionPrefix = process.env.MODMIN_COLLECTION_PREFIX || 'modmin_'
const jwtSecret = getJwtSecret()
const { emitAuditLogSafe } = createAuditLogger({ db })
const webhookDeliveryHelpers = createWebhookDeliveryHelpers({
  db,
  collections: {
    webhooks: `${collectionPrefix}webhooks`,
    webhookDeliveries: `${collectionPrefix}webhook_deliveries`,
  },
  app,
})

const COLLECTIONS = {
  collections: process.env.MODMIN_COLLECTIONS_COLLECTION || `${collectionPrefix}collections`,
  rolePermissions: `${collectionPrefix}role_permissions`,
  adminRoles: process.env.MODMIN_ADMIN_ROLES_COLLECTION || `${collectionPrefix}admin_roles`,
  jobs: `${collectionPrefix}import_export_jobs`,
}

const { buildWhereCondition, buildListQuery } = createQueryHelpers(db, command)
const authHelpers = createAuthHelpers({ jwtSecret, fail })
const permissionHelpers = createPermissionHelpers({
  db,
  collections: COLLECTIONS,
  fail,
  getCurrentRoleCode: authHelpers.getCurrentRoleCode,
  isSuperAdmin: authHelpers.isSuperAdmin,
})
const jobs = createJobHelpers({
  db,
  collectionName: COLLECTIONS.jobs,
})
const allowMockFileBase64 = process.env.MODMIN_ALLOW_IMPORT_EXPORT_MOCK_FILE_BASE64 === 'true'

const ACTION_HANDLERS = createImportExportActions({
  app,
  db,
  success,
  fail,
  jobs,
  command,
  buildWhereCondition,
  buildListQuery,
  getCollectionDoc: permissionHelpers.getCollectionDoc,
  listTransferCollections: permissionHelpers.listTransferCollections,
  ensureTransferPermission: permissionHelpers.ensureTransferPermission,
  pickOperator: authHelpers.pickOperator,
  emitAuditLogSafe,
  enqueueWebhookDeliveries: webhookDeliveryHelpers.enqueueWebhookDeliveries,
  allowMockFileBase64,
})

exports.main = async (event) => {
  const { action = '' } = event || {}

  try {
    const handler = ACTION_HANDLERS[action]
    return handler ? await handler(event) : fail(event, 40002, 'illegal action')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'import export function failed'
    return fail(event, 50001, resolveFriendlyErrorMessage(message))
  }
}
