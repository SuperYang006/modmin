function createRuntimeActions(deps) {
  const {
    success,
    fail,
    isSuperAdmin,
    checkModelPermission,
    getModelByPageCode,
    buildPageRuntimeSchema,
  } = deps

  async function getPageRuntimeSchema(event) {
    const pageCode = event?.data?.pageCode

    if (!pageCode) {
      return fail(event, 40001, 'pageCode is required')
    }

    const modelDoc = await getModelByPageCode(pageCode)
    if (!modelDoc) {
      return fail(event, 40404, '模型运行时配置不存在')
    }

    const permCheck = await checkModelPermission(event, modelDoc.collectionName)
    if (!permCheck.ok) {
      return fail(event, permCheck.code, permCheck.message)
    }

    return success(event, {
      pageRuntimeSchema: buildPageRuntimeSchema(modelDoc, isSuperAdmin(event) ? null : permCheck.perm),
    })
  }

  return {
    getPageRuntimeSchema,
  }
}

module.exports = {
  createRuntimeActions,
}
