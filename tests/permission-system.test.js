import { describe, it, expect, beforeEach } from 'vitest'
import { loadCloudFunction, resetDb, getDocs } from './helpers/load-fn.js'
import { TOKEN_SUPER_ADMIN, TOKEN_OPERATOR, TOKEN_CUSTOM } from './helpers/jwt.js'
import { buildCollectionDoc, buildRoleDoc, buildRolePermission } from './helpers/fixtures.js'

const COLLECTIONS = {
  collections: 'modmin_collections',
  adminRoles: 'modmin_admin_roles',
  rolePermissions: 'modmin_role_permissions',
}

function call(fn, action, { data, token } = {}) {
  return fn.main({ action, data, context: token ? { accessToken: token } : undefined, meta: { requestId: 'r' } })
}

describe('modmin_system permission flow', () => {
  let fn
  function seed(extra = {}) {
    resetDb({
      [COLLECTIONS.collections]: [
        buildCollectionDoc({ collectionName: 'articles', modelName: '文章' }),
        buildCollectionDoc({ collectionName: 'orders', modelName: '订单' }),
      ],
      [COLLECTIONS.adminRoles]: [
        buildRoleDoc({ roleCode: 'role_operator', status: 'enabled' }),
        buildRoleDoc({ roleCode: 'role_archived', status: 'disabled' }),
      ],
      [COLLECTIONS.rolePermissions]: [
        buildRolePermission({ roleCode: 'role_operator', collectionName: 'articles', canList: true, canCreate: true }),
      ],
      ...extra,
    })
    fn = loadCloudFunction('modmin_system')
  }

  describe('getMyPermissions', () => {
    beforeEach(() => seed())

    it('rejects unauthenticated request', async () => {
      const res = await call(fn, 'getMyPermissions', {})
      expect(res.code).toBe(40101)
    })

    it('returns all-enabled map for super admin', async () => {
      const res = await call(fn, 'getMyPermissions', { token: TOKEN_SUPER_ADMIN() })
      expect(res.code).toBe(0)
      expect(res.data.isSuperAdmin).toBe(true)
      expect(res.data.permMap.articles).toMatchObject({ canList: true, canCreate: true, canUpdate: true, canDelete: true })
      expect(res.data.permMap.orders).toMatchObject({ canList: true })
    })

    it('returns filtered permMap for operator', async () => {
      const res = await call(fn, 'getMyPermissions', { token: TOKEN_OPERATOR() })
      expect(res.code).toBe(0)
      expect(res.data.isSuperAdmin).toBe(false)
      expect(res.data.permMap.articles).toMatchObject({ canList: true, canCreate: true })
      expect(res.data.permMap.orders).toBeUndefined()
    })

    it('returns empty map + roleDisabled flag when role is disabled', async () => {
      const res = await call(fn, 'getMyPermissions', { token: TOKEN_CUSTOM('role_archived') })
      expect(res.code).toBe(0)
      expect(res.data.roleDisabled).toBe(true)
      expect(res.data.permMap).toEqual({})
    })

    it('returns empty map for role with no permission rows', async () => {
      seed({ [COLLECTIONS.rolePermissions]: [] })
      const res = await call(fn, 'getMyPermissions', { token: TOKEN_OPERATOR() })
      expect(res.code).toBe(0)
      expect(res.data.permMap).toEqual({})
    })
  })

  describe('saveRolePermissions', () => {
    beforeEach(() => seed())

    it('non-super-admin is rejected', async () => {
      const res = await call(fn, 'saveRolePermissions', {
        token: TOKEN_OPERATOR(),
        data: { roleCode: 'role_operator', permissions: [] },
      })
      expect(res.code).not.toBe(0)
    })

    it('upserts permission rows', async () => {
      const res = await call(fn, 'saveRolePermissions', {
        token: TOKEN_SUPER_ADMIN(),
        data: {
          roleCode: 'role_operator',
          permissions: [
            { collectionName: 'articles', canList: true, canCreate: false, canUpdate: true, canDelete: false },
            { collectionName: 'orders', canList: true, canCreate: false, canUpdate: false, canDelete: false },
          ],
        },
      })
      expect(res.code).toBe(0)
      const rows = getDocs(COLLECTIONS.rolePermissions).filter((p) => p.roleCode === 'role_operator')
      const articles = rows.find((r) => r.collectionName === 'articles')
      expect(articles).toMatchObject({ canList: true, canCreate: false, canUpdate: true, canDelete: false })
      const orders = rows.find((r) => r.collectionName === 'orders')
      expect(orders).toMatchObject({ canList: true })
      const logs = getDocs('modmin_audit_logs')
      expect(logs).toHaveLength(1)
      expect(logs[0].eventType).toBe('role.update')
    })
  })

  describe('listRoles', () => {
    it('returns empty list when DB empty', async () => {
      resetDb({
        [COLLECTIONS.adminRoles]: [],
        [COLLECTIONS.collections]: [],
        [COLLECTIONS.rolePermissions]: [],
      })
      fn = loadCloudFunction('modmin_system')
      const res = await call(fn, 'listRoles', { token: TOKEN_SUPER_ADMIN() })
      expect(res.code).toBe(0)
      expect(res.data.list).toEqual([])
    })

    it('deduplicates roleCode in response when DB has duplicates', async () => {
      seed({
        [COLLECTIONS.adminRoles]: [
          buildRoleDoc({ _id: 'r1', roleCode: 'role_operator', status: 'enabled' }),
          buildRoleDoc({ _id: 'r2', roleCode: 'role_operator', status: 'enabled' }),
        ],
      })
      const res = await call(fn, 'listRoles', { token: TOKEN_SUPER_ADMIN() })
      expect(res.code).toBe(0)
      const operatorEntries = res.data.list.filter((r) => r.roleCode === 'role_operator')
      expect(operatorEntries).toHaveLength(1)
    })
  })

  describe('saveRole', () => {
    beforeEach(() => seed())

    it('rejects creating with builtin roleCode', async () => {
      // 先把所有内置角色清掉，模拟"全新数据库"，否则 update 路径会命中已有记录
      resetDb({
        [COLLECTIONS.adminRoles]: [],
        [COLLECTIONS.collections]: getDocs(COLLECTIONS.collections),
      })
      fn = loadCloudFunction('modmin_system')
      const res = await call(fn, 'saveRole', {
        token: TOKEN_SUPER_ADMIN(),
        data: { role: { roleCode: 'role_super_admin', roleName: '试图新建' } },
      })
      expect(res.code).toBe(40003)
    })

    it('creates a new custom role with builtin=false', async () => {
      const res = await call(fn, 'saveRole', {
        token: TOKEN_SUPER_ADMIN(),
        data: { role: { roleCode: 'role_editor', roleName: '编辑' } },
      })
      expect(res.code).toBe(0)
      const stored = getDocs(COLLECTIONS.adminRoles).find((r) => r.roleCode === 'role_editor')
      expect(stored.builtin).toBe(false)
      const logs = getDocs('modmin_audit_logs')
      expect(logs).toHaveLength(1)
      expect(logs[0].eventType).toBe('role.create')
    })

    it('force-enables status when editing builtin role', async () => {
      const res = await call(fn, 'saveRole', {
        token: TOKEN_SUPER_ADMIN(),
        data: { role: { roleCode: 'role_operator', roleName: '运营改名', status: 'disabled' } },
      })
      expect(res.code).toBe(0)
      const stored = getDocs(COLLECTIONS.adminRoles).find((r) => r.roleCode === 'role_operator')
      expect(stored.status).toBe('enabled')
      expect(stored.roleName).toBe('运营改名')
      const logs = getDocs('modmin_audit_logs')
      expect(logs).toHaveLength(1)
      expect(logs[0].eventType).toBe('role.update')
    })

    it('rejects non-super-admin', async () => {
      const res = await call(fn, 'saveRole', {
        token: TOKEN_OPERATOR(),
        data: { role: { roleCode: 'role_editor', roleName: '编辑' } },
      })
      expect(res.code).not.toBe(0)
    })
  })

  describe('menu groups and admin users', () => {
    beforeEach(() => {
      seed({
        modmin_menu_groups: [],
        modmin_admin_users: [],
        modmin_sessions: [],
      })
    })

    it('writes audit log when creating menu group', async () => {
      const res = await call(fn, 'saveMenuGroup', {
        token: TOKEN_SUPER_ADMIN(),
        data: { group: { title: '内容分组', status: 'enabled' } },
      })
      expect(res.code).toBe(0)
      const logs = getDocs('modmin_audit_logs')
      expect(logs).toHaveLength(1)
      expect(logs[0].eventType).toBe('menuGroup.create')
    })

    it('writes audit log when deleting menu group', async () => {
      seed({
        modmin_menu_groups: [
          { _id: 'group_1', groupCode: 'content', title: '内容', icon: '', status: 'enabled', sortOrder: 10 },
        ],
      })
      fn = loadCloudFunction('modmin_system')
      const res = await call(fn, 'deleteMenuGroup', {
        token: TOKEN_SUPER_ADMIN(),
        data: { groupId: 'group_1' },
      })
      expect(res.code).toBe(0)
      const logs = getDocs('modmin_audit_logs')
      expect(logs).toHaveLength(1)
      expect(logs[0].eventType).toBe('menuGroup.delete')
    })

    it('writes audit log when creating admin user', async () => {
      const res = await call(fn, 'saveAdminUser', {
        token: TOKEN_SUPER_ADMIN(),
        data: {
          user: {
            userName: 'alice',
            nickName: 'Alice',
            roleCode: 'role_operator',
            status: 'enabled',
            password: 'secret_password_123',
          },
        },
      })
      expect(res.code).toBe(0)
      const logs = getDocs('modmin_audit_logs')
      expect(logs).toHaveLength(1)
      expect(logs[0].eventType).toBe('user.create')
    })
  })
})
