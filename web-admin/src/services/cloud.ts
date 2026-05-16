import type { ApiRequest, ApiResponse } from '../../../shared/types/api'
import { dispatchMockCloudFunction } from '@/mocks'
import { clearAuthSession, getStoredAuthSession, isAccessTokenExpired } from '@/auth/session'
import { getTcbApp } from '@/services/tcb'

const apiMode: 'mock' | 'http' | 'tcb' = (import.meta.env.VITE_API_MODE as 'mock' | 'http' | 'tcb' | undefined) ?? 'mock'
const functionPrefix = import.meta.env.VITE_MODMIN_FUNCTION_PREFIX ?? 'modmin_'
const localServerUrl = import.meta.env.VITE_LOCAL_SERVER_URL ?? 'http://localhost:3100'

// 命中这些 code 视为登录态失效：清会话 + 派发事件让上层路由跳到 /login。
// 40101 未登录或登录已过期；40102 登录态过期 / 不存在；40103 角色已停用。
const AUTH_EXPIRED_CODES = new Set([40101, 40102, 40103])
let authExpiredEmitted = false

function notifyAuthExpired(reason: string) {
  if (authExpiredEmitted) return
  authExpiredEmitted = true
  clearAuthSession()
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('modmin:auth-expired', { detail: { reason } }))
  }
  // 留一个短窗口避免连环重复：业务页通常会并发发多个请求，全部 401 时只跳一次
  setTimeout(() => { authExpiredEmitted = false }, 1000)
}

function maybeNotifyAuthExpired<T>(functionName: string, response: ApiResponse<T> | undefined) {
  if (!response) return
  if (functionName.endsWith('modmin_auth')) return // 登录页本身不能触发跳转
  if (AUTH_EXPIRED_CODES.has(response.code)) {
    notifyAuthExpired(response.message || `code:${response.code}`)
  }
}

function resolveCloudFunctionName(functionName: string) {
  if (functionName.startsWith(functionPrefix)) return functionName
  return `${functionPrefix}${functionName}`
}

// 多个并发请求同时遇到 access token 过期时，只发起一次 refresh，
// 其余请求 await 同一个 promise 并使用 refresh 后的新 token。
let pendingRefresh: Promise<string> | null = null

async function performRefresh(): Promise<string> {
  const { refreshAccessToken } = await import('@/runtime/loader/auth')
  const refreshed = await refreshAccessToken()
  if (!refreshed) {
    clearAuthSession()
    return ''
  }
  return getStoredAuthSession()?.accessToken ?? ''
}

async function getValidAccessToken(): Promise<string> {
  const session = getStoredAuthSession()
  if (!session) return ''

  // refresh 进行中：所有并发请求都等同一个 promise，避免拿旧 token 发请求
  if (pendingRefresh) return pendingRefresh

  if (isAccessTokenExpired(session)) {
    pendingRefresh = performRefresh().finally(() => { pendingRefresh = null })
    return pendingRefresh
  }

  return session.accessToken
}

export async function callCloudFunction<TData, TResult>(
  functionName: string,
  payload: ApiRequest<TData>,
): Promise<ApiResponse<TResult>> {
  const resolvedName = resolveCloudFunctionName(functionName)
  // modmin_auth 自身不需要 access token（login / refreshToken / validateSession 等都通过 data 传所需凭据），
  // 跳过 getValidAccessToken 防止 refresh 流程内的 modmin_auth.refreshToken 调用形成等待自己的死锁。
  const isAuthCall = resolvedName === `${functionPrefix}auth`

  if (apiMode === 'mock') {
    const res = await dispatchMockCloudFunction<TData, TResult>(functionName, payload)
    maybeNotifyAuthExpired(resolvedName, res)
    return res
  }

  if (apiMode === 'http') {
    const accessToken = isAuthCall ? '' : await getValidAccessToken()
    const session = getStoredAuthSession()
    const body = {
      ...payload,
      context: {
        accessToken,
        clientIp: session?.clientInfo?.clientIp || '',
        userAgent: session?.clientInfo?.userAgent || '',
      },
    }
    const response = await fetch(`${localServerUrl}/${resolvedName}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    const res = (await response.json()) as ApiResponse<TResult>
    maybeNotifyAuthExpired(resolvedName, res)
    return res
  }

  const app = await getTcbApp()
  const accessToken = isAuthCall ? '' : await getValidAccessToken()
  const session = getStoredAuthSession()

  if (typeof app.callFunction !== 'function') {
    throw new Error('当前 CloudBase JS SDK 实例上不存在 callFunction，请检查 SDK 版本与初始化方式')
  }

  const result = await app.callFunction({
    name: resolvedName,
    data: {
      ...payload,
      context: {
        accessToken,
        clientIp: session?.clientInfo?.clientIp || '',
        userAgent: session?.clientInfo?.userAgent || '',
      },
    },
  })

  const res = result?.result as ApiResponse<TResult>
  maybeNotifyAuthExpired(resolvedName, res)
  return res
}
