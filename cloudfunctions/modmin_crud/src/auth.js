const jwt = require('jsonwebtoken')

function readJwtSecret() {
  const secret = process.env.MODMIN_JWT_SECRET
  if (!secret || secret === 'modmin_dev_secret_change_in_production') {
    throw new Error('[modmin_crud] MODMIN_JWT_SECRET 环境变量未配置或仍为开发占位值，拒绝启动')
  }
  if (secret.length < 32) {
    throw new Error('[modmin_crud] MODMIN_JWT_SECRET 长度不足 32 字符，安全性不达标')
  }
  return secret
}

const JWT_SECRET = readJwtSecret()

function parseAccessToken(event) {
  const token = event?.context?.accessToken
  if (!token || typeof token !== 'string') return null
  try {
    return jwt.verify(token, JWT_SECRET)
  } catch {
    return null
  }
}

function isSuperAdmin(event) {
  return parseAccessToken(event)?.roleCode === 'role_super_admin'
}

function pickOperator(event) {
  const payload = parseAccessToken(event)
  const userId = payload?.userId || 'system'
  const userName = payload?.userName || 'system'
  const nickName = payload?.nickName || userName
  const roleCode = payload?.roleCode || ''

  return {
    userId,
    userName,
    nickName,
    roleCode,
  }
}

module.exports = {
  parseAccessToken,
  isSuperAdmin,
  pickOperator,
}
