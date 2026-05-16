function createQueryHelpers(db, _) {
  function normalizeValue(value) {
    if (value === 'true') {
      return true
    }

    if (value === 'false') {
      return false
    }

    if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
      return Number(value)
    }

    return value
  }

  function findFieldByKey(fields, fieldKey) {
    if (!fieldKey) {
      return null
    }

    return (Array.isArray(fields) ? fields : []).find((field) => (field.fieldKey || field.key) === fieldKey) || null
  }

  function getBuiltinFilterField(fieldKey) {
    if (fieldKey === 'modmin_createTime' || fieldKey === 'modmin_updateTime' || fieldKey === 'modmin_deleteTime') {
      return {
        fieldKey,
        key: fieldKey,
        type: 'datetime',
        dateStorageFormat: 'timestampMs',
      }
    }

    if (fieldKey === '_id') {
      return {
        fieldKey,
        key: fieldKey,
        type: 'text',
      }
    }

    return null
  }

  function parseFilterDateValue(value) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return new Date(value.getTime())
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      const time = value > 1e12 ? value : value * 1000
      const date = new Date(time)
      return Number.isNaN(date.getTime()) ? null : date
    }

    if (typeof value !== 'string') {
      return null
    }

    const trimmed = value.trim()
    if (!trimmed) {
      return null
    }

    if (/^\d+$/.test(trimmed)) {
      const numeric = Number(trimmed)
      if (Number.isFinite(numeric)) {
        const time = trimmed.length <= 10 ? numeric * 1000 : numeric
        const date = new Date(time)
        return Number.isNaN(date.getTime()) ? null : date
      }
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const date = new Date(`${trimmed}T00:00:00.000Z`)
      return Number.isNaN(date.getTime()) ? null : date
    }

    const date = new Date(trimmed)
    return Number.isNaN(date.getTime()) ? null : date
  }

  function valueToIsoString(type, date) {
    if (type === 'date') {
      return date.toISOString().slice(0, 10)
    }

    return date.toISOString()
  }

  function normalizeDateFilterBoundary(field, operator, value) {
    const parsedDate = parseFilterDateValue(value)

    if (!parsedDate) {
      return normalizeValue(value)
    }

    const nextDate = new Date(parsedDate.getTime())
    const rawValue = typeof value === 'string' ? value.trim() : ''
    const isDateOnlyValue = field?.type === 'date' || /^\d{4}-\d{2}-\d{2}$/.test(rawValue)

    if (isDateOnlyValue) {
      if (operator === 'gte') {
        nextDate.setUTCHours(0, 0, 0, 0)
      }

      if (operator === 'lte') {
        nextDate.setUTCHours(23, 59, 59, 999)
      }
    }

    if (field?.dateStorageFormat === 'timestamp') {
      return Math.floor(nextDate.getTime() / 1000)
    }

    if (field?.dateStorageFormat === 'timestampMs') {
      return nextDate.getTime()
    }

    return valueToIsoString(field?.type, nextDate)
  }

  function normalizeFilterValueByField(field, operator, value) {
    if (value === '' || value === null || value === undefined) {
      return value
    }

    if ((operator === 'gte' || operator === 'lte') && (field?.type === 'date' || field?.type === 'datetime')) {
      return normalizeDateFilterBoundary(field, operator, value)
    }

    if (field?.type === 'number') {
      if (typeof value === 'number') {
        return value
      }
      const numeric = Number(value)
      return Number.isFinite(numeric) ? numeric : value
    }

    if (field?.type === 'boolean') {
      if (value === true || value === false) {
        return value
      }
      if (value === 'true') {
        return true
      }
      if (value === 'false') {
        return false
      }
      return value
    }

    if (field?.type === 'enum' && field?.enumValueType === 'number') {
      if (typeof value === 'number') {
        return value
      }
      const numeric = Number(value)
      return Number.isFinite(numeric) ? numeric : value
    }

    return value
  }


  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }


  // ─── Filter operator registry ──────────────────────────────────────────────
  // Each handler: (currentCondition, filterValue) => newCondition

  const FILTER_OPERATORS = new Map([
    ['eq',   (_current, value) => value],
    ['like', (_current, value) => db.RegExp({ regexp: escapeRegExp(value), options: 'i' })],
    ['gte',  (current, value)  => current ? _.and(current, _.gte(value)) : _.gte(value)],
    ['lte',  (current, value)  => current ? _.and(current, _.lte(value)) : _.lte(value)],
  ])

  function buildWhereCondition(filters, modelFields = []) {
    const where = {}
    where.modmin_isDeleted = _.neq(true)

    if (!Array.isArray(filters) || filters.length === 0) {
      return where
    }

    for (const filter of filters) {
      if (!filter?.field) {
        continue
      }

      const field = String(filter.field).trim()
      const operator = String(filter.operator || 'eq').trim()
      const fieldMeta = findFieldByKey(modelFields, field) || getBuiltinFilterField(field)
      const filterValue = normalizeFilterValueByField(fieldMeta, operator, filter.value)

      if (!field || filterValue === '' || filterValue === null || filterValue === undefined) {
        continue
      }

      const handler = FILTER_OPERATORS.get(operator)
      if (!handler) continue
      where[field] = handler(where[field], filterValue)
    }

    return Object.keys(where).length > 0 ? where : null
  }

  function buildListQuery(collectionName, where, sort) {
    const nextSort =
      sort?.field
        ? sort
        : {
            field: 'modmin_createTime',
            order: 'desc',
          }
    let query = db.collection(collectionName)

    if (where) {
      query = query.where(where)
    }

    query = query.orderBy(String(nextSort.field), nextSort.order === 'asc' ? 'asc' : 'desc')

    return query
  }

  return {
    buildWhereCondition,
    buildListQuery,
  }
}

module.exports = {
  createQueryHelpers,
}
