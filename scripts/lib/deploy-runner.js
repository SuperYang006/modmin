const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const {
  buildCloudbaserc,
  writeCloudbasercFile,
  getDefaultCloudbasercPath,
  FUNCTION_NAMES,
} = require('./build-cloudbaserc.js')
const {
  syncCloudfunctionShared,
  deployFunctions,
} = require('./functions.js')
const {
  buildWeb,
  deployWebHosting,
  getHostingDomain,
} = require('./web.js')
const {
  COLLECTION_NAMES,
  createCloudbaseAdmin,
  ensureCollections,
  ensureAdminUser,
  verifyCollectionsExist,
  verifyAdminUserExists,
} = require('./cloudbase.js')
const { ensureBuiltinRoles } = require('./system-roles.js')

const repoRoot = path.resolve(__dirname, '..', '..')
const localServerConfigPath = path.join(repoRoot, 'local-server', 'cloudbase.local.json')
const webAdminEnvPath = path.join(repoRoot, 'web-admin', '.env.production.local')
const defaultLoginKeyPath = path.join(repoRoot, 'cloudfunctions', 'modmin_auth', 'tcb_custom_login.json')

function fileExists(filePath) {
  return fs.existsSync(filePath)
}

function resolveRepoPath(filePath) {
  const raw = String(filePath || '').trim()
  if (!raw) {
    return ''
  }
  return path.isAbsolute(raw) ? raw : path.resolve(repoRoot, raw)
}

function ensureFileExists(filePath, label) {
  if (!fileExists(filePath)) {
    throw new Error(`${label} 不存在：${filePath}`)
  }
}

function normalizeBasePath(input) {
  const raw = String(input || '').trim()
  if (!raw || raw === '/') {
    return '/'
  }
  const normalized = raw.replace(/^\/+|\/+$/g, '')
  return `/${normalized}/`
}

function maskSecret(input) {
  if (!input) return ''
  if (input.length <= 8) return '*'.repeat(input.length)
  return `${input.slice(0, 4)}****${input.slice(-4)}`
}

function copyLoginKeyToDefault(filePath) {
  if (path.resolve(filePath) === path.resolve(defaultLoginKeyPath)) {
    return false
  }

  fs.mkdirSync(path.dirname(defaultLoginKeyPath), { recursive: true })
  fs.copyFileSync(filePath, defaultLoginKeyPath)
  return true
}

function readLoginKey(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8')
  const parsed = JSON.parse(raw)
  if (!parsed?.env_id) {
    throw new Error('自定义登录私钥文件缺少 env_id 字段')
  }
  return parsed
}

function writeWebAdminEnv({ envId, region, authHttpUrl, basePath }) {
  const content = [
    'VITE_API_MODE=tcb',
    `VITE_MODMIN_ENV_ID=${envId}`,
    `VITE_MODMIN_REGION=${region}`,
    'VITE_MODMIN_FUNCTION_PREFIX=modmin_',
    `VITE_MODMIN_AUTH_LOGIN_URL=${authHttpUrl}`,
    `VITE_BASE_PATH=${basePath}`,
    '',
  ].join('\n')
  fs.writeFileSync(webAdminEnvPath, content, 'utf8')
}

function writeLocalServerConfig({ envId, secretId, secretKey, jwtSecret }) {
  const content = {
    envId,
    secretId,
    secretKey,
    jwtSecret,
  }
  fs.writeFileSync(localServerConfigPath, JSON.stringify(content, null, 2) + '\n', 'utf8')
}

function ensureTcbLogin() {
  const result = spawnSync('npx', ['tcb', 'env', 'list'], {
    cwd: repoRoot,
    encoding: 'utf8',
  })

  if (result.status !== 0) {
    const tail = String(result.stderr || result.stdout || '').trim()
    throw new Error(`CloudBase CLI 未登录或不可用，请先执行 npm run tcb:login。\n${tail}`)
  }
}

function listDeployedFunctions(envId) {
  const result = spawnSync('npx', ['tcb', 'fn', 'list', '-e', envId], {
    cwd: repoRoot,
    encoding: 'utf8',
  })

  if (result.status !== 0) {
    const tail = String(result.stderr || result.stdout || '').trim()
    throw new Error(`读取云函数列表失败。\n${tail}`)
  }

  const output = result.stdout || ''
  const found = new Set()
  for (const name of FUNCTION_NAMES) {
    if (output.includes(name)) {
      found.add(name)
    }
  }
  return found
}

