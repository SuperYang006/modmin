function createPermissionHelpers(deps) {
  const {
    db,
    collections,
    fail,
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

  async function listEnabledModelDocs() {
    const docs = await safeDbGet(db.collection(collections.collections))
    return docs.filter((item) => item.status !== 'deleted')
  }

  async function getCollectionDoc(collectionName) {
    const docs = await safeDbGet(db.collection(collections.collections).where({ collectionName }).limit(1))
    return docs[0] || null
  }

  async function getRolePermissionMap(roleCode) {
    const rows = await safeDbGet(db.collection(collections.rolePermissions).where({ roleCode }))
    return rows.reduce((acc, item) => {
      acc[item.collectionName] = item
      return acc
    }, {})
  }

  async function listTransferCollections(event) {
    if (isSuperAdmin(event)) {
      const models = await listEnabledModelDocs()
      return {
        ok: true,
        list: models.map((item) => ({
          collectionName: item.collectionName,
          modelName: item.modelName || item.collectionName,
          pageCode: item.pageCode || '',
          permissions: {
            canExport: true,
            canCreateOnly: true,
            canUpdateOnly: true,
            canUpsert: true,
          },
        })),
      }
    }

    const roleCode = getCurrentRoleCode(event)
    if (!roleCode) {
      return { ok: false, response: fail(event, 40101, '未登录或登录已过期') }
    }
    if (await isRoleDisabled(roleCode)) {
      return { ok: false, response: fail(event, 40301, '当前角色已停用，无权访问') }
    }

    const [models, permissionMap] = await Promise.all([listEnabledModelDocs(), getRolePermissionMap(roleCode)])
    const list = models
      .map((item) => {
        const permission = permissionMap[item.collectionName]
        return {
          collectionName: item.collectionName,
          modelName: item.modelName || item.collectionName,
          pageCode: item.pageCode || '',
          permissions: {
            canExport: permission?.canList === true,
            canCreateOnly: permission?.canCreate === true,
            canUpdateOnly: permission?.canUpdate === true,
            canUpsert: permission?.canCreate === true && permission?.canUpdate === true,
          },
        }
      })
      .filter((item) =>
        item.permissions.canExport || item.permissions.canCreateOnly || item.permissions.canUpdateOnly || item.permissions.canUpsert,
      )

    return { ok: true, list }
  }

  async function ensureTransferPermission(event, collectionName, mode) {
    if (isSuperAdmin(event)) {
      return { ok: true }
    }

    const roleCode = getCurrentRoleCode(event)
    if (!roleCode) {
      return { ok: false, response: fail(event, 40101, '未登录或登录已过期') }
    }
    if (await isRoleDisabled(roleCode)) {
      return { ok: false, response: fail(event, 40301, '当前角色已停用，无权访问') }
    }

    const rows = await safeDbGet(db.collection(collections.rolePermissions).where({ roleCode, collectionName }).limit(1))
    const permission = rows[0]

    const allowed =
      mode === 'export'
        ? permission?.canList === true
        : mode === 'createOnly'
          ? permission?.canCreate === true
          : mode === 'updateOnly'
            ? permission?.canUpdate === true
            : permission?.canCreate === true && permission?.canUpdate === true

    if (!allowed) {
      return { ok: false, response: fail(event, 40301, '无权执行当前导入导出操作') }
    }

    return { ok: true }
  }

  return {
    safeDbGet,
    isRoleDisabled,
    getCollectionDoc,
    listTransferCollections,
    ensureTransferPermission,
  }
}

module.exports = {
  createPermissionHelpers,
}
