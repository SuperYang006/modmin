import crypto from 'node:crypto'

export function hashPassword(password, salt) {
  return crypto.createHash('sha256').update(password + salt).digest('hex')
}

export function buildAdminUser(overrides = {}) {
  const salt = overrides.passwordSalt || 'salt_abc'
  const password = overrides.password || 'secret_password_123'
  return {
    _id: overrides._id || 'user_op_1',
    userName: overrides.userName || 'alice',
    nickName: overrides.nickName || 'Alice',
    roleCode: overrides.roleCode || 'role_operator',
    status: overrides.status || 'enabled',
    passwordSalt: salt,
    passwordHash: hashPassword(password, salt),
    avatar: overrides.avatar ?? null,
    createTime: overrides.createTime || Date.now(),
  }
}

export function buildRoleDoc(overrides = {}) {
  return {
    _id: overrides._id || `role_${overrides.roleCode || 'x'}`,
    roleCode: overrides.roleCode || 'role_operator',
    roleName: overrides.roleName || '运营',
    description: overrides.description || '',
    status: overrides.status || 'enabled',
    sortOrder: overrides.sortOrder || 20,
    builtin: overrides.builtin === true,
  }
}

export function buildRolePermission(overrides = {}) {
  return {
    _id: overrides._id || `perm_${overrides.roleCode}_${overrides.collectionName}`,
    roleCode: overrides.roleCode,
    collectionName: overrides.collectionName,
    canList: overrides.canList === true,
    canCreate: overrides.canCreate === true,
    canUpdate: overrides.canUpdate === true,
    canDelete: overrides.canDelete === true,
  }
}

export function buildCollectionDoc(overrides = {}) {
  return {
    _id: overrides._id || `col_${overrides.collectionName || 'demo'}`,
    collectionName: overrides.collectionName || 'demo_items',
    modelName: overrides.modelName || '示例模型',
    status: overrides.status || 'enabled',
    sortOrder: overrides.sortOrder || 10,
    pageCode: overrides.pageCode || overrides.collectionName || 'demo_items',
    fields: overrides.fields || [
      { fieldKey: 'title', label: '标题', type: 'text', required: true },
      { fieldKey: 'count', label: '数量', type: 'number' },
    ],
    menuGroupCode: overrides.menuGroupCode || 'content',
  }
}