async function verifyInstall(authHttpUrl) {
  const response = await fetch(authHttpUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      action: 'mystery',
      data: {},
      meta: { requestId: `setup_verify_${Date.now()}` },
    }),
  })

  if (!response.ok) {
    throw new Error(`modmin_auth HTTP 触发器不可访问：HTTP ${response.status}`)
  }

  const result = await response.json()
  if (!result || (result.code !== 40002 && result.code !== 40001)) {
    throw new Error(`modmin_auth HTTP 触发器返回异常：${JSON.stringify(result)}`)
  }
}

function buildAdminAccessUrl({ envId, basePath }) {
  const domain = getHostingDomain(envId, repoRoot)
  if (!domain) {
    return ''
  }

  if (basePath === '/') {
    return `${domain}/#/login`
  }

  return `${domain}${basePath}#/login`
}

function createLogger(onLog) {
  function log(level, message) {
    onLog({ level, message, time: Date.now() })
  }

  return {
    info(message) {
      log('info', message)
    },
    success(message) {
      log('success', message)
    },
    warn(message) {
      log('warning', message)
    },
    error(message) {
      log('error', message)
    },
    childLogger() {
      return {
        log(message) {
          log('info', String(message))
        },
        warn(message) {
          log('warning', String(message))
        },
        error(message) {
          log('error', String(message))
        },
      }
    },
  }
}

function validateOptions(options) {
  const requiredFields = [
    ['envId', 'CloudBase 环境 ID'],
    ['region', 'CloudBase 地域'],
    ['secretId', '腾讯云 SecretId'],
    ['secretKey', '腾讯云 SecretKey'],
    ['jwtSecret', 'JWT 密钥'],
    ['authHttpUrl', 'modmin_auth HTTP 地址'],
    ['loginKeyPath', '自定义登录私钥路径'],
    ['adminUserName', '管理员账号'],
  ]

  for (const [key, label] of requiredFields) {
    if (!String(options[key] || '').trim()) {
      throw new Error(`缺少必填项：${label}`)
    }
  }

  if (String(options.jwtSecret).trim().length < 32) {
    throw new Error('JWT 密钥长度不足 32 字符')
  }

  return {
    ...options,
    envId: String(options.envId).trim(),
    region: String(options.region).trim(),
    secretId: String(options.secretId).trim(),
    secretKey: String(options.secretKey).trim(),
    jwtSecret: String(options.jwtSecret).trim(),
    authHttpUrl: String(options.authHttpUrl).trim(),
    loginKeyPath: resolveRepoPath(options.loginKeyPath),
    basePath: normalizeBasePath(options.basePath),
    adminUserName: String(options.adminUserName).trim(),
    adminPassword: String(options.adminPassword),
    adminNickName: String(options.adminNickName || '系统管理员').trim() || '系统管理员',
    overwriteAdmin: options.overwriteAdmin !== false,
    cleanHosting: options.cleanHosting === true,
  }
}

