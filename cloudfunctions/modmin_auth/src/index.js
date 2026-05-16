const cloudbase = require('@cloudbase/node-sdk')
const credentials = require('../tcb_custom_login.json')
const { parseEvent, ok, fail } = require('./response.js')
const { createAuthActions } = require('./actions.js')
const { createAuditLogger } = require('../shared/audit-log.js')
const { getClientIp, getUserAgent } = require('../shared/audit-log.js')
const {
  hashPassword,
  generateRefreshToken,
  signAccessToken,
  verifyAccessToken,
} = require('./token.js')

// 用私钥初始化，仅用于签发 CloudBase ticket
const ticketApp = cloudbase.init({
  env: credentials.env_id,
  credentials,
})

// 用 SYMBOL_CURRENT_ENV 初始化，用于数据库操作
// 本地开发时被 local-server 的 patch 替换为 secretId/secretKey
// 云端部署时自动使用当前环境凭据
const app = cloudbase.init({
  env: cloudbase.SYMBOL_CURRENT_ENV,
})

const db = app.database()
const collectionPrefix = process.env.MODMIN_COLLECTION_PREFIX || 'modmin_'
const { emitAuditLogSafe } = createAuditLogger({ db })

const COLLECTIONS = {
  adminUsers: `${collectionPrefix}admin_users`,
  sessions: `${collectionPrefix}sessions`,
  adminRoles: process.env.MODMIN_ADMIN_ROLES_COLLECTION || `${collectionPrefix}admin_roles`,
}

const ACCESS_TOKEN_TTL = 15 * 60           // 15 分钟，单位秒
const REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60 // 7 天，单位秒

const { login, refreshToken, validateSession, getCurrentUser, logout } = createAuthActions({
  db,
  collections: COLLECTIONS,
  ticketApp,
  accessTokenTtl: ACCESS_TOKEN_TTL,
  refreshTokenTtl: REFRESH_TOKEN_TTL,
  ok,
  fail,
  hashPassword,
  generateRefreshToken,
  signAccessToken,
  verifyAccessToken,
  emitAuditLogSafe,
  getClientIp,
  getUserAgent,
})

const ACTION_HANDLERS = {
  login,
  refreshToken,
  validateSession,
  getCurrentUser,
  logout,
}

// ─── 入口 ─────────────────────────────────────────────────────

exports.main = async (event) => {

  const request = parseEvent(event)
  const requestId = request?.meta?.requestId

  if (request?.__parseError) {
    return fail(requestId, 40001, `invalid request body: ${request.__parseError}`)
  }

  const { action = '' } = request

  try {
    const handler = ACTION_HANDLERS[action]
    return handler ? await handler(request) : fail(requestId, 40002, 'illegal action')
  } catch (error) {
    return fail(requestId, 50001, error instanceof Error ? error.message : '服务器内部错误')
  }
}
