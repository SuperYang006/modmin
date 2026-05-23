function formatDateTime(timestamp) {
  const value = Number(timestamp)
  if (!Number.isFinite(value) || value <= 0) return ''

  const date = new Date(value)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

function normalizeCollectionSummary(doc) {
  const updatedAt = doc?.updateTime || doc?.createTime || Date.now()

  return {
    collectionName: doc.collectionName,
    modelCode: doc.modelCode,
    modelName: doc.modelName,
    description: doc.description || '',
    pageCode: doc.pageCode,
    icon: typeof doc.icon === 'string' && doc.icon.trim() ? doc.icon.trim() : undefined,
    sortOrder: typeof doc.sortOrder === 'number' ? doc.sortOrder : undefined,
    menuGroupId: typeof doc.menuGroupId === 'string' && doc.menuGroupId.trim() ? doc.menuGroupId.trim() : undefined,
    fieldCount: Number.isFinite(Number(doc.fieldCount)) ? Number(doc.fieldCount) : (Array.isArray(doc.fields) ? doc.fields.length : 0),
    updatedAt: formatDateTime(updatedAt),
  }
}

function compareCollectionSortOrder(a, b) {
  const aHasSortOrder = typeof a?.sortOrder === 'number'
  const bHasSortOrder = typeof b?.sortOrder === 'number'

  if (aHasSortOrder && bHasSortOrder && a.sortOrder !== b.sortOrder) {
    return a.sortOrder - b.sortOrder
  }

  if (aHasSortOrder && !bHasSortOrder) return -1
  if (!aHasSortOrder && bHasSortOrder) return 1

  const aCreateTime = Number(a?.createTime || 0)
  const bCreateTime = Number(b?.createTime || 0)

  if (aCreateTime !== bCreateTime) {
    return aCreateTime - bCreateTime
  }

  return String(a?.collectionName || '').localeCompare(String(b?.collectionName || ''))
}

function compareRecentUpdate(a, b) {
  const aTime = Number(a?.updateTime || a?.createTime || 0)
  const bTime = Number(b?.updateTime || b?.createTime || 0)

  if (aTime !== bTime) {
    return bTime - aTime
  }

  return compareCollectionSortOrder(a, b)
}

function createWarning(type, severity, title, description, count, actionPath) {
  return {
    type,
    severity,
    title,
    description,
    count,
    actionPath,
  }
}

async function safeDbCount(query) {
  try {
    const result = await query.count()
    return Number(result?.total) || 0
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/Table not exist|Db or Table not exist|COLLECTION_NOT_EXIST|ResourceNotFound/i.test(msg)) {
      return 0
    }
    throw error
  }
}

