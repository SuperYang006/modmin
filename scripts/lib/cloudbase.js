const cloudbase = require('@cloudbase/node-sdk')
const { hashPassword, generateSalt } = require('../../cloudfunctions/modmin_system/src/password.js')

const COLLECTION_NAMES = [
  'modmin_collections',
  'modmin_admin_users',
  'modmin_admin_roles',
  'modmin_role_permissions',
  'modmin_sessions',
  'modmin_menu_groups',
  'modmin_audit_logs',
  'modmin_import_export_jobs',
  'modmin_webhooks',
  'modmin_webhook_deliveries',
]

function createCloudbaseAdmin({ envId, secretId, secretKey }) {
  return cloudbase.init({
    env: envId,
    secretId,
    secretKey,
  })
}

async function ensureCollections(db, logger = console) {
  const created = []
  const existed = []

  for (const name of COLLECTION_NAMES) {
    try {
      await db.createCollection(name)
      created.push(name)
      logger.log(`  ✓ ${name}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (/already exists|exist|Duplicate/i.test(message)) {
        existed.push(name)
        logger.log(`  • ${name}（已存在）`)
      } else {
        throw error
      }
    }
  }

  return { created, existed }
}

async function ensureAdminUser(db, { userName, password, nickName, overwriteExisting }, logger = console) {
  const result = await db.collection('modmin_admin_users').where({ userName }).limit(1).get()
  const existing = result.data?.[0]
  const now = Date.now()
  const salt = generateSalt()
  const passwordHash = hashPassword(password, salt)
  const operator = { userId: 'setup', userName: 'setup' }

  if (existing?._id) {
    if (!overwriteExisting) {
      logger.log(`  • 超管账号已存在，跳过：${userName}`)
      return { mode: 'skipped', userId: existing._id }
    }
    await db.collection('modmin_admin_users').doc(existing._id).update({
      userName,
      nickName,
      roleCode: 'role_super_admin',
      status: 'enabled',
      passwordSalt: salt,
      passwordHash,
      updateTime: now,
      updateBy: operator,
    })
    logger.log(`  ✓ 已更新超管账号：${userName}`)
    return { mode: 'updated', userId: existing._id }
  }

  const addResult = await db.collection('modmin_admin_users').add({
    userName,
    nickName,
    roleCode: 'role_super_admin',
    status: 'enabled',
    avatar: null,
    passwordSalt: salt,
    passwordHash,
    createTime: now,
    updateTime: now,
    createBy: operator,
    updateBy: operator,
  })
  logger.log(`  ✓ 已创建超管账号：${userName}`)
  return { mode: 'created', userId: addResult.id }
}

async function verifyCollectionsExist(db) {
  async function sleep(ms) {
    await new Promise((resolve) => setTimeout(resolve, ms))
  }

  async function findMissingOnce() {
    const missing = []

    for (const name of COLLECTION_NAMES) {
      try {
        await db.collection(name).limit(1).get()
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (/Table not exist|Db or Table not exist|COLLECTION_NOT_EXIST|ResourceNotFound/i.test(message)) {
          missing.push(name)
          continue
        }
        throw error
      }
    }

    return missing
  }

  let missing = await findMissingOnce()
  if (missing.length === 0) {
    return missing
  }

  // CloudBase 新建集合后可能存在短暂可见性延迟，做几次轻量重试再判失败。
  for (const delay of [1500, 3000]) {
    await sleep(delay)
    missing = await findMissingOnce()
    if (missing.length === 0) {
      return missing
    }
  }

  return missing
}

async function verifyAdminUserExists(db, userName) {
  const result = await db.collection('modmin_admin_users').where({ userName }).limit(1).get()
  return Boolean(result.data?.[0]?._id)
}

module.exports = {
  COLLECTION_NAMES,
  createCloudbaseAdmin,
  ensureCollections,
  ensureAdminUser,
  verifyCollectionsExist,
  verifyAdminUserExists,
}
