import jwt from 'jsonwebtoken'
import { TEST_JWT_SECRET } from './setup-env.js'

export function signTestToken(payload, options = {}) {
  return jwt.sign(payload, TEST_JWT_SECRET, { expiresIn: '15m', ...options })
}

export function makeContext(payload, options) {
  return { accessToken: signTestToken(payload, options) }
}

export const TOKEN_SUPER_ADMIN = () => signTestToken({
  userId: 'admin_id',
  userName: 'admin',
  nickName: '超级管理员',
  roleCode: 'role_super_admin',
})

export const TOKEN_OPERATOR = () => signTestToken({
  userId: 'op_id',
  userName: 'operator',
  nickName: '运营',
  roleCode: 'role_operator',
})

export const TOKEN_CUSTOM = (roleCode) => signTestToken({
  userId: `${roleCode}_id`,
  userName: roleCode,
  nickName: roleCode,
  roleCode,
})
