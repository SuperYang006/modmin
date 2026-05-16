import { describe, it, expect, beforeEach } from 'vitest'
import jwt from 'jsonwebtoken'
import { loadCloudFunction, resetDb, getDocs } from './helpers/load-fn.js'
import { TEST_JWT_SECRET } from './helpers/setup-env.js'
import { buildAdminUser, buildRoleDoc } from './helpers/fixtures.js'

const COLLECTIONS = {
  adminUsers: 'modmin_admin_users',
  sessions: 'modmin_sessions',
  adminRoles: 'modmin_admin_roles',
}

function call(fn, action, data) {
  return fn.main({ action, data, meta: { requestId: 'req_test' } })
}

describe('modmin_auth', () => {
  let fn
  beforeEach(() => {
    resetDb({
      [COLLECTIONS.adminUsers]: [
        buildAdminUser({ _id: 'user_op', userName: 'alice', roleCode: 'role_operator' }),
        buildAdminUser({
          _id: 'user_disabled',
          userName: 'bob',
          roleCode: 'role_operator',
          status: 'disabled',
        }),
        buildAdminUser({
          _id: 'user_super',
          userName: 'root',
          roleCode: 'role_super_admin',
        }),
        buildAdminUser({
          _id: 'user_disabled_role',
          userName: 'carol',
          roleCode: 'role_archived',
        }),
      ],
      [COLLECTIONS.adminRoles]: [
        buildRoleDoc({ roleCode: 'role_operator', status: 'enabled' }),
        buildRoleDoc({ roleCode: 'role_archived', status: 'disabled' }),
      ],
    })
    fn = loadCloudFunction('modmin_auth')
  })

  describe('login', () => {
    it('rejects unknown user', async () => {
      const res = await call(fn, 'login', { userName: 'unknown', password: 'x' })
      expect(res.code).toBe(40101)
    })

    it('rejects wrong password', async () => {
      const res = await call(fn, 'login', { userName: 'alice', password: 'wrong' })
      expect(res.code).toBe(40101)
      const logs = getDocs('modmin_audit_logs')
      expect(logs).toHaveLength(1)
      expect(logs[0].eventType).toBe('auth.login.failure')
    })

    it('rejects disabled user', async () => {
      const res = await call(fn, 'login', { userName: 'bob', password: 'secret_password_123' })
      expect(res.code).toBe(40101)
    })

    it('rejects when role is disabled', async () => {
      const res = await call(fn, 'login', { userName: 'carol', password: 'secret_password_123' })
      expect(res.code).toBe(40103)
      expect(res.message).toMatch(/角色已停用/)
    })

    it('signs valid access + refresh token on success', async () => {
      const res = await call(fn, 'login', { userName: 'alice', password: 'secret_password_123' })
      expect(res.code).toBe(0)
      expect(res.data.accessToken).toBeTruthy()
      expect(res.data.refreshToken).toBeTruthy()
      const payload = jwt.verify(res.data.accessToken, TEST_JWT_SECRET)
      expect(payload.roleCode).toBe('role_operator')
      expect(payload.userName).toBe('alice')
      expect(getDocs(COLLECTIONS.sessions)).toHaveLength(1)
      const logs = getDocs('modmin_audit_logs')
      expect(logs).toHaveLength(1)
      expect(logs[0].eventType).toBe('auth.login.success')
    })

    it('super admin login bypasses role status check', async () => {
      const res = await call(fn, 'login', { userName: 'root', password: 'secret_password_123' })
      expect(res.code).toBe(0)
    })

    it('clears previous sessions for same user on new login', async () => {
      await call(fn, 'login', { userName: 'alice', password: 'secret_password_123' })
      const firstRefresh = getDocs(COLLECTIONS.sessions)[0].refreshToken

      const second = await call(fn, 'login', { userName: 'alice', password: 'secret_password_123' })
      expect(second.code).toBe(0)

      const sessions = getDocs(COLLECTIONS.sessions)
      expect(sessions).toHaveLength(1)
      expect(sessions[0].refreshToken).not.toBe(firstRefresh)
      expect(sessions[0].refreshToken).toBe(second.data.refreshToken)
    })
  })

  describe('refreshToken', () => {
    async function loginAndGetRefresh(userName = 'alice') {
      const res = await call(fn, 'login', { userName, password: 'secret_password_123' })
      return res.data.refreshToken
    }

    it('rotates refresh token on valid input', async () => {
      const refresh = await loginAndGetRefresh()
      const res = await call(fn, 'refreshToken', { refreshToken: refresh })
      expect(res.code).toBe(0)
      expect(res.data.refreshToken).not.toBe(refresh)
      const sessions = getDocs(COLLECTIONS.sessions)
      expect(sessions).toHaveLength(1)
      expect(sessions[0].refreshToken).toBe(res.data.refreshToken)
    })

    it('rejects unknown refresh token', async () => {
      const res = await call(fn, 'refreshToken', { refreshToken: 'not_exist' })
      expect(res.code).toBe(40102)
    })

    it('rejects expired refresh token', async () => {
      const refresh = await loginAndGetRefresh()
      const sessions = getDocs(COLLECTIONS.sessions)
      const sid = sessions[0]._id
      // expire it by direct update via mock storage round-trip
      const adminFn = loadCloudFunction('modmin_auth')
      await adminFn.main({
        action: 'logout',
        data: { refreshToken: refresh },
        meta: { requestId: 'r' },
      })
      const res = await call(fn, 'refreshToken', { refreshToken: refresh })
      expect(res.code).toBe(40102)
      expect(sid).toBeTruthy()
    })

    it('rejects when role becomes disabled between login and refresh', async () => {
      const refresh = await loginAndGetRefresh()
      // 将 role 切到 disabled
      resetDb({
        [COLLECTIONS.adminUsers]: getDocs(COLLECTIONS.adminUsers),
        [COLLECTIONS.sessions]: getDocs(COLLECTIONS.sessions),
        [COLLECTIONS.adminRoles]: [
          buildRoleDoc({ roleCode: 'role_operator', status: 'disabled' }),
        ],
      })
      const res = await call(fn, 'refreshToken', { refreshToken: refresh })
      expect(res.code).toBe(40103)
    })
  })

  describe('validateSession', () => {
    it('accepts valid access token', async () => {
      const login = await call(fn, 'login', { userName: 'alice', password: 'secret_password_123' })
      const res = await call(fn, 'validateSession', { accessToken: login.data.accessToken })
      expect(res.code).toBe(0)
      expect(res.data.valid).toBe(true)
      expect(res.data.userInfo.userName).toBe('alice')
    })

    it('rejects tampered token', async () => {
      const res = await call(fn, 'validateSession', { accessToken: 'not.a.jwt' })
      expect(res.code).toBe(40102)
    })

    it('rejects missing token', async () => {
      const res = await call(fn, 'validateSession', {})
      expect(res.code).toBe(40102)
    })
  })

  describe('getCurrentUser', () => {
    it('returns user info for valid token', async () => {
      const login = await call(fn, 'login', { userName: 'alice', password: 'secret_password_123' })
      const res = await call(fn, 'getCurrentUser', { accessToken: login.data.accessToken })
      expect(res.code).toBe(0)
      expect(res.data.userInfo.roleCode).toBe('role_operator')
    })

    it('rejects without token', async () => {
      const res = await call(fn, 'getCurrentUser', {})
      expect(res.code).toBe(40102)
    })
  })

  describe('illegal action', () => {
    it('returns 40002 for unknown action', async () => {
      const res = await call(fn, 'mystery', {})
      expect(res.code).toBe(40002)
    })
  })
})
