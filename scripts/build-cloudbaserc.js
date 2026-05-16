#!/usr/bin/env node

const {
  buildCloudbaserc,
  writeCloudbasercFile,
  getDefaultCloudbasercPath,
  FUNCTION_NAMES,
} = require('./lib/build-cloudbaserc.js')

const ENV_ID = process.env.MODMIN_ENV_ID
const JWT_SECRET = process.env.MODMIN_JWT_SECRET
const COLLECTION_PREFIX = process.env.MODMIN_COLLECTION_PREFIX || 'modmin_'

if (!ENV_ID) {
  console.error('\n[错误] 缺少 MODMIN_ENV_ID 环境变量。')
  console.error('示例：MODMIN_ENV_ID=your-env-id MODMIN_JWT_SECRET=$(openssl rand -hex 32) npm run deploy:fn\n')
  process.exit(1)
}

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error('\n[错误] 缺少 MODMIN_JWT_SECRET 环境变量，或长度不足 32 字符。')
  console.error('示例：MODMIN_JWT_SECRET=$(openssl rand -hex 32) npm run deploy:fn\n')
  process.exit(1)
}

const config = buildCloudbaserc({
  envId: ENV_ID,
  jwtSecret: JWT_SECRET,
  collectionPrefix: COLLECTION_PREFIX,
})
const outPath = getDefaultCloudbasercPath(process.cwd())

writeCloudbasercFile(config, outPath)
console.log(`✓ 已生成 ${outPath}（${FUNCTION_NAMES.length} 个函数，envId=${ENV_ID}）`)