function createConsoleActions(deps) {
  const {
    db,
    collections,
    command,
    success,
    fail,
    parseAccessToken,
    safeDbGet,
    isRoleDisabled,
  } = deps

  async function getConsoleOverview(event) {
    const payload = parseAccessToken(event)
    if (!payload) return fail(event, 40101, '未登录或登录已过期')

    const isSuperAdmin = payload.roleCode === 'role_super_admin'
    if (!isSuperAdmin && await isRoleDisabled(payload.roleCode)) {
      return success(event, {
        isSuperAdmin: false,
        roleDisabled: true,
        stats: {
          modelCount: 0,
          fieldCount: 0,
          visibleModelCount: 0,
          ungroupedModelCount: 0,
          roleCount: 0,
          adminUserCount: 0,
          webhookCount: 0,
          failedWebhookDeliveryCount: 0,
        },
        recentModels: [],
        visibleModels: [],
        warnings: [
          createWarning(
            'roleDisabled',
            'error',
            '当前角色已停用',
            '当前账号所属角色已停用，无法访问业务模型。',
            1,
          ),
        ],
      })
    }

    const allCollections = await safeDbGet(db.collection(collections.collections).where({ status: 'enabled' }))
    let visibleCollections = allCollections

    if (!isSuperAdmin) {
      const permissions = await safeDbGet(db.collection(collections.rolePermissions).where({ roleCode: payload.roleCode }))
      const allowedCollectionNames = new Set(
        permissions
          .filter((item) => item.canList === true)
          .map((item) => item.collectionName),
      )
      visibleCollections = allCollections.filter((item) => allowedCollectionNames.has(item.collectionName))
    }

    const visibleModels = visibleCollections
      .slice()
      .sort(compareCollectionSortOrder)
      .map(normalizeCollectionSummary)
    const recentModels = visibleCollections
      .slice()
      .sort(compareRecentUpdate)
      .slice(0, isSuperAdmin ? 5 : 6)
      .map(normalizeCollectionSummary)
    const fieldCount = visibleCollections.reduce((sum, item) => {
      if (Number.isFinite(Number(item.fieldCount))) {
        return sum + Number(item.fieldCount)
      }
      return sum + (Array.isArray(item.fields) ? item.fields.length : 0)
    }, 0)
    const ungroupedModelCount = allCollections.filter((item) => !item.menuGroupId).length
    const stats = {
      modelCount: isSuperAdmin ? allCollections.length : visibleCollections.length,
      fieldCount,
      visibleModelCount: visibleCollections.length,
      ungroupedModelCount: isSuperAdmin ? ungroupedModelCount : 0,
      roleCount: 0,
      adminUserCount: 0,
      webhookCount: 0,
      failedWebhookDeliveryCount: 0,
    }
    const warnings = []

    if (visibleCollections.length === 0) {
      warnings.push(createWarning(
        isSuperAdmin ? 'noModels' : 'noVisibleModels',
        isSuperAdmin ? 'warning' : 'error',
        isSuperAdmin ? '暂无业务模型' : '暂无可访问业务入口',
        isSuperAdmin ? '当前后台还没有启用的业务模型，可以先创建模型。' : '当前账号没有可访问的业务模型，请联系管理员确认角色权限。',
        0,
        isSuperAdmin ? '/config/models/create' : undefined,
      ))
    }

    if (isSuperAdmin) {
      const [roles, adminUserCount, webhookCount, failedWebhookDeliveryCount] = await Promise.all([
        safeDbGet(db.collection(collections.adminRoles).where({ status: command.in(['enabled', 'disabled']) })),
        safeDbCount(db.collection(collections.adminUsers).where({ status: command.in(['enabled', 'disabled']) })),
        safeDbCount(db.collection(collections.webhooks).where({ status: command.in(['enabled', 'disabled']) })),
        safeDbCount(db.collection(collections.webhookDeliveries).where({ status: command.in(['failed', 'retrying']) })),
      ])

      const roleCodes = new Set(roles.map((item) => item.roleCode).filter(Boolean))
      stats.roleCount = roleCodes.size
      stats.adminUserCount = adminUserCount
      stats.webhookCount = webhookCount
      stats.failedWebhookDeliveryCount = failedWebhookDeliveryCount

      if (ungroupedModelCount > 0) {
        warnings.push(createWarning(
          'ungroupedModels',
          'warning',
          '存在未分组模型',
          '未归入菜单分组的模型会直接显示在侧边栏根级。',
          ungroupedModelCount,
          '/config/menu-groups',
        ))
      }

      const rolePermissionRows = await safeDbGet(db.collection(collections.rolePermissions))
      const authorizedCollectionNames = new Set(
        rolePermissionRows
          .filter((item) => item.canList === true)
          .map((item) => item.collectionName),
      )
      const unauthorizedModelCount = allCollections.filter((item) => !authorizedCollectionNames.has(item.collectionName)).length
      if (unauthorizedModelCount > 0) {
        warnings.push(createWarning(
          'unauthorizedModels',
          'warning',
          '模型权限待确认',
          '部分模型还没有分配给普通角色，请在角色管理中确认可见和操作权限。',
          unauthorizedModelCount,
          '/config/roles',
        ))
      }

      if (failedWebhookDeliveryCount > 0) {
        warnings.push(createWarning(
          'failedWebhookDeliveries',
          'error',
          '存在失败的 Webhook 投递',
          '有 Webhook 投递处于失败或重试状态，请检查目标服务和重试记录。',
          failedWebhookDeliveryCount,
          '/config/webhook-deliveries',
        ))
      }
    }

    return success(event, {
      isSuperAdmin,
      roleDisabled: false,
      stats,
      recentModels,
      visibleModels,
      warnings,
    })
  }

  return {
    getConsoleOverview,
  }
}

module.exports = {
  createConsoleActions,
}
