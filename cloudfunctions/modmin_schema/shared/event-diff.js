const { sanitizeValue } = require('./sanitize.js')

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
}

function buildDiff(before, after) {
  if (!isPlainObject(before) || !isPlainObject(after)) {
    return {}
  }

  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  const diff = {}

  for (const key of keys) {
    const beforeValue = sanitizeValue(before[key])
    const afterValue = sanitizeValue(after[key])

    if (JSON.stringify(beforeValue) === JSON.stringify(afterValue)) {
      continue
    }

    diff[key] = {
      before: beforeValue === undefined ? null : beforeValue,
      after: afterValue === undefined ? null : afterValue,
    }
  }

  return diff
}

module.exports = {
  buildDiff,
}
