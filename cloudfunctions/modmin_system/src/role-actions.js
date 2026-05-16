function createRoleActions(deps) {
  const {
    db,
    collections,
    command,
    success,
    fail,
    ensureSuperAdmin,
    pickOperator,
    BUILTIN_ROLE_CODES,
    safeDbGet,
    normalizeRoleItem,
    emitAuditLogSafe,
  } = deps

  async function listRoles(event) {
    ensureSuperAdmin(event)

    const source = await safeDbGet(db.collection(collections.adminRoles).where({ status: command.in(['enabled', 'disabled']) }))

    const seen = new Set()
    const deduped = []
    for (const doc of source.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))) {
      if (!doc.roleCode || seen.has(doc.roleCode)) continue
      seen.add(doc.roleCode)
      deduped.push(doc)
    }

    const list = deduped.map((item, index) => normalizeRoleItem(item, (index + 1) * 10))
    return success(event, { list })
  }

  async function saveRole(event) {
    ensureSuperAdmin(event)

    const payload = event?.data?.role
    if (!payload?.roleCode || !payload?.roleName) {
      return fail(event, 40001, '缺少角色编码或角色名称')
    }

    const now = Date.now()
    const operator = pickOperator(event)
    const roleCode = String(payload.roleCode).trim()
    const roleName = String(payload.roleName).trim()
    const description = payload.description ? String(payload.description).trim() : ''
    const isBuiltin = BUILTIN_ROLE_CODES.has(roleCode)
    const status = isBuiltin ? 'enabled' : (payload.status === 'disabled' ? 'disabled' : 'enabled')
    const current = await db.collection(collections.adminRoles).where({ roleCode }).limit(1).get()
    const currentDoc = current.data[0] || null
    const before = currentDoc ? normalizeRoleItem(currentDoc, currentDoc.sortOrder || 10) : null

    if (currentDoc?._id) {
      await db.collection(collections.adminRoles).doc(currentDoc._id).update({
        roleCode,
        roleName,
        description,
        status,
        builtin: isBuiltin,
        updateTime: now,
        updateBy: operator,
      })
    } else {
      if (isBuiltin) {
        return fail(event, 40003, '内置角色编码不可用作新建角色')
      }
      const countResult = await db.collection(collections.adminRoles).count()
      await db.collection(collections.adminRoles).add({
        roleCode,
        roleName,
        description,
        status,
        sortOrder: countResult.total * 10 + 10,
        builtin: false,
        createTime: now,
        updateTime: now,
        createBy: operator,
        updateBy: operator,
      })
    }

    const latest = await db.collection(collections.adminRoles).where({ roleCode }).limit(1).get()
    const latestItem = normalizeRoleItem(latest.data[0], latest.data[0]?.sortOrder || 10)

    await emitAuditLogSafe(event, {
      eventType: currentDoc?._id ? 'role.update' : 'role.create',
      resourceType: 'role',
      recordId: latest.data[0]?._id || '',
      actor: operator,
      result: 'success',
      before,
      after: latestItem,
    })

    return success(event, {
      item: latestItem,
    })
  }

  return {
    listRoles,
    saveRole,
  }
}

module.exports = {
  createRoleActions,
}
