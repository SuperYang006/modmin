const fs = require('node:fs')
const path = require('node:path')

const FUNCTION_NAMES = [
  'modmin_auth',
  'modmin_audit',
  'modmin_crud',
  'modmin_import_export',
  'modmin_runtime',
  'modmin_schema',
  'modmin_system',
  'modmin_webhook',
]

function buildCloudbaserc({ envId, jwtSecret, collectionPrefix = 'modmin_' }) {
  if (!envId) {
    throw new Error('缺少 envId')
  }

  if (!jwtSecret || jwtSecret.length < 32) {
    throw new Error('缺少 jwtSecret 或长度不足 32 字符')
  }

  const sharedEnv = {
    MODMIN_JWT_SECRET: jwtSecret,
    MODMIN_COLLECTION_PREFIX: collectionPrefix,
  }

  return {
    envId,
    version: '2.0',
    functionRoot: './cloudfunctions',
    functions: FUNCTION_NAMES.map((name) => ({
      name,
      timeout: name === 'modmin_webhook' ? 60 : 20,
      envVariables: { ...sharedEnv },
      runtime: 'Nodejs16.13',
      handler: 'index.main',
      installDependency: true,
      ...(name === 'modmin_webhook'
        ? {
            triggers: [
              {
                name: 'processPendingDeliveries',
                type: 'timer',
                config: '0 */1 * * * * *',
              },
            ],
          }
        : {}),
    })),
  }
}

function writeCloudbasercFile(config, outPath) {
  fs.writeFileSync(outPath, JSON.stringify(config, null, 2) + '\n', 'utf8')
}

function getDefaultCloudbasercPath(repoRoot) {
  return path.resolve(repoRoot, 'cloudbaserc.json')
}

module.exports = {
  FUNCTION_NAMES,
  buildCloudbaserc,
  writeCloudbasercFile,
  getDefaultCloudbasercPath,
}
