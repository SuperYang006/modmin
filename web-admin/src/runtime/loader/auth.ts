import { callCloudFunction } from '@/services/cloud'
import { clearAuthSession, getStoredAuthSession, isAccessTokenExpired, saveAuthSession } from '@/auth/session'
import { signInWithCustomTicket } from '@/services/tcb'
import type {
  CurrentUserResult,
  LoginRequestData,
  LoginResult,
  ValidateSessionResult,
} from '@/types/auth'

const apiMode = import.meta.env.VITE_API_MODE ?? 'mock'

async function loginViaHttp(data: LoginRequestData) {
  const loginUrl = import.meta.env.VITE_MODMIN_AUTH_LOGIN_URL
  if (!loginUrl) throw new Error('VITE_MODMIN_AUTH_LOGIN_URL is not configured')

  const response = await fetch(loginUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      action: 'login',
      data,
      meta: { requestId: `auth_login_${Date.now()}`, clientTime: Date.now() },
    }),
  })

  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return (await response.json()) as { code: number; message: string; data: LoginResult }
}

export async function loginWithPassword(data: LoginRequestData) {
  let response: { code: number; message: string; data: LoginResult }

  if (apiMode === 'tcb') {
    try {
      response = await loginViaHttp(data)
    } catch (error) {
      throw new Error(error instanceof Error ? `登录接口调用失败：${error.message}` : '登录接口调用失败')
    }
  } else {
    try {
      response = await callCloudFunction<LoginRequestData, LoginResult>('modmin_auth', {
        action: 'login',
        data,
        meta: { requestId: `auth_login_${Date.now()}`, clientTime: Date.now() },
      })
    } catch (error) {
      throw new Error(error instanceof Error ? `登录云函数调用失败：${error.message}` : '登录云函数调用失败')
    }
  }

  if (response.code === 0) {
    if (apiMode === 'tcb') {
      try {
        await signInWithCustomTicket(response.data.ticket)
      } catch (error) {
        throw new Error(error instanceof Error ? `CloudBase Ticket 登录失败：${error.message}` : 'CloudBase Ticket 登录失败')
      }
    }
    saveAuthSession(response.data)
  }

  return response
}

export async function validateAdminSession() {
  const session = getStoredAuthSession()

  if (!session) {
    return {
      code: 40101,
      message: '未登录',
      data: { valid: false, expireTime: 0, userInfo: null } as unknown as ValidateSessionResult,
      requestId: `auth_validate_missing_${Date.now()}`,
      serverTime: Date.now(),
    }
  }

  // Access Token 过期时先尝试用 Refresh Token 续期
  if (isAccessTokenExpired(session)) {
    const { refreshAccessToken } = await import('@/runtime/loader/authRefresh')
    const refreshed = await refreshAccessToken()
    if (!refreshed) {
      return {
        code: 40102,
        message: '登录态已过期，请重新登录',
        data: { valid: false, expireTime: 0, userInfo: null } as unknown as ValidateSessionResult,
        requestId: `auth_validate_expired_${Date.now()}`,
        serverTime: Date.now(),
      }
    }
  }

  const currentSession = getStoredAuthSession()!
  const response = await callCloudFunction<{ accessToken: string }, ValidateSessionResult>('modmin_auth', {
    action: 'validateSession',
    data: { accessToken: currentSession.accessToken },
    meta: { requestId: `auth_validate_${Date.now()}`, clientTime: Date.now() },
  })

  if (response.code !== 0 || !response.data.valid) {
    clearAuthSession()
  }

  return response
}

export async function getCurrentAdminUser() {
  const session = getStoredAuthSession()
  return callCloudFunction<{ accessToken: string }, CurrentUserResult>('modmin_auth', {
    action: 'getCurrentUser',
    data: { accessToken: session?.accessToken ?? '' },
    meta: { requestId: `auth_current_user_${Date.now()}`, clientTime: Date.now() },
  })
}

export async function restoreTcbLogin() {
  const session = getStoredAuthSession()
  if (apiMode !== 'tcb' || !session?.ticket) return
  await signInWithCustomTicket(session.ticket)
}

export async function logoutAdminUser() {
  const session = getStoredAuthSession()
  await callCloudFunction<{ refreshToken: string }, Record<string, never>>('modmin_auth', {
    action: 'logout',
    data: { refreshToken: session?.refreshToken ?? '' },
    meta: { requestId: `auth_logout_${Date.now()}`, clientTime: Date.now() },
  })
  clearAuthSession()
}
