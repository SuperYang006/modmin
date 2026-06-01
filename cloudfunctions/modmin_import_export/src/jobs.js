function createJobHelpers({ db, collectionName }) {
  async function saveJob(job) {
    const result = await db.collection(collectionName).add(job)
    return {
      ...job,
      _id: result.id,
    }
  }

  async function updateJobById(id, patch) {
    if (!id) {
      return null
    }
    await db.collection(collectionName).doc(id).update(patch)
    return { _id: id, ...patch }
  }

  async function upsertJobByJobId(jobId, patch) {
    const result = await db.collection(collectionName).where({ jobId }).limit(1).get()
    const current = result.data?.[0]
    if (!current) {
      await saveJob({ jobId, ...patch })
      return { jobId, ...patch }
    }
    await db.collection(collectionName).doc(current._id).update(patch)
    return { ...current, ...patch }
  }

  async function getJobByJobId(jobId) {
    const result = await db.collection(collectionName).where({ jobId }).limit(1).get()
    return result.data?.[0] || null
  }

  async function listRecentJobs(limit = 200) {
    const nextLimit = Math.max(1, Math.min(Number(limit) || 200, 500))
    const result = await db.collection(collectionName).orderBy('createTime', 'desc').limit(nextLimit).get()
    return result.data || []
  }

  async function listJobs(filters = {}, pagination = {}, command) {
    const pageNo = Math.max(1, Number(pagination.pageNo) || 1)
    const pageSize = Math.max(1, Math.min(Number(pagination.pageSize) || 20, 100))
    let query = db.collection(collectionName)

    const where = {}
    if (filters.jobType) where.jobType = filters.jobType
    if (filters.collectionName) where.collectionName = filters.collectionName
    if (filters.status) where.status = filters.status
    if (filters.format) where.format = filters.format
    if (Array.isArray(filters.collectionNames) && filters.collectionNames.length > 0) {
      where.collectionName = filters.collectionNames.length === 1
        ? filters.collectionNames[0]
        : command.in(filters.collectionNames)
    }
    if (filters.operatorUserId) {
      where['operator.userId'] = filters.operatorUserId
    }

    if (Object.keys(where).length > 0) {
      query = query.where(where)
    }

    const countResult = await query.count()
    const result = await query
      .orderBy('createTime', 'desc')
      .skip((pageNo - 1) * pageSize)
      .limit(pageSize)
      .get()

    return {
      list: result.data || [],
      pagination: {
        pageNo,
        pageSize,
        total: Number(countResult.total) || 0,
      },
    }
  }

  return {
    saveJob,
    updateJobById,
    upsertJobByJobId,
    getJobByJobId,
    listRecentJobs,
    listJobs,
  }
}

module.exports = {
  createJobHelpers,
}
