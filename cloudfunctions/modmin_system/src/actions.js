const { createRoleActions } = require('./role-actions.js')
const { createMenuActions } = require('./menu-actions.js')
const { createPermissionActions } = require('./permission-actions.js')
const { createAdminUserActions } = require('./admin-user-actions.js')

function createSystemActions(deps) {
  const roleActions = createRoleActions(deps)
  const menuActions = createMenuActions(deps)
  const permissionActions = createPermissionActions(deps)
  const adminUserActions = createAdminUserActions(deps)

  return {
    ...roleActions,
    ...menuActions,
    ...permissionActions,
    ...adminUserActions,
  }
}

module.exports = {
  createSystemActions,
}
