import './setup-env.js'
import Module from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { cloudbaseMock, __resetDb, __getDocs } from './cloudbase-mock.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '../..')

// 拦截 require('@cloudbase/node-sdk')：返回内存 mock；其他依赖原样放行。
const originalResolve = Module._resolveFilename
Module._resolveFilename = function patchedResolve(request, parent, ...rest) {
  if (request === '@cloudbase/node-sdk') {
    return '@cloudbase/node-sdk/mocked'
  }
  return originalResolve.call(this, request, parent, ...rest)
}

const originalLoad = Module._load
Module._load = function patchedLoad(request, parent, ...rest) {
  if (request === '@cloudbase/node-sdk' || request.endsWith('@cloudbase/node-sdk/mocked')) {
    return cloudbaseMock
  }
  return originalLoad.call(this, request, parent, ...rest)
}

const FUNCTION_ENTRIES = {
  modmin_auth: 'cloudfunctions/modmin_auth/src/index.js',
  modmin_audit: 'cloudfunctions/modmin_audit/src/index.js',
  modmin_system: 'cloudfunctions/modmin_system/src/index.js',
  modmin_crud: 'cloudfunctions/modmin_crud/src/index.js',
  modmin_schema: 'cloudfunctions/modmin_schema/src/index.js',
  modmin_runtime: 'cloudfunctions/modmin_runtime/src/index.js',
  modmin_webhook: 'cloudfunctions/modmin_webhook/src/index.js',
}

// 每次调用都强制清掉云函数模块缓存，避免模块顶层闭包共享 db 引用。
export function loadCloudFunction(name) {
  const entryRel = FUNCTION_ENTRIES[name]
  if (!entryRel) throw new Error(`unknown cloud function: ${name}`)
  const entry = path.resolve(repoRoot, entryRel)
  delete require.cache[entry]
  const require_ = Module.createRequire(import.meta.url)
  return require_(entry)
}

export function resetDb(seed) { __resetDb(seed) }
export function getDocs(collectionName) { return __getDocs(collectionName) }
