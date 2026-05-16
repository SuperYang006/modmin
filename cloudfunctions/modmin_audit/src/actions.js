function createAuditActions(deps) {
  const {
    db,
    collections,
    command,
    success,
    fail,
    requireSuperAdmin,
  } = deps

  async function listAuditLogs(event) {
    const authError = requireSuperAdmin(event)
    if (authError) return authError

    const filters = event?.data?.filters || {}
    const pagination = event?.data?.pagination || {}
    const pageNo = Number(pagination.pageNo || 1)
    const pageSize = Number(pagination.pageSize || 20)
    const where = {}

    if (filters.result) where.result = String(filters.result)
    if (filters.eventType) where.eventType = String(filters.eventType)
    if (filters.resourceType) where.resourceType = String(filters.resourceType)
    if (filters.collectionName) where.collectionName = String(filters.collectionName)
    if (filters.actorUserId) where['actor.userId'] = String(filters.actorUserId)
    if (filters.startTime || filters.endTime) {
      const range = []
      if (filters.startTime) range.push(command.gte(Number(filters.startTime)))
      if (filters.endTime) range.push(command.lte(Number(filters.endTime)))
      if (range.length === 1) {
        where.createTime = range[0]
      } else if (range.length > 1) {
        where.createTime = command.and(...range)
      }
    }

    const baseQuery = db.collection(collections.auditLogs).where(where)
    const countResult = await baseQuery.count()
    const result = await baseQuery
      .orderBy('createTime', 'desc')
      .skip((pageNo - 1) * pageSize)
      .limit(pageSize)
      .get()

    return success(event, {
      list: result.data || [],
      pagination: {
        pageNo,
        pageSize,
        total: Number(countResult?.total || 0),
      },
    })
  }

  async function getAuditLogDetail(event) {
    const authError = requireSuperAdmin(event)
    if (authError) return authError

    const logId = String(event?.data?.logId || '').trim()
    if (!logId) {
      return fail(event, 40001, 'logId is required')
    }

    const result = await db.collection(collections.auditLogs).doc(logId).get()
    const detail = result.data?.[0] || null
    if (!detail) {
      return fail(event, 40404, '日志不存在')
    }

    return success(event, { detail })
  }

  return {
    listAuditLogs,
    getAuditLogDetail,
  }
}

module.exports = {
  createAuditActions,
}
