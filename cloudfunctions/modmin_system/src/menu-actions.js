function createMenuActions(deps) {
  const {
    db,
    collections,
    command,
    success,
    fail,
    getCurrentRoleCode,
    ensureSuperAdmin,
    pickOperator,
    safeDbGet,
    normalizeMenuGroupItem,
    emitAuditLogSafe,
  } = deps

  async function listMenuGroups(event) {
    const roleCode = getCurrentRoleCode(event)
    if (!roleCode) {
      return fail(event, 40101, '未登录或登录已过期')
    }

    const statusFilter = roleCode === 'role_super_admin' ? command.in(['enabled', 'disabled']) : 'enabled'
    const source = await safeDbGet(db.collection(collections.menuGroups).where({ status: statusFilter }))
    const list = source
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
      .map((item, index) => normalizeMenuGroupItem(item, (index + 1) * 10))

    return success(event, { list })
  }

  async function saveMenuGroup(event) {
    ensureSuperAdmin(event)

    const payload = event?.data?.group
    if (!payload?.title) {
      return fail(event, 40001, '缺少分组名称')
    }

    const now = Date.now()
    const operator = pickOperator(event)
    const groupCode = payload.groupId
      ? (typeof payload.groupCode === 'string' && payload.groupCode.trim() ? payload.groupCode.trim() : '')
      : `group_${now}`
    const title = String(payload.title).trim()
    const icon = payload.icon ? String(payload.icon).trim() : ''
    const status = payload.status === 'disabled' ? 'disabled' : 'enabled'
    const sortOrder = typeof payload.sortOrder === 'number' ? payload.sortOrder : undefined
    const groupId = payload.groupId ? String(payload.groupId).trim() : ''
    let currentDoc = null

    if (groupId) {
      const current = await db.collection(collections.menuGroups).doc(groupId).get()
      currentDoc = current.data[0] || null
    }

    const before = currentDoc ? normalizeMenuGroupItem(currentDoc, currentDoc.sortOrder || 10) : null

    if (currentDoc?._id) {
      await db.collection(collections.menuGroups).doc(currentDoc._id).update({
        groupCode,
        title,
        icon,
        status,
        ...(sortOrder !== undefined && { sortOrder }),
        updateTime: now,
        updateBy: operator,
      })
    } else {
      const countResult = await db.collection(collections.menuGroups).count()
      const addResult = await db.collection(collections.menuGroups).add({
        groupCode,
        title,
        icon,
        status,
        sortOrder: countResult.total * 10 + 10,
        createTime: now,
        updateTime: now,
        createBy: operator,
        updateBy: operator,
      })
      currentDoc = { _id: addResult.id }
    }

    const latest = await db.collection(collections.menuGroups).doc(currentDoc._id).get()
    const latestItem = normalizeMenuGroupItem(latest.data[0], latest.data[0]?.sortOrder || 10)

    await emitAuditLogSafe(event, {
      eventType: currentDoc?.groupId || before ? 'menuGroup.update' : 'menuGroup.create',
      resourceType: 'menuGroup',
      recordId: currentDoc._id,
      actor: operator,
      result: 'success',
      before,
      after: latestItem,
    })

    return success(event, {
      item: latestItem,
    })
  }

  async function deleteMenuGroup(event) {
    ensureSuperAdmin(event)

    const groupId = event?.data?.groupId ? String(event.data.groupId).trim() : ''
    if (!groupId) {
      return fail(event, 40001, '缺少分组 ID')
    }

    const current = await db.collection(collections.menuGroups).doc(groupId).get()
    if (!current.data?.[0]) {
      return fail(event, 40404, '分组不存在')
    }

    const occupied = await db.collection(collections.collections).where({ menuGroupId: groupId }).count()
    if (occupied.total > 0) {
      return fail(event, 40901, '该菜单下仍有模型，无法删除')
    }

    const before = normalizeMenuGroupItem(current.data[0], current.data[0]?.sortOrder || 10)
    await db.collection(collections.menuGroups).doc(groupId).remove()

    await emitAuditLogSafe(event, {
      eventType: 'menuGroup.delete',
      resourceType: 'menuGroup',
      recordId: groupId,
      actor: pickOperator(event),
      result: 'success',
      before,
      after: null,
    })

    return success(event, { groupId })
  }

  return {
    listMenuGroups,
    saveMenuGroup,
    deleteMenuGroup,
  }
}

module.exports = {
  createMenuActions,
}
