const crypto = require('node:crypto')
const { sanitizeValue } = require('./sanitize.js')
const { buildDiff } = require('./event-diff.js')

const DEFAULT_COLLECTION_NAME = process.env.MODMIN_AUDIT_LOGS_COLLECTION || `${process.env.MODMIN_COLLECTION_PREFIX || 'modmin_'}audit_logs`

function getHeaderValue(headers, name) {
  if (!headers || typeof headers !== 'object') {
    return ''
  }

  const exact = headers[name]
  if (typeof exact === 'string' && exact.trim()) {
    return exact.trim()
  }

  const matchedKey = Object.keys(headers).find((key) => String(key).toLowerCase() === name.toLowerCase())
  const matchedValue = matchedKey ? headers[matchedKey] : ''

  return typeof matchedValue === 'string' ? matchedValue.trim() : ''
}

function getClientIp(event, payload) {
  const forwarded = getHeaderValue(event?.headers, 'x-forwarded-for')
  const forwardedFirst = forwarded.split(',').map((item) => item.trim()).filter(Boolean)[0] || ''

  return event?.context?.clientIp || payload.clientIp || forwardedFirst || getHeaderValue(event?.headers, 'x-real-ip') || ''
}

function getUserAgent(event, payload) {
  return event?.context?.userAgent || payload.userAgent || getHeaderValue(event?.headers, 'user-agent') || ''
}

function createAuditLogger({ db, collectionName = DEFAULT_COLLECTION_NAME }) {
  async function emitAuditLog(event, payload) {
    const now = Date.now()
    const actor = payload.actor && typeof payload.actor === 'object' ? payload.actor : {}
    const before = sanitizeValue(payload.before || null)
    const after = sanitizeValue(payload.after || null)
    const diff = payload.diff && typeof payload.diff === 'object' ? sanitizeValue(payload.diff) : buildDiff(before, after)

    await db.collection(collectionName).add({
      eventId: payload.eventId || `evt_${now}_${crypto.randomBytes(6).toString('hex')}`,
      eventType: payload.eventType || '',
      resourceType: payload.resourceType || '',
      collectionName: payload.collectionName || '',
      recordId: payload.recordId || '',
      actor: {
        userId: actor.userId || '',
        userName: actor.userName || '',
        nickName: actor.nickName || actor.userName || '',
        roleCode: actor.roleCode || '',
      },
      result: payload.result === 'failure' ? 'failure' : 'success',
      before,
      after,
      diff,
      errorMessage: payload.errorMessage || '',
      requestId: event?.meta?.requestId || payload.requestId || '',
      clientIp: getClientIp(event, payload),
      userAgent: getUserAgent(event, payload),
      createTime: now,
    })
  }

  async function emitAuditLogSafe(event, payload) {
    try {
      await emitAuditLog(event, payload)
    } catch (error) {
      console.warn('[audit] write failed', error)
    }
  }

  return {
    emitAuditLog,
    emitAuditLogSafe,
  }
}

module.exports = {
  DEFAULT_COLLECTION_NAME,
  createAuditLogger,
  getClientIp,
  getUserAgent,
}
