const cloudbase = require('@cloudbase/node-sdk')
const { success, fail } = require('./response.js')
const { getJwtSecret, createAuthHelpers } = require('./auth.js')
const { createAuditActions } = require('./actions.js')

const app = cloudbase.init({
  env: cloudbase.SYMBOL_CURRENT_ENV,
})

const db = app.database()
const command = db.command
const collectionPrefix = process.env.MODMIN_COLLECTION_PREFIX || 'modmin_'
const jwtSecret = getJwtSecret()

const COLLECTIONS = {
  auditLogs: process.env.MODMIN_AUDIT_LOGS_COLLECTION || `${collectionPrefix}audit_logs`,
}

const { requireSuperAdmin } = createAuthHelpers({
  jwtSecret,
  fail,
})

const { listAuditLogs, getAuditLogDetail } = createAuditActions({
  db,
  collections: COLLECTIONS,
  command,
  success,
  fail,
  requireSuperAdmin,
})

const ACTION_HANDLERS = {
  listAuditLogs,
  getAuditLogDetail,
}

exports.main = async (event) => {
  const { action = '' } = event || {}

  try {
    const handler = ACTION_HANDLERS[action]
    return handler ? await handler(event) : fail(event, 40002, 'illegal action')
  } catch (error) {
    return fail(event, 50001, error instanceof Error ? error.message : 'audit function failed')
  }
}
