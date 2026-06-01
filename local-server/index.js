const path = require('path')
const fs = require('fs')
const Module = require('module')

// 让云函数代码能找到安装在 local-server/node_modules 里的依赖
process.env.NODE_PATH = path.resolve(__dirname, 'node_modules')
require('module').Module._initPaths()

const express = require('express')
const multer = require('multer')
const { runDeployment, normalizeBasePath } = require('../scripts/lib/deploy-runner.js')
const { getDeployConfigSnapshot } = require('../scripts/lib/deploy-config-reader.js')

// 读取本地开发凭据（SecretId/SecretKey + EnvId）
const configPath = path.resolve(__dirname, 'cloudbase.local.json')
if (!fs.existsSync(configPath)) {
  console.error('\n[错误] 缺少本地凭据文件：local-server/cloudbase.local.json')
  console.error('请参考 local-server/cloudbase.local.example.json 创建该文件\n')
  process.exit(1)
}
const localConfig = require('./cloudbase.local.json')

if (!localConfig.jwtSecret || localConfig.jwtSecret.length < 32) {
  console.error('\n[错误] cloudbase.local.json 缺少 jwtSecret 字段，或长度不足 32 字符')
  console.error('请在该文件中加入 "jwtSecret": "<至少 32 字符的随机串>"，与生产环境保持独立\n')
  process.exit(1)
}

// 将本地 jwtSecret 注入到 process.env，供云函数顶层加载时校验通过
process.env.MODMIN_JWT_SECRET = localConfig.jwtSecret

// 读取自定义登录私钥（modmin_auth 签发 ticket 时需要）
const authCredentials = require('../cloudfunctions/modmin_auth/tcb_custom_login.json')

// Patch SDK init：将 SYMBOL_CURRENT_ENV（仅云端有效）替换为本地显式凭据
const cloudbaseSDK = require('@cloudbase/node-sdk')
const originalInit = cloudbaseSDK.init.bind(cloudbaseSDK)
cloudbaseSDK.init = function (options) {
  if (options && options.env === cloudbaseSDK.SYMBOL_CURRENT_ENV) {
    return originalInit({
      secretId: localConfig.secretId,
      secretKey: localConfig.secretKey,
      env: localConfig.envId,
    })
  }
  // modmin_auth 使用自定义登录私钥初始化，直接透传
  return originalInit(options)
}

// 强制让后续所有 require('@cloudbase/node-sdk') 都返回同一个已 patch 的实例，
// 避免根目录 node_modules 与 local-server/node_modules 各自加载一份导致 patch 失效。
const originalResolve = Module._resolveFilename
Module._resolveFilename = function patchedResolve(request, parent, ...rest) {
  if (request === '@cloudbase/node-sdk') {
    return '@cloudbase/node-sdk/patched-singleton'
  }
  return originalResolve.call(this, request, parent, ...rest)
}

const originalLoad = Module._load
Module._load = function patchedLoad(request, parent, ...rest) {
  if (request === '@cloudbase/node-sdk' || request.endsWith('@cloudbase/node-sdk/patched-singleton')) {
    return cloudbaseSDK
  }
  return originalLoad.call(this, request, parent, ...rest)
}

// 共享的 storage 操作实例（上传/获取临时链接用）
const storageApp = originalInit({
  secretId: localConfig.secretId,
  secretKey: localConfig.secretKey,
  env: localConfig.envId,
})

// 加载云函数（模块顶层 init 调用此时已被 patch 拦截）
const functions = {
  modmin_auth: require('../cloudfunctions/modmin_auth/src/index.js'),
  modmin_audit: require('../cloudfunctions/modmin_audit/src/index.js'),
  modmin_crud: require('../cloudfunctions/modmin_crud/src/index.js'),
  modmin_import_export: require('../cloudfunctions/modmin_import_export/src/index.js'),
  modmin_runtime: require('../cloudfunctions/modmin_runtime/src/index.js'),
  modmin_schema: require('../cloudfunctions/modmin_schema/src/index.js'),
  modmin_system: require('../cloudfunctions/modmin_system/src/index.js'),
  modmin_webhook: require('../cloudfunctions/modmin_webhook/src/index.js'),
}

