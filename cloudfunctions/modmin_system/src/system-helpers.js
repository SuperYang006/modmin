function createSystemHelpers({ db, collections, command, pickOperator }) {
  const DEFAULT_ROLE_OPTIONS = [
    { roleCode: 'role_super_admin', roleName: '超级管理员', description: '默认超级管理员', sortOrder: 10, status: 'enabled', builtin: true },
    { roleCode: 'role_operator', roleName: '运营人员', description: '默认运营角色', sortOrder: 20, status: 'enabled', builtin: true },
  ]
  const BUILTIN_ROLE_CODES = new Set(DEFAULT_ROLE_OPTIONS.map((item) => item.roleCode))

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

  function normalizeRoleItem(doc, fallbackSortOrder = 10) {
    return {
      roleCode: doc.roleCode,
      roleName: doc.roleName,
      description: doc.description || '',
      sortOrder: doc.sortOrder || fallbackSortOrder,
      status: doc.status === 'disabled' ? 'disabled' : 'enabled',
      builtin: doc.builtin === true || BUILTIN_ROLE_CODES.has(doc.roleCode),
    }
  }

  async function ensureBuiltinRoles(event) {
    const operator = pickOperator(event)
    const now = Date.now()
    const existing = await safeDbGet(db.collection(collections.adminRoles).where({ roleCode: command.in([...BUILTIN_ROLE_CODES]) }))
    const existingCodes = new Set(existing.map((item) => item.roleCode))

    for (const role of DEFAULT_ROLE_OPTIONS) {
      if (existingCodes.has(role.roleCode)) continue
      await db.collection(collections.adminRoles).add({
        roleCode: role.roleCode,
        roleName: role.roleName,
        description: role.description,
        status: role.status,
        sortOrder: role.sortOrder,
        builtin: true,
        createTime: now,
        updateTime: now,
        createBy: operator,
        updateBy: operator,
      })
    }
  }

  function normalizeMenuGroupItem(doc, fallbackSortOrder = 10) {
    return {
      groupId: doc._id || doc.groupId,
      groupCode: doc.groupCode,
      title: doc.title,
      icon: typeof doc.icon === 'string' ? doc.icon : '',
      sortOrder: doc.sortOrder || fallbackSortOrder,
      status: doc.status === 'disabled' ? 'disabled' : 'enabled',
    }
  }

  async function isRoleDisabled(roleCode) {
    if (!roleCode || roleCode === 'role_super_admin') return false
    const docs = await safeDbGet(db.collection(collections.adminRoles).where({ roleCode }).limit(1))
    return docs[0]?.status === 'disabled'
  }

  function normalizeAdminUser(doc) {
    return {
      userId: doc._id,
      userName: doc.userName,
      nickName: doc.nickName || doc.userName,
      roleCode: doc.roleCode,
      status: doc.status === 'disabled' ? 'disabled' : 'enabled',
      createTime: doc.createTime,
      avatar: doc.avatar || null,
    }
  }

  return {
    DEFAULT_ROLE_OPTIONS,
    BUILTIN_ROLE_CODES,
    safeDbGet,
    normalizeRoleItem,
    ensureBuiltinRoles,
    normalizeMenuGroupItem,
    isRoleDisabled,
    normalizeAdminUser,
  }
}

module.exports = {
  createSystemHelpers,
}
