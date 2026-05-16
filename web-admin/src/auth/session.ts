import type { AdminUserInfo, ClientSourceInfo, LoginResult, RefreshTokenResult } from '@/types/auth'

const AUTH_SESSION_STORAGE_KEY = 'modmin_auth_session'

export interface AuthSession {
  ticket: string
  accessToken: string
  refreshToken: string
  expireTime: number
  userInfo: AdminUserInfo
  clientInfo?: ClientSourceInfo
}

export function getStoredAuthSession(): AuthSession | null {
  const raw = window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as AuthSession
  } catch {
    window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY)
    return null
  }
}

export function saveAuthSession(result: LoginResult | RefreshTokenResult) {
  const currentSession = getStoredAuthSession()
  const session: AuthSession = {
    ticket: result.ticket,
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    expireTime: result.expireTime,
    userInfo: result.userInfo,
    clientInfo: result.clientInfo || currentSession?.clientInfo,
  }
  window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session))
}

export function patchStoredSessionUserInfo(patch: Partial<AdminUserInfo>) {
  const session = getStoredAuthSession()
  if (!session) return
  const next: AuthSession = { ...session, userInfo: { ...session.userInfo, ...patch } }
  window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(next))
  window.dispatchEvent(new CustomEvent('modmin:session-updated'))
}

export function clearAuthSession() {
  window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY)
}

export function isAccessTokenExpired(session: AuthSession | null) {
  if (!session) return true
  // 提前 30 秒判定过期，预留刷新窗口
  return session.expireTime - 30_000 <= Date.now()
}

export function isSuperAdmin(session: AuthSession | null) {
  return session?.userInfo?.roleCode === 'role_super_admin'
}
