function createModelPermissionHelpers(deps) {
  const {
    db,
    collections,
    getCurrentRoleCode,
    isSuperAdmin,
  } = deps

  async function safeDbGet(query) {
    try {
      const result = await query.get()
      return result.data || []
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      if (/Table not exist|Db or Table not exist|COLLECTION_NOT_EXIST|ResourceNotFound/i.test(msg)) {
        return []
      }
      throw error
    }
  }

  async function isRoleDisabled(roleCode) {
    if (!roleCode || roleCode === 'role_super_admin') return false
    const docs = await safeDbGet(db.collection(collections.adminRoles).where({ roleCode }).limit(1))
    return docs[0]?.status === 'disabled'
  }

  async function checkModelPermission(event, collectionName) {
    if (isSuperAdmin(event)) return { ok: true }

    const roleCode = getCurrentRoleCode(event)
    if (!roleCode) return { ok: false, code: 40101, message: '未登录或登录已过期' }
    if (await isRoleDisabled(roleCode)) return { ok: false, code: 40301, message: '当前角色已停用，无权访问' }

    const perms = await safeDbGet(
      db.collection(collections.rolePermissions).where({ roleCode, collectionName }).limit(1),
    )
    const perm = perms[0]

    if (!perm || !perm.canList) {
      return { ok: false, code: 40301, message: '无权访问当前模型' }
    }

    return { ok: true, perm }
  }

  async function getModelByPageCode(pageCode) {
    const result = await db.collection(collections.collections).where({ pageCode, status: 'enabled' }).limit(1).get()
    return result.data[0] || null
  }

  return {
    safeDbGet,
    isRoleDisabled,
    checkModelPermission,
    getModelByPageCode,
  }
}

module.exports = {
  createModelPermissionHelpers,
}
