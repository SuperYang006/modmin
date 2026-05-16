const SENSITIVE_KEY_PATTERN = /(password|passwordHash|passwordSalt|token|secret|webhookSecret)/i
const MAX_STRING_LENGTH = 2000
const MAX_ARRAY_ITEMS = 20
const MAX_OBJECT_KEYS = 50

function sanitizeValue(value, depth = 0) {
  if (value === null || value === undefined) {
    return value
  }

  if (typeof value === 'string') {
    if (value.length <= MAX_STRING_LENGTH) {
      return value
    }
    return `${value.slice(0, MAX_STRING_LENGTH)}...[truncated]`
  }

  if (typeof value !== 'object') {
    return value
  }

  if (depth >= 4) {
    return '[truncated]'
  }

  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY_ITEMS).map((item) => sanitizeValue(item, depth + 1))
  }

  const entries = Object.entries(value).slice(0, MAX_OBJECT_KEYS)
  const sanitized = {}

  for (const [key, item] of entries) {
    sanitized[key] = SENSITIVE_KEY_PATTERN.test(key) ? '[redacted]' : sanitizeValue(item, depth + 1)
  }

  return sanitized
}

module.exports = {
  sanitizeValue,
}
