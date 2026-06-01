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

async function getValidAccessToken(): Promise<string> {
  const session = getStoredAuthSession()
  if (!session) return ''

  if (isAccessTokenExpired(session)) {
    const { refreshAccessToken } = await import('@/runtime/loader/authRefresh')
    const refreshed = await refreshAccessToken()
    if (!refreshed) {
      clearAuthSession()
      return ''
    }
    return getStoredAuthSession()?.accessToken ?? ''
  }

  return session.accessToken
}

// 后端判定 access token 过期时返回的 code。proactive 刷新（getValidAccessToken）漏判时由它触发兜底重发。
const TOKEN_EXPIRED_CODE = 40102

async function sendViaHttp<TData, TResult>(
  resolvedName: string,
  payload: ApiRequest<TData>,
  accessToken: string,
): Promise<ApiResponse<TResult>> {
  const session = getStoredAuthSession()
  const response = await fetch(`${localServerUrl}/${resolvedName}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      ...payload,
      context: {
        accessToken,
        clientIp: session?.clientInfo?.clientIp || '',
        userAgent: session?.clientInfo?.userAgent || '',
      },
    }),
  })
  return (await response.json()) as ApiResponse<TResult>
}

async function sendViaTcb<TData, TResult>(
  resolvedName: string,
  payload: ApiRequest<TData>,
  accessToken: string,
): Promise<ApiResponse<TResult>> {
  const app = await getTcbApp()
  if (typeof app.callFunction !== 'function') {
    throw new Error('当前 CloudBase JS SDK 实例上不存在 callFunction，请检查 SDK 版本与初始化方式')
  }
  const session = getStoredAuthSession()
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
  return result?.result as ApiResponse<TResult>
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

  const send = apiMode === 'http' ? sendViaHttp<TData, TResult> : sendViaTcb<TData, TResult>

  const accessToken = isAuthCall ? '' : await getValidAccessToken()
  let res = await send(resolvedName, payload, accessToken)

  // 反应式兜底：proactive 提前判断因时钟偏差/休眠/网络延迟漏判时，后端会判过期返回 40102。
  // 此时强制刷新一次并重发一次原请求，避免本可挽救的请求把用户直接踢回登录页。只重试一次防死循环。
  if (!isAuthCall && res?.code === TOKEN_EXPIRED_CODE) {
    const { refreshAccessToken } = await import('@/runtime/loader/authRefresh')
    const refreshed = await refreshAccessToken()
    if (refreshed) {
      res = await send(resolvedName, payload, getStoredAuthSession()?.accessToken ?? '')
    }
  }

  maybeNotifyAuthExpired(resolvedName, res)
  return res
}
