function createAuthActions(deps) {
  const {
    db,
    collections,
    ticketApp,
    accessTokenTtl,
    refreshTokenTtl,
    ok,
    fail,
    hashPassword,
    generateRefreshToken,
    signAccessToken,
    verifyAccessToken,
    emitAuditLogSafe,
    getClientIp,
    getUserAgent,
  } = deps

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

  // ─── Actions ─────────────────────────────────────────────────

  async function login(request) {
    const requestId = request?.meta?.requestId
    const userName = request?.data?.userName
    const password = request?.data?.password

    if (!userName || !password) {
      const response = fail(requestId, 40001, '请输入账号和密码')
      await emitAuditLogSafe(request, {
        eventType: 'auth.login.failure',
        resourceType: 'auth',
        result: 'failure',
        actor: { userName: userName || '', nickName: userName || '' },
        errorMessage: response.message,
      })
      return response
    }

    const result = await db.collection(collections.adminUsers)
      .where({ userName })
      .limit(1)
      .get()

    const user = result.data?.[0]

    if (!user || user.status === 'disabled') {
      const response = fail(requestId, 40101, '账号或密码错误')
      await emitAuditLogSafe(request, {
        eventType: 'auth.login.failure',
        resourceType: 'auth',
        result: 'failure',
        actor: { userName, nickName: userName },
        errorMessage: response.message,
      })
      return response
    }

    const expectedHash = hashPassword(password, user.passwordSalt)
    if (user.passwordHash !== expectedHash) {
      const response = fail(requestId, 40101, '账号或密码错误')
      await emitAuditLogSafe(request, {
        eventType: 'auth.login.failure',
        resourceType: 'auth',
        result: 'failure',
        actor: { userId: user._id, userName, nickName: user.nickName || userName, roleCode: user.roleCode },
        errorMessage: response.message,
      })
      return response
    }

    if (await isRoleDisabled(user.roleCode)) {
      const response = fail(requestId, 40103, '当前账号所属角色已停用，请联系管理员')
      await emitAuditLogSafe(request, {
        eventType: 'auth.login.failure',
        resourceType: 'auth',
        result: 'failure',
        actor: { userId: user._id, userName, nickName: user.nickName || userName, roleCode: user.roleCode },
        errorMessage: response.message,
      })
      return response
    }

    const userPayload = {
      userId: user._id,
      userName: user.userName,
      nickName: user.nickName || user.userName,
      roleCode: user.roleCode,
      avatar: user.avatar || null,
    }

    const accessToken = signAccessToken(userPayload, accessTokenTtl)
    const refreshToken = generateRefreshToken()
    const now = Date.now()
    const clientInfo = {
      clientIp: getClientIp(request, {}),
      userAgent: getUserAgent(request, {}),
    }

    const existingSessions = await db.collection(collections.sessions).where({ userId: user._id }).get()
    const removeTasks = (existingSessions.data || []).map((item) => db.collection(collections.sessions).doc(item._id).remove())
    await Promise.all(removeTasks)

    await db.collection(collections.sessions).add({
      refreshToken,
      userId: user._id,
      expireTime: now + refreshTokenTtl * 1000,
      createTime: now,
    })

    const response = ok(requestId, {
      ticket: ticketApp.auth().createTicket(user._id),
      accessToken,
      refreshToken,
      expireTime: now + accessTokenTtl * 1000,
      userInfo: userPayload,
      clientInfo,
    })

    await emitAuditLogSafe(request, {
      eventType: 'auth.login.success',
      resourceType: 'auth',
      result: 'success',
      actor: userPayload,
      after: {
        userInfo: userPayload,
        expireTime: now + accessTokenTtl * 1000,
      },
    })

    return response
  }

  async function refreshToken(request) {
    const requestId = request?.meta?.requestId
    const token = request?.data?.refreshToken

    if (!token) {
      return fail(requestId, 40001, '缺少 refreshToken')
    }

    const now = Date.now()
    const result = await db.collection(collections.sessions)
      .where({ refreshToken: token })
      .limit(1)
      .get()

    const session = result.data?.[0]

    if (!session || session.expireTime <= now) {
      return fail(requestId, 40102, '登录态已过期，请重新登录')
    }

    const userResult = await db.collection(collections.adminUsers)
      .doc(session.userId)
      .get()

    const user = userResult.data?.[0]

    if (!user || user.status === 'disabled') {
      return fail(requestId, 40102, '账号不存在或已禁用')
    }

    if (await isRoleDisabled(user.roleCode)) {
      return fail(requestId, 40103, '当前账号所属角色已停用，请联系管理员')
    }

    // 轮换：删旧 refreshToken，生成新的
    await db.collection(collections.sessions).doc(session._id).remove()

    const newRefreshToken = generateRefreshToken()
    await db.collection(collections.sessions).add({
      refreshToken: newRefreshToken,
      userId: user._id,
      expireTime: now + refreshTokenTtl * 1000,
      createTime: now,
    })

    const userPayload = {
      userId: user._id,
      userName: user.userName,
      nickName: user.nickName || user.userName,
      roleCode: user.roleCode,
      avatar: user.avatar || null,
    }

    const newAccessToken = signAccessToken(userPayload, accessTokenTtl)
    const clientInfo = {
      clientIp: getClientIp(request, {}),
      userAgent: getUserAgent(request, {}),
    }

    return ok(requestId, {
      ticket: ticketApp.auth().createTicket(user._id),
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expireTime: now + accessTokenTtl * 1000,
      userInfo: userPayload,
      clientInfo,
    })
  }

  function validateSession(request) {
    const requestId = request?.meta?.requestId
    const token = request?.data?.accessToken
    const payload = verifyAccessToken(token)

    if (!payload) {
      return fail(requestId, 40102, '登录态已过期')
    }

    return ok(requestId, {
      valid: true,
      expireTime: payload.exp * 1000,
      userInfo: {
        userId: payload.userId,
        userName: payload.userName,
        nickName: payload.nickName,
        roleCode: payload.roleCode,
        avatar: payload.avatar || null,
      },
    })
  }

  function getCurrentUser(request) {
    const requestId = request?.meta?.requestId
    const token = request?.data?.accessToken
    const payload = verifyAccessToken(token)

    if (!payload) {
      return fail(requestId, 40102, '登录态失效')
    }

    return ok(requestId, {
      userInfo: {
        userId: payload.userId,
        userName: payload.userName,
        nickName: payload.nickName,
        roleCode: payload.roleCode,
        avatar: payload.avatar || null,
      },
    })
  }

  async function logout(request) {
    const requestId = request?.meta?.requestId
    const token = request?.data?.refreshToken

    if (token) {
      const result = await db.collection(collections.sessions)
        .where({ refreshToken: token })
        .limit(1)
        .get()
      const session = result.data?.[0]
      if (session?._id) {
        await db.collection(collections.sessions).doc(session._id).remove()
      }
    }

    return ok(requestId, {})
  }

  return {
    login,
    refreshToken,
    validateSession,
    getCurrentUser,
    logout,
  }
}

module.exports = {
  createAuthActions,
}
