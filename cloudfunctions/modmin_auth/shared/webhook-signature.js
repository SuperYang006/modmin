const crypto = require('node:crypto')

function signWebhookPayload(secret, timestamp, rawBody) {
  if (!secret) {
    return ''
  }

  return `sha256=${crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex')}`
}

module.exports = {
  signWebhookPayload,
}
