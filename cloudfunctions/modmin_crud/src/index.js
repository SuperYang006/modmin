const cloudbase = require('@cloudbase/node-sdk')
const { parseAccessToken, isSuperAdmin, pickOperator } = require('./auth.js')
const { success, fail, resolveFriendlyErrorMessage } = require('./response.js')
const { createQueryHelpers } = require('../shared/query-helpers.js')
const { createModelPermissionHelpers } = require('./model-permission.js')
const { createRecordHandlers } = require('./records.js')
const { createAuditLogger } = require('../shared/audit-log.js')
const { createWebhookDeliveryHelpers } = require('../shared/webhook-delivery.js')
const {
  hydrateStructuredFieldValue,
  writeStructuredFieldToFlatRecord,
  hydrateRecordFromSchemaFields,
  pickRecordFields,
  omitImmutableFields,
  validateAndNormalizeFieldValue,
  stripSystemFields,
  rejectReadonlyFieldChanges,
} = require('../shared/crud-fields.js')

const app = cloudbase.init({
  env: cloudbase.SYMBOL_CURRENT_ENV,
})

const db = app.database()
const _ = db.command
const { emitAuditLogSafe } = createAuditLogger({ db })
const webhookDeliveryHelpers = createWebhookDeliveryHelpers({
  db,
  collections: {
    webhooks: `${process.env.MODMIN_COLLECTION_PREFIX || 'modmin_'}webhooks`,
    webhookDeliveries: `${process.env.MODMIN_COLLECTION_PREFIX || 'modmin_'}webhook_deliveries`,
  },
  app,
})
const { buildWhereCondition, buildListQuery } = createQueryHelpers(db, _)
const collectionPrefix = process.env.MODMIN_COLLECTION_PREFIX || 'modmin_'

const COLLECTIONS = {
  collections: process.env.MODMIN_COLLECTIONS_COLLECTION || `${collectionPrefix}collections`,
  rolePermissions: `${collectionPrefix}role_permissions`,
  adminRoles: process.env.MODMIN_ADMIN_ROLES_COLLECTION || `${collectionPrefix}admin_roles`,
}
const { getModelDoc, checkModelPermission } = createModelPermissionHelpers({
  db,
  collections: COLLECTIONS,
  fail,
  parseAccessToken,
  isSuperAdmin,
})

const { listRecords, getDetail, createRecord, updateRecord, deleteRecord } = createRecordHandlers({
  db,
  checkModelPermission,
  getModelDoc,
  buildWhereCondition,
  buildListQuery,
  success,
  fail,
  pickOperator,
  hydrateStructuredFieldValue,
  writeStructuredFieldToFlatRecord,
  hydrateRecordFromSchemaFields,
  pickRecordFields,
  omitImmutableFields,
  validateAndNormalizeFieldValue,
  stripSystemFields,
  rejectReadonlyFieldChanges,
  emitAuditLogSafe,
  enqueueWebhookDeliveries: webhookDeliveryHelpers.enqueueWebhookDeliveries,
})

const ACTION_HANDLERS = {
  list: listRecords,
  detail: getDetail,
  create: createRecord,
  update: updateRecord,
  delete: deleteRecord,
}

exports.main = async (event) => {
  const { action = '' } = event || {}

  try {
    const handler = ACTION_HANDLERS[action]
    return handler ? await handler(event) : fail(event, 40002, 'illegal action')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'crud function failed'
    const friendlyMessage = resolveFriendlyErrorMessage(message)
    return fail(event, 50001, friendlyMessage)
  }
}
