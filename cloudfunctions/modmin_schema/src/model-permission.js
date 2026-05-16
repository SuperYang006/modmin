function createModelPermissionHelpers(deps) {
  const {
    db,
    collections,
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

  async function getAllowedCollectionNames(roleCode) {
    if (await isRoleDisabled(roleCode)) return new Set()
    const perms = await safeDbGet(
      db.collection(collections.rolePermissions).where({ roleCode, canList: true }),
    )
    return new Set(perms.map((item) => item.collectionName))
  }

  async function getCollectionDoc(collectionName) {
    const result = await db.collection(collections.collections).where({ collectionName }).limit(1).get()
    return result.data[0] || null
  }

  return {
    safeDbGet,
    isRoleDisabled,
    getAllowedCollectionNames,
    getCollectionDoc,
  }
}

module.exports = {
  createModelPermissionHelpers,
}
