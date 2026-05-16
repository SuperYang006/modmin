function normalizePolyRelationDisplayMap(value) {
  if (!value || typeof value !== 'object') {
    return {}
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([collection, fields]) => [
        String(collection).trim(),
        Array.isArray(fields) ? fields.map((item) => String(item).trim()).filter(Boolean) : [],
      ])
      .filter(([collection]) => Boolean(collection)),
  )
}

function normalizeOptionalNumber(value) {
  if (value === '' || value === null || value === undefined) {
    return undefined
  }

  const nextValue = Number(value)
  return Number.isNaN(nextValue) ? null : nextValue
}

function normalizePolyRelationLimitMap(value) {
  if (!value || typeof value !== 'object') {
    return {}
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([collection, limit]) => {
        const nextLimit = limit && typeof limit === 'object' ? limit : {}
        const minItems = normalizeOptionalNumber(nextLimit.minItems)
        const maxItems = normalizeOptionalNumber(nextLimit.maxItems)

        return [
          String(collection).trim(),
          {
            ...(typeof minItems === 'number' ? { minItems } : {}),
            ...(typeof maxItems === 'number' ? { maxItems } : {}),
          },
        ]
      })
      .filter(([collection]) => Boolean(collection)),
  )
}

function normalizeEnumOptions(options) {
  if (!Array.isArray(options)) {
    return []
  }

  return options
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null
      }

      const label = typeof item.label === 'string' ? item.label.trim() : ''
      const value = typeof item.value === 'string' ? item.value.trim() : ''

      if (!label || !value) {
        return null
      }

      return { label, value }
    })
    .filter(Boolean)
}

function normalizeAccept(accept) {
  if (!Array.isArray(accept)) {
    return []
  }

  return accept.map((item) => String(item).trim()).filter(Boolean)
}

function normalizeMediaAcceptByType(type, accept, getFieldMeta) {
  const normalizedAccept = normalizeAccept(accept)

  if (type !== 'file') {
    return normalizedAccept
  }

  const defaultAccept = normalizeAccept(getFieldMeta('file')?.defaultAccept || [])

  if (normalizedAccept.length === 0) {
    return defaultAccept
  }

  return normalizedAccept
}

module.exports = {
  normalizePolyRelationDisplayMap,
  normalizeOptionalNumber,
  normalizePolyRelationLimitMap,
  normalizeEnumOptions,
  normalizeAccept,
  normalizeMediaAcceptByType,
}
