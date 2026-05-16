const https = require('node:https')
const http = require('node:http')
const cloudbase = require('@cloudbase/node-sdk')
const { sanitizeValue } = require('./sanitize.js')
const { signWebhookPayload } = require('./webhook-signature.js')
const { matchWebhook, buildWebhookEvent } = require('./webhook.js')

function createWebhookDeliveryHelpers({ db, collections, app }) {
  async function enqueueWebhookDeliveries(event, payload) {
    const webhooksResult = await db.collection(collections.webhooks).get()
    const webhooks = webhooksResult.data || []
    const webhookEvent = buildWebhookEvent(payload)
    const matched = webhooks.filter((item) => matchWebhook(item, webhookEvent))

    if (matched.length === 0) {
      return { count: 0 }
    }

    const now = Date.now()

    await Promise.all(
      matched.map((webhook) => {
        const target = webhook.targetType === 'http'
          ? webhook.httpConfig?.url || ''
          : webhook.cloudFunctionConfig?.functionName || ''
        const requestPayload = webhook.targetType === 'http'
          ? sanitizeValue({
              webhookEvent,
              extraParams: webhook.extraParams || {},
            })
          : sanitizeValue(webhookEvent)

        return db.collection(collections.webhookDeliveries).add({
          deliveryId: `delivery_${now}_${Math.random().toString(16).slice(2, 10)}`,
          webhookId: webhook.webhookId || webhook._id,
          eventId: webhookEvent.eventId,
          eventType: webhookEvent.eventType,
          targetType: webhook.targetType,
          target,
          status: 'pending',
          attempts: 0,
          maxAttempts: Number(webhook.retryConfig?.maxAttempts ?? 3),
          nextAttemptTime: now,
          lastAttemptTime: null,
          lockedAt: null,
          lockedBy: '',
          requestPayload,
          responseStatus: null,
          responseBody: '',
          errorMessage: '',
          durationMs: 0,
          createTime: now,
          updateTime: now,
        })
      }),
    )

    return { count: matched.length }
  }

  async function tryLockDelivery(delivery, lockId) {
    const latest = await db.collection(collections.webhookDeliveries).doc(delivery._id).get()
    const current = latest.data?.[0]

    if (!current || !['pending', 'retrying'].includes(current.status)) {
      return null
    }

    const now = Date.now()
    await db.collection(collections.webhookDeliveries).doc(delivery._id).update({
      status: 'processing',
      lockedAt: now,
      lockedBy: lockId,
      lastAttemptTime: now,
      updateTime: now,
    })

    const locked = await db.collection(collections.webhookDeliveries).doc(delivery._id).get()
    return locked.data?.[0] || null
  }

  function sendHttpWebhook(webhook, payload) {
    return new Promise((resolve, reject) => {
      const rawBody = JSON.stringify(payload)
      const targetUrl = new URL(webhook.httpConfig.url)
      const timeoutMs = Number(webhook.httpConfig?.timeoutMs || 3000)
      const timestamp = String(Date.now())
      const signature = signWebhookPayload(webhook.httpConfig?.secret || '', timestamp, rawBody)
      const headers = {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(rawBody),
        'x-modmin-event': payload.eventType,
        'x-modmin-event-id': payload.eventId,
        'x-modmin-timestamp': timestamp,
        ...(signature ? { 'x-modmin-signature': signature } : {}),
        ...(webhook.httpConfig?.headers || {}),
      }

      const requestOptions = {
        protocol: targetUrl.protocol,
        hostname: targetUrl.hostname,
        port: targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80),
        path: `${targetUrl.pathname}${targetUrl.search}`,
        method: 'POST',
        headers,
        timeout: timeoutMs,
      }

      const transport = targetUrl.protocol === 'https:' ? https : http
      const request = transport.request(requestOptions, (response) => {
        let responseBody = ''
        response.on('data', (chunk) => {
          responseBody += String(chunk)
        })
        response.on('end', () => {
          resolve({
            ok: response.statusCode >= 200 && response.statusCode < 300,
            responseStatus: response.statusCode || 0,
            responseBody,
          })
        })
      })

      request.on('error', reject)
      request.on('timeout', () => request.destroy(new Error('webhook request timeout')))
      request.write(rawBody)
      request.end()
    })
  }

  async function invokeCloudFunctionWebhook(webhook, payload) {
    const result = await app.callFunction({
      name: webhook.cloudFunctionConfig.functionName,
      data: {
        action: webhook.cloudFunctionConfig.action || 'handleModminWebhook',
        data: {
          webhookEvent: payload,
          extraParams: webhook.extraParams || {},
        },
      },
    })

    const response = result?.result ?? result ?? {}

    return {
      ok: response?.code === 0,
      responseStatus: 200,
      responseBody: JSON.stringify(response),
    }
  }

  async function deliverSingle(webhook, delivery) {
    const startedAt = Date.now()
    const payload = delivery.requestPayload || {}

    if (webhook.targetType === 'cloudFunction') {
      const result = await invokeCloudFunctionWebhook(webhook, payload)
      return {
        ...result,
        durationMs: Date.now() - startedAt,
      }
    }

    const result = await sendHttpWebhook(webhook, payload)
    return {
      ...result,
      durationMs: Date.now() - startedAt,
    }
  }

  async function updateDeliveryResult(delivery, webhook, result, error) {
    const now = Date.now()
    const attempts = Number(delivery.attempts || 0) + 1
    const maxAttempts = Number(delivery.maxAttempts || webhook.retryConfig?.maxAttempts || 3)
    const ok = !error && result?.ok === true

    if (ok) {
      await db.collection(collections.webhookDeliveries).doc(delivery._id).update({
        status: 'success',
        attempts,
        responseStatus: result.responseStatus || 0,
        responseBody: String(result.responseBody || '').slice(0, 4000),
        errorMessage: '',
        durationMs: Number(result.durationMs || 0),
        lockedAt: null,
        lockedBy: '',
        updateTime: now,
      })
      return
    }

    const nextStatus = attempts >= maxAttempts ? 'failed' : 'retrying'
    const nextAttemptTime = now + Number(webhook.retryConfig?.backoffSeconds || 60) * 1000

    await db.collection(collections.webhookDeliveries).doc(delivery._id).update({
      status: nextStatus,
      attempts,
      responseStatus: result?.responseStatus || 0,
      responseBody: String(result?.responseBody || '').slice(0, 4000),
      errorMessage: String(error?.message || result?.errorMessage || 'webhook delivery failed').slice(0, 1000),
      durationMs: Number(result?.durationMs || 0),
      nextAttemptTime,
      lockedAt: null,
      lockedBy: '',
      updateTime: now,
    })
  }

  return {
    enqueueWebhookDeliveries,
    tryLockDelivery,
    deliverSingle,
    updateDeliveryResult,
  }
}

module.exports = {
  createWebhookDeliveryHelpers,
}
