const crypto = require('crypto')
const jwt = require('jsonwebtoken')

function readJwtSecret() {
  const secret = process.env.MODMIN_JWT_SECRET
  if (!secret || secret === 'modmin_dev_secret_change_in_production') {
    throw new Error('[modmin_auth] MODMIN_JWT_SECRET 环境变量未配置或仍为开发占位值，拒绝启动')
  }
  if (secret.length < 32) {
    throw new Error('[modmin_auth] MODMIN_JWT_SECRET 长度不足 32 字符，安全性不达标')
  }
  return secret
}

const JWT_SECRET = readJwtSecret()

function hashPassword(password, salt) {
  return crypto.createHash('sha256').update(password + salt).digest('hex')
}

function generateRefreshToken() {
  return crypto.randomBytes(32).toString('hex')
}

function signAccessToken(payload, ttlSeconds) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ttlSeconds })
}

function verifyAccessToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET)
  } catch {
    return null
  }
}

module.exports = {
  hashPassword,
  generateRefreshToken,
  signAccessToken,
  verifyAccessToken,
}
