const jwt = require('jsonwebtoken')

function getJwtSecret() {
  const secret = process.env.MODMIN_JWT_SECRET

  if (!secret || secret === 'modmin_dev_secret_change_in_production') {
    throw new Error('[modmin_runtime] MODMIN_JWT_SECRET 环境变量未配置或仍为开发占位值，拒绝启动')
  }

  if (secret.length < 32) {
    throw new Error('[modmin_runtime] MODMIN_JWT_SECRET 长度不足 32 字符，安全性不达标')
  }

  return secret
}

function createAuthHelpers({ jwtSecret }) {
  function parseAccessToken(event) {
    const token = event?.context?.accessToken
    if (!token || typeof token !== 'string') return null

    try {
      return jwt.verify(token, jwtSecret)
    } catch {
      return null
    }
  }

  function getCurrentRoleCode(event) {
    return parseAccessToken(event)?.roleCode || ''
  }

  function isSuperAdmin(event) {
    return getCurrentRoleCode(event) === 'role_super_admin'
  }

  return {
    parseAccessToken,
    getCurrentRoleCode,
    isSuperAdmin,
  }
}

module.exports = {
  getJwtSecret,
  createAuthHelpers,
}
