#!/usr/bin/env node

const { spawn, spawnSync } = require('node:child_process')
const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const {
  buildCloudbaserc,
  writeCloudbasercFile,
  getDefaultCloudbasercPath,
  FUNCTION_NAMES,
} = require('./lib/build-cloudbaserc.js')
const {
  run,
  syncCloudfunctionShared,
  deployFunctions,
} = require('./lib/functions.js')
const {
  buildWeb,
  deployWebHosting,
  getHostingDomain,
} = require('./lib/web.js')
const {
  COLLECTION_NAMES,
  createCloudbaseAdmin,
  ensureCollections,
  ensureAdminUser,
  verifyCollectionsExist,
  verifyAdminUserExists,
} = require('./lib/cloudbase.js')
const { ensureBuiltinRoles } = require('./lib/system-roles.js')
const { createSetupUI } = require('./lib/setup-ui.js')

const repoRoot = path.resolve(__dirname, '..')
const localServerConfigPath = path.join(repoRoot, 'local-server', 'cloudbase.local.json')
const webAdminEnvPath = path.join(repoRoot, 'web-admin', '.env.production.local')
const defaultLoginKeyPath = path.join(repoRoot, 'cloudfunctions', 'modmin_auth', 'tcb_custom_login.json')
const cloudbasercPath = path.join(repoRoot, 'cloudbaserc.json')

process.on('SIGINT', () => {
  console.log('\n已取消')
  process.exit(130)
})

function maskSecret(input) {
  if (!input) return ''
  if (input.length <= 8) return '*'.repeat(input.length)
  return `${input.slice(0, 4)}****${input.slice(-4)}`
}

