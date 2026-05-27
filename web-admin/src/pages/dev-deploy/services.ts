export interface DeployTaskLogItem {
  id: string
  level: 'info' | 'success' | 'warning' | 'error'
  message: string
  time: number
}

export interface DeployTaskStatus {
  taskId: string
  status: 'queued' | 'running' | 'success' | 'error'
  logs: DeployTaskLogItem[]
  result: {
    envId: string
    basePath: string
    adminUserName: string
    adminAccessUrl?: string
  } | null
  error: string
  createdAt: number
  updatedAt: number
  startedAt: number
  finishedAt: number
}

export interface DeployTaskPayload {
  envId: string
  region: string
  secretId: string
  secretKey: string
  jwtSecret: string
  authHttpUrl: string
  loginKeyPath: string
  basePath: string
  adminUserName: string
  adminPassword: string
  adminNickName: string
  overwriteAdmin: boolean
  cleanHosting: boolean
}

export interface DeployConfigSnapshot {
  detected: boolean
  values: Omit<DeployTaskPayload, 'adminPassword'>
  secretsDetected: {
    envId: boolean
    secretId: boolean
    secretKey: boolean
    jwtSecret: boolean
    authHttpUrl: boolean
  }
  masked: {
    envId: string
    secretId: string
    secretKey: string
    jwtSecret: string
    authHttpUrl: string
  }
  sources: {
    localServerConfig: string
    webEnv: string
    loginKey: string
  }
}

export interface LocalBootstrapStatus {
  envId: string
  configDetected: boolean
  authHttpUrlConfigured: boolean
  collectionReady: boolean
  adminUserExists: boolean
  adminUserName: string
  stage: 'missing_collections' | 'missing_admin' | 'ready'
}

interface LocalResponse<T> {
  code: number
  message: string
  data: T
}

const localServerUrl = import.meta.env.VITE_LOCAL_SERVER_URL ?? 'http://localhost:3100'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${localServerUrl}${path}`, {
    headers: { 'content-type': 'application/json', ...(init?.headers || {}) },
    ...init,
  })
  const result = (await response.json()) as LocalResponse<T>
  if (result.code !== 0) {
    throw new Error(result.message || `请求失败：${result.code}`)
  }
  return result.data
}

export async function createDeployTask(payload: DeployTaskPayload) {
  return request<{ taskId: string; status: string }>('/_local/deploy/tasks', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function getDeployTask(taskId: string) {
  return request<DeployTaskStatus>(`/_local/deploy/tasks/${taskId}`)
}

export async function getDeployConfig() {
  return request<DeployConfigSnapshot>('/_local/deploy/config')
}

export async function getLocalBootstrapStatus() {
  return request<LocalBootstrapStatus>('/_local/bootstrap/status')
}