const app = express()
app.use(express.json())
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

const deploymentTasks = new Map()

function createApiResponse(code, message, data) {
  return { code, message, data }
}

function toErrorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}

function sanitizeDeployPayload(payload) {
  const source = payload || {}
  const existingConfig = getDeployConfigSnapshot()
  return {
    envId: String(source.envId || existingConfig.values.envId || '').trim(),
    region: String(source.region || '').trim(),
    secretId: String(source.secretId || existingConfig.values.secretId || '').trim(),
    secretKey: String(source.secretKey || existingConfig.values.secretKey || '').trim(),
    jwtSecret: String(source.jwtSecret || '').trim(),
    authHttpUrl: String(source.authHttpUrl || existingConfig.values.authHttpUrl || '').trim(),
    loginKeyPath: String(source.loginKeyPath || '').trim(),
    basePath: normalizeBasePath(source.basePath),
    adminUserName: String(source.adminUserName || '').trim(),
    adminPassword: String(source.adminPassword || ''),
    adminNickName: String(source.adminNickName || '').trim(),
    overwriteAdmin: source.overwriteAdmin !== false,
    cleanHosting: source.cleanHosting === true,
  }
}

async function getLocalBootstrapStatus() {
  const existingConfig = getDeployConfigSnapshot()
  const status = {
    envId: existingConfig.values.envId || localConfig.envId || '',
    configDetected: existingConfig.detected,
    authHttpUrlConfigured: Boolean(existingConfig.values.authHttpUrl),
    collectionReady: false,
    adminUserExists: false,
    adminUserName: existingConfig.values.adminUserName || 'admin',
    stage: 'missing_collections',
  }

  try {
    const result = await storageApp.database().collection('modmin_admin_users').where({ roleCode: 'role_super_admin' }).limit(1).get()
    const adminUser = result.data?.[0]
    status.collectionReady = true
    status.adminUserExists = Boolean(adminUser?._id)
    status.adminUserName = adminUser?.userName || status.adminUserName
    status.stage = status.adminUserExists ? 'ready' : 'missing_admin'
    return status
  } catch (error) {
    const message = toErrorMessage(error)
    if (/Table not exist|Db or Table not exist|COLLECTION_NOT_EXIST|ResourceNotFound/i.test(message)) {
      return status
    }
    throw error
  }
}

app.get('/_local/deploy/config', (_req, res) => {
  return res.json(createApiResponse(0, 'ok', getDeployConfigSnapshot()))
})

app.get('/_local/bootstrap/status', async (_req, res) => {
  const status = await getLocalBootstrapStatus()
  return res.json(createApiResponse(0, 'ok', status))
})

