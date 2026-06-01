const { createExportActions } = require('./export-actions.js')
const { createImportActions } = require('./import-actions.js')

function createImportExportActions(deps) {
  const exportActions = createExportActions(deps)
  const importActions = createImportActions(deps)

  return {
    ...exportActions,
    ...importActions,
    async listTransferCollections(event) {
      const result = await deps.listTransferCollections(event)
      return result.ok ? deps.success(event, { list: result.list }) : result.response
    },
    async getTransferJobDetail(event) {
      const jobId = event?.data?.jobId
      if (!jobId) {
        return deps.fail(event, 40001, 'jobId is required')
      }
      const job = await deps.jobs.getJobByJobId(jobId)
      if (!job) {
        return deps.success(event, { job: null })
      }
      const collectionResult = await deps.listTransferCollections(event)
      if (!collectionResult.ok) {
        return collectionResult.response
      }
      const accessibleCollections = new Set(collectionResult.list.map((item) => item.collectionName))
      const operator = deps.pickOperator(event)
      const isSuperAdmin = operator.roleCode === 'role_super_admin'
      if (!accessibleCollections.has(job.collectionName)) {
        return deps.fail(event, 40301, '无权查看当前任务')
      }
      if (!isSuperAdmin && (!job.operator?.userId || job.operator.userId !== operator.userId)) {
        return deps.fail(event, 40301, '无权查看当前任务')
      }
      return deps.success(event, { job })
    },
    async listTransferJobs(event) {
      const payload = event?.data || {}
      const pageNo = Math.max(1, Number(payload.pageNo) || 1)
      const pageSize = Math.max(1, Math.min(Number(payload.pageSize) || Number(payload.limit) || 20, 100))
      const collectionResult = await deps.listTransferCollections(event)

      if (!collectionResult.ok) {
        return collectionResult.response
      }

      const accessibleCollections = collectionResult.list.map((item) => item.collectionName)
      const operator = deps.pickOperator(event)
      const isSuperAdmin = operator.roleCode === 'role_super_admin'
      if (accessibleCollections.length === 0) {
        return deps.success(event, {
          list: [],
          pagination: {
            pageNo,
            pageSize,
            total: 0,
          },
        })
      }

      const result = await deps.jobs.listJobs({
        jobType: payload.jobType,
        collectionName: payload.collectionName,
        status: payload.status,
        format: payload.format,
        collectionNames: accessibleCollections,
        operatorUserId: isSuperAdmin ? '' : operator.userId,
      }, {
        pageNo,
        pageSize,
      }, deps.command)

      return deps.success(event, {
        list: result.list,
        pagination: result.pagination,
      })
    },
  }
}

module.exports = {
  createImportExportActions,
}
