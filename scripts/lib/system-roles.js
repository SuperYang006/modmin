const DEFAULT_ROLE_OPTIONS = [
  { roleCode: 'role_super_admin', roleName: '超级管理员', description: '默认超级管理员', sortOrder: 10, status: 'enabled', builtin: true },
  { roleCode: 'role_operator', roleName: '运营人员', description: '默认运营角色', sortOrder: 20, status: 'enabled', builtin: true },
]

async function ensureBuiltinRoles(db, operator, logger = console) {
  const result = await db.collection('modmin_admin_roles')
    .where({ roleCode: db.command.in(DEFAULT_ROLE_OPTIONS.map((item) => item.roleCode)) })
    .get()
  const existingCodes = new Set((result.data || []).map((item) => item.roleCode))
  const now = Date.now()

  for (const role of DEFAULT_ROLE_OPTIONS) {
    if (existingCodes.has(role.roleCode)) {
      logger.log(`  • 内置角色已存在：${role.roleCode}`)
      continue
    }

    await db.collection('modmin_admin_roles').add({
      roleCode: role.roleCode,
      roleName: role.roleName,
      description: role.description,
      status: role.status,
      sortOrder: role.sortOrder,
      builtin: true,
      createTime: now,
      updateTime: now,
      createBy: operator,
      updateBy: operator,
    })
    logger.log(`  ✓ 已初始化内置角色：${role.roleCode}`)
  }
}

module.exports = {
  DEFAULT_ROLE_OPTIONS,
  ensureBuiltinRoles,
}
