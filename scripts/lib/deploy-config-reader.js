const fs = require('node:fs')
const path = require('node:path')

const repoRoot = path.resolve(__dirname, '..', '..')
const localServerConfigPath = path.join(repoRoot, 'local-server', 'cloudbase.local.json')
const webAdminEnvPath = path.join(repoRoot, 'web-admin', '.env.production.local')
const defaultLoginKeyPath = path.join(repoRoot, 'cloudfunctions', 'modmin_auth', 'tcb_custom_login.json')

function fileExists(filePath) {
  return fs.existsSync(filePath)
}

function readJsonFile(filePath) {
  if (!fileExists(filePath)) return null
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch {
    return null
  }
}

function readEnvFile(filePath) {
  if (!fileExists(filePath)) return {}
  const content = fs.readFileSync(filePath, 'utf8')
  const result = {}
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index <= 0) continue
    const key = trimmed.slice(0, index).trim()
    const value = trimmed.slice(index + 1).trim()
    result[key] = value
  }
  return result
}

function maskValue(value, { keepStart = 3, keepEnd = 3 } = {}) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (raw.length <= keepStart + keepEnd) {
    return '*'.repeat(raw.length)
  }
  return `${raw.slice(0, keepStart)}***${raw.slice(-keepEnd)}`
}

function maskUrl(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  try {
    const url = new URL(raw)
    const pathName = url.pathname || ''
    const pathTail = pathName.split('/').filter(Boolean).slice(-1)[0] || ''
    return `${url.protocol}//${url.host}/***${pathTail ? `/${pathTail}` : ''}`
  } catch {
    return maskValue(raw, { keepStart: 6, keepEnd: 8 })
  }
}

function getDeployConfigSnapshot() {
  const localConfig = readJsonFile(localServerConfigPath)
  const webEnv = readEnvFile(webAdminEnvPath)
  const loginKeyExists = fileExists(defaultLoginKeyPath)

  return {
    detected: Boolean(localConfig || Object.keys(webEnv).length > 0 || loginKeyExists),
    values: {
      envId: localConfig?.envId || webEnv.VITE_MODMIN_ENV_ID || '',
      region: webEnv.VITE_MODMIN_REGION || 'ap-shanghai',
      secretId: localConfig?.secretId || '',
      secretKey: localConfig?.secretKey || '',
      jwtSecret: localConfig?.jwtSecret || '',
      authHttpUrl: webEnv.VITE_MODMIN_AUTH_LOGIN_URL || '',
      loginKeyPath: loginKeyExists ? 'cloudfunctions/modmin_auth/tcb_custom_login.json' : '',
      basePath: webEnv.VITE_BASE_PATH || '/',
      adminUserName: 'admin',
      adminNickName: '系统管理员',
      overwriteAdmin: false,
      cleanHosting: false,
    },
    secretsDetected: {
      envId: Boolean(localConfig?.envId || webEnv.VITE_MODMIN_ENV_ID),
      secretId: Boolean(localConfig?.secretId),
      secretKey: Boolean(localConfig?.secretKey),
      jwtSecret: Boolean(localConfig?.jwtSecret),
      authHttpUrl: Boolean(webEnv.VITE_MODMIN_AUTH_LOGIN_URL),
    },
    masked: {
      envId: maskValue(localConfig?.envId || webEnv.VITE_MODMIN_ENV_ID || '', { keepStart: 4, keepEnd: 4 }),
      secretId: maskValue(localConfig?.secretId || '', { keepStart: 4, keepEnd: 4 }),
      secretKey: maskValue(localConfig?.secretKey || '', { keepStart: 4, keepEnd: 4 }),
      jwtSecret: maskValue(localConfig?.jwtSecret || '', { keepStart: 4, keepEnd: 4 }),
      authHttpUrl: maskUrl(webEnv.VITE_MODMIN_AUTH_LOGIN_URL || ''),
    },
    sources: {
      localServerConfig: fileExists(localServerConfigPath) ? 'local-server/cloudbase.local.json' : '',
      webEnv: fileExists(webAdminEnvPath) ? 'web-admin/.env.production.local' : '',
      loginKey: loginKeyExists ? 'cloudfunctions/modmin_auth/tcb_custom_login.json' : '',
    },
  }
}

module.exports = {
  getDeployConfigSnapshot,
}
