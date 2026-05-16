function createAdminUserActions(deps) {
  const {
    db,
    collections,
    command,
    success,
    fail,
    parseAccessToken,
    ensureSuperAdmin,
    pickOperator,
    safeDbGet,
    normalizeAdminUser,
    hashPassword,
    generateSalt,
    emitAuditLogSafe,
  } = deps

  async function listAdminUsers(event) {
    ensureSuperAdmin(event)
    const data = await safeDbGet(db.collection(collections.adminUsers).where({ status: command.in(['enabled', 'disabled']) }))
    const list = data
      .sort((a, b) => (a.createTime || 0) - (b.createTime || 0))
      .map(normalizeAdminUser)
    return success(event, { list })
  }

  async function saveAdminUser(event) {
    ensureSuperAdmin(event)
    const payload = event?.data?.user
    if (!payload?.userName) return fail(event, 40001, '缺少用户名')

    const now = Date.now()
    const operator = pickOperator(event)
    const userName = String(payload.userName).trim()
    const nickName = payload.nickName ? String(payload.nickName).trim() : userName
    const roleCode = payload.roleCode ? String(payload.roleCode).trim() : 'role_operator'
    const status = payload.status === 'disabled' ? 'disabled' : 'enabled'
    const userId = payload.userId ? String(payload.userId).trim() : ''
    const avatar = payload.avatar !== undefined ? (payload.avatar || null) : undefined

    if (userId) {
      const current = await db.collection(collections.adminUsers).doc(userId).get()
      if (!current.data?.[0]) return fail(event, 40404, '用户不存在')
      const before = normalizeAdminUser(current.data[0])

      const updateDoc = { userName, nickName, roleCode, status, updateTime: now, updateBy: operator }
      if (avatar !== undefined) updateDoc.avatar = avatar
      if (payload.password) {
        const salt = generateSalt()
        updateDoc.passwordSalt = salt
        updateDoc.passwordHash = hashPassword(payload.password, salt)
        const sessions = await db.collection(collections.sessions).where({ userId }).get()
        const delTasks = (sessions.data || []).map((item) => db.collection(collections.sessions).doc(item._id).remove())
        await Promise.all(delTasks)
      }

      await db.collection(collections.adminUsers).doc(userId).update(updateDoc)
      const latest = await db.collection(collections.adminUsers).doc(userId).get()
      const latestItem = normalizeAdminUser(latest.data[0])

      await emitAuditLogSafe(event, {
        eventType: 'user.update',
        resourceType: 'user',
        recordId: userId,
        actor: operator,
        result: 'success',
        before,
        after: latestItem,
      })

      return success(event, { item: latestItem })
    }

    if (!payload.password) return fail(event, 40001, '新增用户时密码不能为空')
    const dup = await db.collection(collections.adminUsers).where({ userName }).limit(1).get()
    if (dup.data?.[0]) return fail(event, 40901, '用户名已存在')

    const salt = generateSalt()
    const addResult = await db.collection(collections.adminUsers).add({
      userName,
      nickName,
      roleCode,
      status,
      avatar: avatar !== undefined ? avatar : null,
      passwordHash: hashPassword(payload.password, salt),
      passwordSalt: salt,
      createTime: now,
      updateTime: now,
      createBy: operator,
      updateBy: operator,
    })
    const latest = await db.collection(collections.adminUsers).doc(addResult.id).get()
    const latestItem = normalizeAdminUser(latest.data[0])

    await emitAuditLogSafe(event, {
      eventType: 'user.create',
      resourceType: 'user',
      recordId: addResult.id,
      actor: operator,
      result: 'success',
      after: latestItem,
    })

    return success(event, { item: latestItem })
  }

  async function deleteAdminUser(event) {
    ensureSuperAdmin(event)
    const userId = event?.data?.userId ? String(event.data.userId).trim() : ''
    if (!userId) return fail(event, 40001, '缺少用户 ID')

    const payload = parseAccessToken(event)
    if (payload?.userId === userId) return fail(event, 40901, '不能删除自己')

    const current = await db.collection(collections.adminUsers).doc(userId).get()
    if (!current.data?.[0]) return fail(event, 40404, '用户不存在')
    const before = normalizeAdminUser(current.data[0])

    const sessions = await db.collection(collections.sessions).where({ userId }).get()
    const delTasks = (sessions.data || []).map((item) => db.collection(collections.sessions).doc(item._id).remove())
    await Promise.all(delTasks)

    await db.collection(collections.adminUsers).doc(userId).remove()

    await emitAuditLogSafe(event, {
      eventType: 'user.delete',
      resourceType: 'user',
      recordId: userId,
      actor: pickOperator(event),
      result: 'success',
      before,
      after: null,
    })

    return success(event, { userId })
  }

  async function disableAdminUser(event) {
    ensureSuperAdmin(event)
    const userId = event?.data?.userId ? String(event.data.userId).trim() : ''
    if (!userId) return fail(event, 40001, '缺少用户 ID')

    const payload = parseAccessToken(event)
    if (payload?.userId === userId) return fail(event, 40901, '不能禁用自己')

    const current = await db.collection(collections.adminUsers).doc(userId).get()
    if (!current.data?.[0]) return fail(event, 40404, '用户不存在')
    const before = normalizeAdminUser(current.data[0])

    const now = Date.now()
    const operator = pickOperator(event)
    await db.collection(collections.adminUsers).doc(userId).update({
      status: 'disabled',
      updateTime: now,
      updateBy: operator,
    })

    const sessions = await db.collection(collections.sessions).where({ userId }).get()
    const delTasks = (sessions.data || []).map((item) => db.collection(collections.sessions).doc(item._id).remove())
    await Promise.all(delTasks)

    await emitAuditLogSafe(event, {
      eventType: 'user.update',
      resourceType: 'user',
      recordId: userId,
      actor: operator,
      result: 'success',
      before,
      after: {
        ...before,
        status: 'disabled',
      },
    })

    return success(event, { userId })
  }

  return {
    listAdminUsers,
    saveAdminUser,
    deleteAdminUser,
    disableAdminUser,
  }
}

module.exports = {
  createAdminUserActions,
}