function ensureFileExists(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} 不存在：${filePath}`)
  }
}

function fileExists(filePath) {
  return fs.existsSync(filePath)
}

function readExistingLocalServerConfig() {
  if (!fileExists(localServerConfigPath)) {
    return null
  }

  try {
    return JSON.parse(fs.readFileSync(localServerConfigPath, 'utf8'))
  } catch {
    return null
  }
}

function readExistingCloudbaserc() {
  if (!fileExists(cloudbasercPath)) {
    return null
  }

  try {
    return JSON.parse(fs.readFileSync(cloudbasercPath, 'utf8'))
  } catch {
    return null
  }
}

function readExistingWebAdminEnv() {
  if (!fileExists(webAdminEnvPath)) {
    return {}
  }

  const content = fs.readFileSync(webAdminEnvPath, 'utf8')
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

function normalizeBasePath(input) {
  const raw = String(input || '').trim()
  if (!raw || raw === '/') {
    return '/'
  }
  const normalized = raw.replace(/^\/+|\/+$/g, '')
  return `/${normalized}/`
}

function copyLoginKeyToDefault(filePath) {
  if (path.resolve(filePath) === path.resolve(defaultLoginKeyPath)) {
    return
  }

  fs.mkdirSync(path.dirname(defaultLoginKeyPath), { recursive: true })
  fs.copyFileSync(filePath, defaultLoginKeyPath)
  // 这里在 setup 流程中通过 UI 输出成功提示，函数本身只做动作
}

function readLoginKey(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8')
  const parsed = JSON.parse(raw)
  if (!parsed?.env_id) {
    throw new Error('自定义登录私钥文件缺少 env_id 字段')
  }
  return parsed
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

async function resolveOverwrite(rl, label, targetPath) {
  if (!fileExists(targetPath)) {
    return true
  }

  const reuse = await rl.confirmReuse(`${label} 已存在`, {
    currentValue: path.relative(repoRoot, targetPath),
    description: '检测到已有本地配置文件。',
    defaultYes: true,
  })
  return !reuse
}

async function resolveJwtSecret(ui) {
  const existingCloudbaserc = readExistingCloudbaserc()
  const existingCloudSecret = typeof existingCloudbaserc?.functions?.[0]?.envVariables?.MODMIN_JWT_SECRET === 'string'
    ? existingCloudbaserc.functions[0].envVariables.MODMIN_JWT_SECRET.trim()
    : ''
  const existingConfig = readExistingLocalServerConfig()
  const existingLocalSecret = typeof existingConfig?.jwtSecret === 'string' ? existingConfig.jwtSecret.trim() : ''
  const existingSecret = existingCloudSecret || existingLocalSecret

  if (existingSecret && existingSecret.length >= 32) {
    console.log('')
    ui.kv('JWT 密钥', maskSecret(existingSecret))
    ui.paragraph([
      '检测到已有 JWT 密钥。',
      '回车或输入 y 复用，输入 n 将重新生成新密钥。',
    ])
    const reuse = await ui.confirm('是否复用当前 JWT 密钥', { defaultYes: true })
    if (reuse) {
      ui.success(`复用已有 JWT 密钥：${maskSecret(existingSecret)}`)
      return existingSecret
    }

    ui.warn('重新生成 JWT 密钥会使当前所有已登录用户立即失效')
  }

  const nextSecret = crypto.randomBytes(32).toString('hex')
  ui.success(`已生成新的 JWT 密钥：${maskSecret(nextSecret)}`)
  return nextSecret
}

async function resolveSecretKey(ui, existingValue) {
  if (!existingValue) {
    return ui.prompt('腾讯云 SecretKey', { secret: true })
  }

  return ui.promptWithReuse('腾讯云 SecretKey', {
    existingValue,
    secret: true,
    formatter: (value) => maskSecret(value),
  })
}

async function resolvePromptWithExisting(ui, label, existingValue, fallback = '') {
  return ui.promptWithReuse(label, {
    existingValue,
    defaultValue: fallback,
  })
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

async function confirmDeploymentPlan(ui, summary) {
  ui.section('[执行前总览]')
  ui.card('部署计划总览', [
    `CloudBase 环境 ID   ${summary.envId}`,
    `地域                ${summary.region}`,
    `前端部署目录        ${summary.basePath}`,
    `JWT 密钥            ${summary.jwtSecretMode}`,
    `自定义登录私钥      ${summary.loginKeyMode}`,
    `前端生产配置        ${summary.webEnvMode}`,
    `本地开发配置        ${summary.localConfigMode}`,
    `管理员账号          ${summary.adminUserName}`,
  ])
  const confirmed = await ui.confirm('确认按以上配置开始执行部署', { defaultYes: true })
  return confirmed
}

async function main() {
  const ui = createSetupUI()
  ui.header('Modmin 一键部署向导')

  try {
    ui.section('[1/8] 基础配置')
    const existingConfig = readExistingLocalServerConfig()
    const existingWebEnv = readExistingWebAdminEnv()
    const envId = await resolvePromptWithExisting(ui, 'CloudBase 环境 ID (envId)', existingConfig?.envId || existingWebEnv?.VITE_MODMIN_ENV_ID || '', '')
    const region = await resolvePromptWithExisting(ui, '环境所在地域', existingWebEnv?.VITE_MODMIN_REGION || '', 'ap-shanghai')
    const secretId = await resolvePromptWithExisting(ui, '腾讯云 SecretId', existingConfig?.secretId || '', '')
    const secretKey = await resolveSecretKey(ui, typeof existingConfig?.secretKey === 'string' ? existingConfig.secretKey : '')
    const jwtSecret = await resolveJwtSecret(ui)

    ui.info('检查 CloudBase CLI 登录状态')
    ensureTcbLogin()
    ui.success('CloudBase CLI 已登录')

    ui.section('[2/8] 自定义登录私钥')
    ui.paragraph([
      '请先前往 CloudBase 控制台下载私钥文件，放到项目中后继续。',
      '控制台路径：用户管理 -> 登录方式 -> 自定义登录 -> 下载私钥',
    ])
    if (fileExists(defaultLoginKeyPath)) {
      ui.info(`默认私钥文件可复用：${path.relative(repoRoot, defaultLoginKeyPath)}`)
    }
    const loginKeyPath = await ui.promptWithReuse('私钥文件路径', {
      existingValue: fileExists(defaultLoginKeyPath) ? defaultLoginKeyPath : '',
      defaultValue: defaultLoginKeyPath,
    })
    ensureFileExists(loginKeyPath, '自定义登录私钥文件')
    const loginKey = readLoginKey(loginKeyPath)
    if (String(loginKey.env_id).trim() !== envId) {
      throw new Error(`私钥文件中的 env_id=${loginKey.env_id} 与输入的 envId=${envId} 不一致`)
    }
    copyLoginKeyToDefault(loginKeyPath)
    ui.success(`已找到私钥文件：${path.relative(repoRoot, loginKeyPath)}`)
    if (path.resolve(loginKeyPath) !== path.resolve(defaultLoginKeyPath)) {
      ui.success(`已复制私钥文件到 ${path.relative(repoRoot, defaultLoginKeyPath)}`)
    }

    ui.section('[3/8] 本地与前端配置写入')
    const authHttpUrl = await resolvePromptWithExisting(ui, 'modmin_auth HTTP 触发器地址', existingWebEnv?.VITE_MODMIN_AUTH_LOGIN_URL || '', '')
    const basePath = normalizeBasePath(await resolvePromptWithExisting(ui, '前端部署目录（根目录请填 /）', existingWebEnv?.VITE_BASE_PATH || '', '/'))
    const shouldRewriteWebEnv = await resolveOverwrite(ui, 'web-admin/.env.production.local', webAdminEnvPath)
    const shouldRewriteLocalConfig = await resolveOverwrite(ui, 'local-server/cloudbase.local.json', localServerConfigPath)
    if (shouldRewriteWebEnv) {
      writeWebAdminEnv({ envId, region, authHttpUrl, basePath })
      ui.success(`已写入 ${path.relative(repoRoot, webAdminEnvPath)}`)
    } else {
      ui.success(`复用已有 ${path.relative(repoRoot, webAdminEnvPath)}`)
    }
    if (shouldRewriteLocalConfig) {
      writeLocalServerConfig({ envId, secretId, secretKey, jwtSecret })
      ui.success(`已写入 ${path.relative(repoRoot, localServerConfigPath)}`)
    } else {
      ui.success(`复用已有 ${path.relative(repoRoot, localServerConfigPath)}`)
    }

    const existingAdminConfig = await (async () => {
      const adminApp = createCloudbaseAdmin({ envId, secretId, secretKey })
      const db = adminApp.database()
      const result = await db.collection('modmin_admin_users').where({ roleCode: 'role_super_admin' }).limit(1).get()
      return result.data?.[0] || null
    })()
    let shouldSetupAdmin = true
    if (existingAdminConfig) {
      const reuseAdmin = await ui.confirmReuse('检测到已有超级管理员', {
        currentValue: existingAdminConfig.userName || existingAdminConfig._id,
        description: '当前环境中已存在可复用的超级管理员账号。',
        defaultYes: true,
      })
      shouldSetupAdmin = !reuseAdmin
    }
    const adminUserName = shouldSetupAdmin
      ? await ui.prompt('管理员账号', { defaultValue: existingAdminConfig?.userName || 'admin' })
      : (existingAdminConfig?.userName || 'admin')
    const adminPassword = shouldSetupAdmin ? await ui.prompt('管理员密码', { secret: true }) : ''
    const adminNickName = shouldSetupAdmin
      ? await ui.prompt('管理员显示名', { defaultValue: existingAdminConfig?.nickName || '系统管理员' })
      : (existingAdminConfig?.nickName || '系统管理员')

    const confirmed = await confirmDeploymentPlan(ui, {
      envId,
      region,
      basePath,
      jwtSecretMode: readExistingCloudbaserc()?.functions?.[0]?.envVariables?.MODMIN_JWT_SECRET === jwtSecret ? `复用 ${maskSecret(jwtSecret)}` : `新生成 ${maskSecret(jwtSecret)}`,
      loginKeyMode: path.resolve(loginKeyPath) === path.resolve(defaultLoginKeyPath) ? '复用默认路径私钥' : `复制到默认路径 (${path.relative(repoRoot, defaultLoginKeyPath)})`,
      webEnvMode: shouldRewriteWebEnv ? '写入 / 覆盖' : '复用已有',
      localConfigMode: shouldRewriteLocalConfig ? '写入 / 覆盖' : '复用已有',
      adminUserName: shouldSetupAdmin ? `${adminUserName}（将进入维护）` : `${adminUserName}（复用已有）`,
    })
    if (!confirmed) {
      console.log('\n已取消')
      return
    }

    const adminApp = createCloudbaseAdmin({ envId, secretId, secretKey })
    const db = adminApp.database()

    ui.section('[4/8] 创建数据库集合')
    await ensureCollections(db, console)

    ui.section('[5/8] 部署云函数')
    const syncResult = syncCloudfunctionShared(repoRoot)
    ui.success(`已同步 shared 模块到 ${syncResult.functionCount} 个云函数目录`)
    const cloudbaserc = buildCloudbaserc({
      envId,
      jwtSecret,
      collectionPrefix: 'modmin_',
    })
    writeCloudbasercFile(cloudbaserc, getDefaultCloudbasercPath(repoRoot))
    ui.success('已生成 cloudbaserc.json')
    const fnActivity = ui.activity('正在部署云函数')
    try {
      await deployFunctions({
        repoRoot,
        envId,
        jwtSecret,
      })
      fnActivity.success()
    } catch (error) {
      fnActivity.fail()
      throw error
    }

    ui.section('[6/8] 部署前端')
    await buildWeb(repoRoot)
    await deployWebHosting({
      repoRoot,
      envId,
      cloudPath: basePath,
    })

    ui.section('[7/8] 创建初始管理员')
    if (shouldSetupAdmin) {
      const existingAdmin = await db.collection('modmin_admin_users').where({ userName: adminUserName }).limit(1).get()
      let overwriteExistingAdmin = true
      if (existingAdmin.data?.[0]?._id) {
        ui.warn(`检测到管理员账号已存在：${adminUserName}`)
        overwriteExistingAdmin = await ui.confirm(`管理员账号 ${adminUserName} 已存在，是否覆盖`, { defaultYes: false })
      }
      await ensureAdminUser(db, {
        userName: adminUserName,
        password: adminPassword,
        nickName: adminNickName,
        overwriteExisting: overwriteExistingAdmin,
      }, console)
    } else {
      ui.skip('跳过管理员账号创建/维护')
    }

    ui.info('初始化内置角色')
    await ensureBuiltinRoles(db, { userId: 'setup', userName: 'setup' }, console)

    ui.section('[8/8] 最小验收')
    const deployedFunctions = listDeployedFunctions(envId)
    const missingFunctions = FUNCTION_NAMES.filter((name) => !deployedFunctions.has(name))
    if (missingFunctions.length > 0) {
      throw new Error(`以下云函数未在环境 ${envId} 中识别到：${missingFunctions.join(', ')}`)
    }
    ui.success(`已识别 ${FUNCTION_NAMES.length} 个云函数`)

    const missingCollections = await verifyCollectionsExist(db)
    if (missingCollections.length > 0) {
      throw new Error(`以下集合未创建成功：${missingCollections.join(', ')}`)
    }
    ui.success(`已确认 ${COLLECTION_NAMES.length} 个关键集合存在`)

    if (shouldSetupAdmin) {
      const adminExists = await verifyAdminUserExists(db, adminUserName)
      if (!adminExists) {
        throw new Error(`超管账号校验失败：未找到 ${adminUserName}`)
      }
      ui.success(`已确认超管账号存在：${adminUserName}`)
    } else {
      ui.success(`复用已有管理员账号：${adminUserName}`)
    }

    await verifyInstall(authHttpUrl)
    ui.success('modmin_auth HTTP 触发器可访问')

    const adminAccessUrl = buildAdminAccessUrl({ envId, basePath })

    ui.footer([
      '✓ 全部完成！',
      `  envId: ${envId}`,
      `  JWT 密钥: ${maskSecret(jwtSecret)}（已写入本机配置与云函数环境）`,
      shouldSetupAdmin ? `  账号：${adminUserName}` : `  账号：复用已有 ${adminUserName}`,
      adminAccessUrl ? `  后台地址：${adminAccessUrl}` : '  后台地址：未能自动识别静态托管域名，请到 CloudBase 控制台查看',
      '',
      '  下一步：',
      '  1. 登录后台',
      '  2. 验证角色、审计日志与 Webhook 配置页面是否可正常访问',
      '  3. 如需 Webhook 自动投递，确认 modmin_webhook 定时触发器已部署成功',
    ])
  } finally {
    ui.close()
  }
}

main().catch((error) => {
  const ui = createSetupUI()
  ui.error(error instanceof Error ? error.message : String(error))
  ui.close()
  process.exit(1)
})