async function runDeployment(rawOptions, hooks = {}) {
  const options = validateOptions(rawOptions)
  const onLog = typeof hooks.onLog === 'function' ? hooks.onLog : () => {}
  const logger = createLogger(onLog)
  const consoleLike = logger.childLogger()

  logger.info(`开始部署到环境 ${options.envId}`)
  logger.info(`JWT 密钥：${maskSecret(options.jwtSecret)}`)

  ensureTcbLogin()
  logger.success('CloudBase CLI 已登录')

  ensureFileExists(options.loginKeyPath, '自定义登录私钥文件')
  const loginKey = readLoginKey(options.loginKeyPath)
  if (String(loginKey.env_id).trim() !== options.envId) {
    throw new Error(`私钥文件中的 env_id=${loginKey.env_id} 与输入的 envId=${options.envId} 不一致`)
  }
  const copiedLoginKey = copyLoginKeyToDefault(options.loginKeyPath)
  logger.success(`已读取私钥文件：${path.relative(repoRoot, options.loginKeyPath)}`)
  if (copiedLoginKey) {
    logger.success(`已同步私钥到 ${path.relative(repoRoot, defaultLoginKeyPath)}`)
  }

  writeWebAdminEnv({
    envId: options.envId,
    region: options.region,
    authHttpUrl: options.authHttpUrl,
    basePath: options.basePath,
  })
  logger.success(`已写入 ${path.relative(repoRoot, webAdminEnvPath)}`)

  writeLocalServerConfig({
    envId: options.envId,
    secretId: options.secretId,
    secretKey: options.secretKey,
    jwtSecret: options.jwtSecret,
  })
  logger.success(`已写入 ${path.relative(repoRoot, localServerConfigPath)}`)

  const adminApp = createCloudbaseAdmin({
    envId: options.envId,
    secretId: options.secretId,
    secretKey: options.secretKey,
  })
  const db = adminApp.database()

  logger.info('创建 / 校验数据库集合')
  await ensureCollections(db, consoleLike)
  logger.success(`已处理 ${COLLECTION_NAMES.length} 个关键集合`)

  const adminExists = await verifyAdminUserExists(db, options.adminUserName)
  if (options.overwriteAdmin && !options.adminPassword.trim()) {
    throw new Error(`管理员账号 ${options.adminUserName} 已存在且将被覆盖，请填写管理员密码`)
  }
  if (!adminExists && !options.adminPassword.trim()) {
    throw new Error(`管理员账号 ${options.adminUserName} 不存在，首次创建时必须填写管理员密码`)
  }

  logger.info('同步云函数 shared 模块')
  const syncResult = syncCloudfunctionShared(repoRoot)
  logger.success(`已同步 shared 到 ${syncResult.functionCount} 个云函数目录`)

  const cloudbaserc = buildCloudbaserc({
    envId: options.envId,
    jwtSecret: options.jwtSecret,
    collectionPrefix: 'modmin_',
  })
  writeCloudbasercFile(cloudbaserc, getDefaultCloudbasercPath(repoRoot))
  logger.success('已生成 cloudbaserc.json')

  logger.info('开始部署云函数')
  await deployFunctions({
    repoRoot,
    envId: options.envId,
    jwtSecret: options.jwtSecret,
    logger: consoleLike,
  })
  logger.success('云函数部署完成')

  logger.info('开始构建前端')
  await buildWeb(repoRoot)
  logger.success('前端构建完成')

  if (options.cleanHosting && options.basePath !== '/') {
    logger.warn('当前程序化部署暂未实现静态托管目录清理，已跳过 cleanHosting')
  }

  logger.info(`开始部署前端到 ${options.basePath}`)
  await deployWebHosting({
    repoRoot,
    envId: options.envId,
    cloudPath: options.basePath,
    logger: consoleLike,
  })
  logger.success('前端部署完成')

  logger.info('创建或更新初始管理员')
  await ensureAdminUser(db, {
    userName: options.adminUserName,
    password: options.adminPassword,
    nickName: options.adminNickName,
    overwriteExisting: options.overwriteAdmin,
  }, consoleLike)
  logger.success(`管理员账号已处理：${options.adminUserName}`)

  logger.info('初始化内置角色')
  await ensureBuiltinRoles(db, { userId: 'setup', userName: 'setup' }, consoleLike)
  logger.success('内置角色初始化完成')

  logger.info('执行最小验收')
  const deployedFunctions = listDeployedFunctions(options.envId)
  const missingFunctions = FUNCTION_NAMES.filter((name) => !deployedFunctions.has(name))
  if (missingFunctions.length > 0) {
    throw new Error(`以下云函数未在环境 ${options.envId} 中识别到：${missingFunctions.join(', ')}`)
  }

  const missingCollections = await verifyCollectionsExist(db)
  if (missingCollections.length > 0) {
    throw new Error(`以下集合未创建成功：${missingCollections.join(', ')}`)
  }

  const adminStillExists = await verifyAdminUserExists(db, options.adminUserName)
  if (!adminStillExists) {
    throw new Error(`超管账号校验失败：未找到 ${options.adminUserName}`)
  }

  await verifyInstall(options.authHttpUrl)
  logger.success('modmin_auth HTTP 触发器可访问')

  const adminAccessUrl = buildAdminAccessUrl({
    envId: options.envId,
    basePath: options.basePath,
  })

  return {
    envId: options.envId,
    basePath: options.basePath,
    adminUserName: options.adminUserName,
    adminAccessUrl,
  }
}

module.exports = {
  runDeployment,
  normalizeBasePath,
}
