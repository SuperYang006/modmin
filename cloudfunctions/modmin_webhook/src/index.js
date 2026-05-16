const cloudbase = require('@cloudbase/node-sdk')
const { success, fail } = require('./response.js')
const { getJwtSecret, createAuthHelpers } = require('./auth.js')
const { createWebhookActions } = require('./actions.js')
const { normalizeWebhookConfig } = require('../shared/webhook.js')
const { createWebhookDeliveryHelpers } = require('../shared/webhook-delivery.js')
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
  webhooks: `${collectionPrefix}webhooks`,
  webhookDeliveries: `${collectionPrefix}webhook_deliveries`,
}

const { requireSuperAdmin, pickOperator } = createAuthHelpers({
  jwtSecret,
  fail,
})

const deliveryHelpers = createWebhookDeliveryHelpers({
  db,
  collections: COLLECTIONS,
  app,
})

const {
  listWebhooks,
  saveWebhook,
  deleteWebhook,
  listWebhookDeliveries,
  processPendingDeliveries,
  retryWebhookDelivery,
  testWebhook,
} = createWebhookActions({
  db,
  collections: COLLECTIONS,
  command,
  success,
  fail,
  requireSuperAdmin,
  pickOperator,
  normalizeWebhookConfig,
  createWebhookDeliveryHelpers: deliveryHelpers,
  emitAuditLogSafe,
})

const ACTION_HANDLERS = {
  listWebhooks,
  saveWebhook,
  deleteWebhook,
  listWebhookDeliveries,
  processPendingDeliveries,
  retryWebhookDelivery,
  testWebhook,
}

exports.main = async (event) => {
  if (event?.Type === 'Timer' || event?.action === 'processPendingDeliveries') {
    return processPendingDeliveries(event)
  }

  const { action = '' } = event || {}

  try {
    const handler = ACTION_HANDLERS[action]
    return handler ? await handler(event) : fail(event, 40002, 'illegal action')
  } catch (error) {
    return fail(event, 50001, error instanceof Error ? error.message : 'webhook function failed')
  }
}
