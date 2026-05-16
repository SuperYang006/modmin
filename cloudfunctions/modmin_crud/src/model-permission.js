function createModelPermissionHelpers({ db, collections, fail, parseAccessToken, isSuperAdmin }) {
  async function getModelDoc(collectionName) {
    const result = await db.collection(collections.collections).where({ collectionName, status: 'enabled' }).limit(1).get()
    return result.data[0] || null
  }

  async function isRoleDisabled(roleCode) {
    if (!roleCode || roleCode === 'role_super_admin') return false
    try {
      const result = await db.collection(collections.adminRoles).where({ roleCode }).limit(1).get()
      return result.data?.[0]?.status === 'disabled'
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      if (/Table not exist|Db or Table not exist|COLLECTION_NOT_EXIST|ResourceNotFound/i.test(msg)) {
        return false
      }
      throw error
    }
  }

  async function checkModelPermission(event, collectionName, action) {
    const modelDoc = await getModelDoc(collectionName)

    if (!modelDoc) {
      return { ok: false, response: fail(event, 40404, '模型不存在') }
    }

    if (isSuperAdmin(event)) {
      return { ok: true, modelDoc }
    }

    const payload = parseAccessToken(event)
    if (!payload) {
      return { ok: false, response: fail(event, 40101, '未登录或登录已过期') }
    }

    if (await isRoleDisabled(payload.roleCode)) {
      return { ok: false, response: fail(event, 40301, '当前角色已停用，无权执行操作') }
    }

    const ACTION_FIELD = { list: 'canList', create: 'canCreate', update: 'canUpdate', delete: 'canDelete' }
    const permField = ACTION_FIELD[action]
    if (!permField) {
      return { ok: false, response: fail(event, 40301, '无权执行当前操作') }
    }

    const result = await db.collection(collections.rolePermissions)
      .where({ roleCode: payload.roleCode, collectionName })
      .limit(1)
      .get()

    const perm = result.data?.[0]
    if (!perm || !perm[permField]) {
      return { ok: false, response: fail(event, 40301, '无权执行当前操作') }
    }

    return { ok: true, modelDoc }
  }

  return {
    getModelDoc,
    checkModelPermission,
  }
}

module.exports = {
  createModelPermissionHelpers,
}