function createDeploymentTask(payload) {
  const taskId = `deploy_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const task = {
    taskId,
    status: 'queued',
    payload,
    logs: [],
    result: null,
    error: '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    startedAt: 0,
    finishedAt: 0,
  }
  deploymentTasks.set(taskId, task)
  return task
}

function appendTaskLog(task, level, message) {
  task.logs.push({
    id: `${task.taskId}_${task.logs.length + 1}`,
    level,
    message,
    time: Date.now(),
  })
  if (task.logs.length > 400) {
    task.logs = task.logs.slice(-400)
  }
  task.updatedAt = Date.now()
}

async function startDeploymentTask(task) {
  task.status = 'running'
  task.startedAt = Date.now()
  task.updatedAt = Date.now()

  try {
    const result = await runDeployment(task.payload, {
      onLog(entry) {
        appendTaskLog(task, entry.level, entry.message)
      },
    })
    task.status = 'success'
    task.result = result
    task.finishedAt = Date.now()
    task.updatedAt = Date.now()
  } catch (error) {
    task.status = 'error'
    task.error = toErrorMessage(error)
    task.finishedAt = Date.now()
    task.updatedAt = Date.now()
    appendTaskLog(task, 'error', task.error)
  }
}

app.get('/_local/deploy/tasks/:taskId', (req, res) => {
  const task = deploymentTasks.get(req.params.taskId)
  if (!task) {
    return res.json(createApiResponse(40404, '部署任务不存在', null))
  }

  return res.json(createApiResponse(0, 'ok', {
    taskId: task.taskId,
    status: task.status,
    logs: task.logs,
    result: task.result,
    error: task.error,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    startedAt: task.startedAt,
    finishedAt: task.finishedAt,
  }))
})

app.post('/_local/deploy/tasks', async (req, res) => {
  const runningTask = Array.from(deploymentTasks.values()).find((task) => task.status === 'queued' || task.status === 'running')
  if (runningTask) {
    return res.json(createApiResponse(40901, '已有部署任务正在执行，请等待当前任务完成', {
      taskId: runningTask.taskId,
      status: runningTask.status,
    }))
  }

  const payload = sanitizeDeployPayload(req.body)
  const task = createDeploymentTask(payload)
  appendTaskLog(task, 'info', '部署任务已创建，准备开始执行')

  void startDeploymentTask(task)

  return res.json(createApiResponse(0, 'ok', {
    taskId: task.taskId,
    status: task.status,
  }))
})

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } })

app.post('/modmin_upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.json({ code: 40001, message: '缺少文件', data: null })
  }

  const cloudPath = req.body.cloudPath
  if (!cloudPath) {
    return res.json({ code: 40001, message: '缺少 cloudPath', data: null })
  }

  try {
    const result = await storageApp.uploadFile({
      cloudPath,
      fileContent: req.file.buffer,
    })

    const fileID = result?.fileID || result
    if (!fileID || typeof fileID !== 'string') {
      return res.json({ code: 50001, message: '上传失败', data: null })
    }

    res.json({
      code: 0,
      message: 'ok',
      data: {
        fileID,
        path: cloudPath,
        fullPath: fileID,
        name: Buffer.from(req.file.originalname, 'latin1').toString('utf8'),
        contentType: req.file.mimetype || '',
        size: req.file.size,
      },
    })
  } catch (error) {
    console.error('[modmin_upload] error:', error)
    res.json({ code: 50001, message: error instanceof Error ? error.message : '上传失败', data: null })
  }
})

app.post('/modmin_get_temp_url', async (req, res) => {
  const fileList = req.body?.fileList
  if (!Array.isArray(fileList) || fileList.length === 0) {
    return res.json({ code: 40001, message: '缺少 fileList', data: null })
  }

  try {
    const result = await storageApp.getTempFileURL({
      fileList: fileList.map((item) => ({
        fileID: typeof item === 'string' ? item : item.fileID,
        maxAge: item.maxAge ?? 600,
      })),
    })

    res.json({ code: 0, message: 'ok', data: { fileList: result?.fileList || [] } })
  } catch (error) {
    console.error('[modmin_get_temp_url] error:', error)
    res.json({ code: 50001, message: error instanceof Error ? error.message : '获取临时链接失败', data: null })
  }
})

app.post('/:functionName', async (req, res) => {
  const { functionName } = req.params
  const fn = functions[functionName]

  if (!fn || typeof fn.main !== 'function') {
    return res.json({ code: 40404, message: `function not found: ${functionName}`, data: null })
  }

  try {
    const forwarded = String(req.headers['x-forwarded-for'] || '').split(',').map((item) => item.trim()).filter(Boolean)[0] || ''
    const liveClientIp = forwarded || req.ip || ''
    const liveUserAgent = String(req.headers['user-agent'] || '')
    const body = {
      ...req.body,
      headers: req.headers,
      context: {
        ...(req.body?.context || {}),
        clientIp: liveClientIp || req.body?.context?.clientIp || '',
        userAgent: liveUserAgent || req.body?.context?.userAgent || '',
      },
    }
    const result = await fn.main(body)
    res.json(result)
  } catch (error) {
    console.error(`[${functionName}] error:`, error)
    res.json({ code: 50001, message: error instanceof Error ? error.message : String(error), data: null })
  }
})

const PORT = process.env.PORT || 3100
app.listen(PORT, () => {
  console.log(`\nLocal cloud functions server → http://localhost:${PORT}`)
  console.log(`Functions: ${Object.keys(functions).join(', ')}\n`)
})
