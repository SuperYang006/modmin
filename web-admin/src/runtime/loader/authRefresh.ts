import { callCloudFunction } from '@/services/cloud'
import { clearAuthSession, getStoredAuthSession, saveAuthSession } from '@/auth/session'
import { signInWithCustomTicket } from '@/services/tcb'
import type { RefreshTokenResult } from '@/types/auth'

const apiMode = import.meta.env.VITE_API_MODE ?? 'mock'

// 后端会轮换 refreshToken，因此所有刷新入口必须复用同一个进行中的请求。
let pendingRefresh: Promise<boolean> | null = null

export function refreshAccessToken(): Promise<boolean> {
  if (pendingRefresh) return pendingRefresh
  pendingRefresh = performRefresh().finally(() => { pendingRefresh = null })
  return pendingRefresh
}

async function performRefresh(): Promise<boolean> {
  const session = getStoredAuthSession()
  if (!session?.refreshToken) return false

  const response = await callCloudFunction<{ refreshToken: string }, RefreshTokenResult>('modmin_auth', {
    action: 'refreshToken',
    data: { refreshToken: session.refreshToken },
    meta: { requestId: `auth_refresh_${Date.now()}`, clientTime: Date.now() },
  })

  if (response.code !== 0) {
    clearAuthSession()
    return false
  }

  if (apiMode === 'tcb') {
    try {
      await signInWithCustomTicket(response.data.ticket)
    } catch {
      // ticket 刷新失败不影响主流程
    }
  }

  saveAuthSession(response.data)
  return true
}
