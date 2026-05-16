const crypto = require('node:crypto')
const { sanitizeValue } = require('./sanitize.js')

function matchWebhook(webhook, event) {
  if (!webhook || webhook.status !== 'enabled') return false
  if (!Array.isArray(webhook.events) || !webhook.events.includes(event.eventType)) return false
  if (!webhook.collectionName) return false
  if (webhook.collectionName !== event.resource.collectionName) return false
  if (!['http', 'cloudFunction'].includes(webhook.targetType)) return false

  return true
}

function buildWebhookEvent(payload) {
  const now = Date.now()
  return {
    eventId: payload.eventId || `evt_${now}_${crypto.randomBytes(6).toString('hex')}`,
    eventType: payload.eventType,
    occurredAt: payload.occurredAt || now,
    actor: sanitizeValue(payload.actor || {}),
    resource: sanitizeValue(payload.resource || {}),
    data: {
      before: sanitizeValue(payload.data?.before || null),
      after: sanitizeValue(payload.data?.after || null),
    },
    meta: sanitizeValue(payload.meta || {}),
  }
}

function normalizeWebhookConfig(payload, now, operator, currentDoc) {
  const targetType = payload.targetType === 'cloudFunction' ? 'cloudFunction' : 'http'
  const retryConfig = payload.retryConfig && typeof payload.retryConfig === 'object' ? payload.retryConfig : {}
  const httpConfig = payload.httpConfig && typeof payload.httpConfig === 'object' ? payload.httpConfig : {}
  const cloudFunctionConfig = payload.cloudFunctionConfig && typeof payload.cloudFunctionConfig === 'object'
    ? payload.cloudFunctionConfig
    : {}
  const legacyExtraParams = cloudFunctionConfig.extraParams && typeof cloudFunctionConfig.extraParams === 'object'
    ? cloudFunctionConfig.extraParams
    : {}
  const topLevelExtraParams = payload.extraParams && typeof payload.extraParams === 'object'
    ? payload.extraParams
    : null
  const currentExtraParams = currentDoc?.extraParams && typeof currentDoc.extraParams === 'object'
    ? currentDoc.extraParams
    : {}

  return {
    webhookId: currentDoc?.webhookId || currentDoc?._id || `webhook_${now}`,
    name: String(payload.name || '').trim(),
    description: payload.description ? String(payload.description).trim() : '',
    status: payload.status === 'disabled' ? 'disabled' : 'enabled',
    events: Array.isArray(payload.events) ? payload.events.map((item) => String(item).trim()).filter(Boolean) : [],
    collectionName: String(payload.collectionName || '').trim(),
    targetType,
    extraParams: topLevelExtraParams || legacyExtraParams || currentExtraParams,
    httpConfig: {
      url: httpConfig.url ? String(httpConfig.url).trim() : '',
      method: 'POST',
      headers: httpConfig.headers && typeof httpConfig.headers === 'object' ? httpConfig.headers : {},
      secret: typeof httpConfig.secret === 'string' ? httpConfig.secret : (currentDoc?.httpConfig?.secret || ''),
      timeoutMs: Number(httpConfig.timeoutMs || currentDoc?.httpConfig?.timeoutMs || 3000),
    },
    cloudFunctionConfig: {
      functionName: cloudFunctionConfig.functionName ? String(cloudFunctionConfig.functionName).trim() : '',
      action: cloudFunctionConfig.action ? String(cloudFunctionConfig.action).trim() : 'handleModminWebhook',
      timeoutMs: Number(cloudFunctionConfig.timeoutMs || currentDoc?.cloudFunctionConfig?.timeoutMs || 3000),
    },
    retryConfig: {
      maxAttempts: Number(retryConfig.maxAttempts ?? currentDoc?.retryConfig?.maxAttempts ?? 3),
      backoffSeconds: Number(retryConfig.backoffSeconds ?? currentDoc?.retryConfig?.backoffSeconds ?? 60),
    },
    createTime: currentDoc?.createTime || now,
    updateTime: now,
    createBy: currentDoc?.createBy || operator,
    updateBy: operator,
  }
}

module.exports = {
  matchWebhook,
  buildWebhookEvent,
  normalizeWebhookConfig,
}
