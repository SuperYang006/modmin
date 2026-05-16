function createPermissionActions(deps) {
  const {
    db,
    collections,
    success,
    fail,
    parseAccessToken,
    ensureSuperAdmin,
    pickOperator,
    safeDbGet,
    isRoleDisabled,
    emitAuditLogSafe,
  } = deps

  async function getMyPermissions(event) {
    const payload = parseAccessToken(event)
    if (!payload) return fail(event, 40101, '未登录或登录已过期')

    if (payload.roleCode === 'role_super_admin') {
      const cols = await safeDbGet(db.collection(collections.collections).where({ status: 'enabled' }))
      const permMap = {}
      for (const col of cols) {
        permMap[col.collectionName] = { canList: true, canCreate: true, canUpdate: true, canDelete: true }
      }
      return success(event, { isSuperAdmin: true, permMap })
    }

    if (await isRoleDisabled(payload.roleCode)) {
      return success(event, { isSuperAdmin: false, permMap: {}, roleDisabled: true })
    }

    const perms = await safeDbGet(db.collection(collections.rolePermissions).where({ roleCode: payload.roleCode }))
    const permMap = {}
    for (const perm of perms) {
      permMap[perm.collectionName] = {
        canList: perm.canList === true,
        canCreate: perm.canCreate === true,
        canUpdate: perm.canUpdate === true,
        canDelete: perm.canDelete === true,
      }
    }
    return success(event, { isSuperAdmin: false, permMap })
  }

  async function getRolePermissions(event) {
    ensureSuperAdmin(event)
    const roleCode = event?.data?.roleCode
    if (!roleCode) return fail(event, 40001, '缺少 roleCode')

    const [permsData, collectionsData] = await Promise.all([
      safeDbGet(db.collection(collections.rolePermissions).where({ roleCode })),
      safeDbGet(db.collection(collections.collections).where({ status: 'enabled' })),
    ])

    const permMap = {}
    for (const perm of permsData) {
      permMap[perm.collectionName] = {
        canList: perm.canList === true,
        canCreate: perm.canCreate === true,
        canUpdate: perm.canUpdate === true,
        canDelete: perm.canDelete === true,
      }
    }

    const list = collectionsData.map((col) => ({
      collectionName: col.collectionName,
      modelName: col.modelName || col.collectionName,
      ...(permMap[col.collectionName] || { canList: false, canCreate: false, canUpdate: false, canDelete: false }),
    }))

    return success(event, { list })
  }

  async function saveRolePermissions(event) {
    ensureSuperAdmin(event)
    const roleCode = event?.data?.roleCode
    const permissions = event?.data?.permissions

    if (!roleCode) return fail(event, 40001, '缺少 roleCode')
    if (!Array.isArray(permissions)) return fail(event, 40001, '缺少 permissions 列表')

    const now = Date.now()
    const operator = pickOperator(event)
    const existingData = await safeDbGet(db.collection(collections.rolePermissions).where({ roleCode }))
    const before = existingData.map((perm) => ({
      collectionName: perm.collectionName,
      canList: perm.canList === true,
      canCreate: perm.canCreate === true,
      canUpdate: perm.canUpdate === true,
      canDelete: perm.canDelete === true,
    }))
    const existingMap = {}
    for (const perm of existingData) {
      existingMap[perm.collectionName] = perm._id
    }

    const tasks = permissions.map((perm) => {
      const doc = {
        roleCode,
        collectionName: perm.collectionName,
        canList: perm.canList === true,
        canCreate: perm.canCreate === true,
        canUpdate: perm.canUpdate === true,
        canDelete: perm.canDelete === true,
        updateTime: now,
        updateBy: operator,
      }
      const existingId = existingMap[perm.collectionName]
      if (existingId) {
        return db.collection(collections.rolePermissions).doc(existingId).update(doc)
      }
      return db.collection(collections.rolePermissions).add({ ...doc, createTime: now, createBy: operator })
    })

    const newNames = new Set(permissions.map((item) => item.collectionName))
    const toDelete = existingData
      .filter((item) => !newNames.has(item.collectionName))
      .map((item) => db.collection(collections.rolePermissions).doc(item._id).remove())

    await Promise.all([...tasks, ...toDelete])

    await emitAuditLogSafe(event, {
      eventType: 'role.update',
      resourceType: 'role',
      recordId: roleCode,
      actor: operator,
      result: 'success',
      before: {
        roleCode,
        permissions: before,
      },
      after: {
        roleCode,
        permissions: permissions.map((perm) => ({
          collectionName: perm.collectionName,
          canList: perm.canList === true,
          canCreate: perm.canCreate === true,
          canUpdate: perm.canUpdate === true,
          canDelete: perm.canDelete === true,
        })),
      },
    })

    return success(event, { roleCode })
  }

  return {
    getMyPermissions,
    getRolePermissions,
    saveRolePermissions,
  }
}

module.exports = {
  createPermissionActions,
}
