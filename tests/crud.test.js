import { describe, it, expect, beforeEach } from 'vitest'
import { loadCloudFunction, resetDb, getDocs } from './helpers/load-fn.js'
import { TOKEN_SUPER_ADMIN, TOKEN_OPERATOR, TOKEN_CUSTOM } from './helpers/jwt.js'
import { buildCollectionDoc, buildRoleDoc, buildRolePermission } from './helpers/fixtures.js'

const COLLECTIONS = {
  collections: 'modmin_collections',
  adminRoles: 'modmin_admin_roles',
  rolePermissions: 'modmin_role_permissions',
}
const BUSINESS = 'articles'

function call(fn, action, { data, token } = {}) {
  return fn.main({ action, data, context: token ? { accessToken: token } : undefined, meta: { requestId: 'r' } })
}

const baseRecord = (overrides) => ({
  title: overrides?.title || 'hello',
  count: overrides?.count ?? 1,
  modmin_isDeleted: false,
  modmin_createTime: overrides?.modmin_createTime || Date.now(),
  modmin_updateTime: overrides?.modmin_updateTime || Date.now(),
  modmin_createBy: 'user_seed',
  modmin_updateBy: 'user_seed',
  ...overrides,
})

describe('modmin_crud', () => {
  let fn
  function seed({ rolePerms, records = [], extraRoles = [], collectionFields } = {}) {
    resetDb({
      [COLLECTIONS.collections]: [
        buildCollectionDoc({
          collectionName: BUSINESS,
          modelName: '文章',
          fields: collectionFields || [
            { fieldKey: 'title', label: '标题', type: 'text', required: true },
            { fieldKey: 'count', label: '数量', type: 'number' },
          ],
        }),
      ],
      [COLLECTIONS.adminRoles]: [
        buildRoleDoc({ roleCode: 'role_operator', status: 'enabled' }),
        buildRoleDoc({ roleCode: 'role_archived', status: 'disabled' }),
        ...extraRoles,
      ],
      [COLLECTIONS.rolePermissions]: rolePerms || [],
      [BUSINESS]: records,
    })
    fn = loadCloudFunction('modmin_crud')
  }

  describe('list (auth matrix)', () => {
    it('super admin can list', async () => {
      seed({ records: [baseRecord({ _id: 'rec1' })] })
      const res = await call(fn, 'list', { token: TOKEN_SUPER_ADMIN(), data: { collectionName: BUSINESS } })
      expect(res.code).toBe(0)
      expect(res.data.list).toHaveLength(1)
    })

    it('operator with canList can list', async () => {
      seed({
        records: [baseRecord({ _id: 'rec1' })],
        rolePerms: [buildRolePermission({ roleCode: 'role_operator', collectionName: BUSINESS, canList: true })],
      })
      const res = await call(fn, 'list', { token: TOKEN_OPERATOR(), data: { collectionName: BUSINESS } })
      expect(res.code).toBe(0)
    })

    it('operator without canList is rejected', async () => {
      seed({ records: [baseRecord({ _id: 'rec1' })], rolePerms: [] })
      const res = await call(fn, 'list', { token: TOKEN_OPERATOR(), data: { collectionName: BUSINESS } })
      expect(res.code).toBe(40301)
    })

    it('disabled role is rejected even with permission row', async () => {
      seed({
        records: [baseRecord({ _id: 'rec1' })],
        rolePerms: [buildRolePermission({ roleCode: 'role_archived', collectionName: BUSINESS, canList: true })],
      })
      const res = await call(fn, 'list', { token: TOKEN_CUSTOM('role_archived'), data: { collectionName: BUSINESS } })
      expect(res.code).toBe(40301)
    })

    it('excludes soft-deleted records', async () => {
      seed({
        records: [
          baseRecord({ _id: 'rec_live', title: 'live' }),
          baseRecord({ _id: 'rec_gone', title: 'gone', modmin_isDeleted: true }),
        ],
      })
      const res = await call(fn, 'list', { token: TOKEN_SUPER_ADMIN(), data: { collectionName: BUSINESS } })
      expect(res.code).toBe(0)
      const titles = res.data.list.map((r) => r.title)
      expect(titles).toEqual(['live'])
    })

    it('paginates results', async () => {
      const records = Array.from({ length: 5 }).map((_, i) =>
        baseRecord({ _id: `rec_${i}`, title: `t${i}`, modmin_createTime: Date.now() + i }),
      )
      seed({ records })
      const res = await call(fn, 'list', {
        token: TOKEN_SUPER_ADMIN(),
        data: { collectionName: BUSINESS, pagination: { pageNo: 2, pageSize: 2 } },
      })
      expect(res.code).toBe(0)
      expect(res.data.list).toHaveLength(2)
    })
  })

  describe('create', () => {
    it('super admin can create', async () => {
      seed()
      const res = await call(fn, 'create', {
        token: TOKEN_SUPER_ADMIN(),
        data: { collectionName: BUSINESS, record: { title: 'foo', count: 3 } },
      })
      expect(res.code).toBe(0)
      const stored = getDocs(BUSINESS)
      expect(stored).toHaveLength(1)
      expect(stored[0]).toMatchObject({ title: 'foo', count: 3, modmin_isDeleted: false })
      expect(typeof stored[0].modmin_createTime).toBe('number')
      expect(stored[0].modmin_createBy).toBeTruthy()
      expect(getDocs('modmin_audit_logs')).toHaveLength(1)
      expect(getDocs('modmin_audit_logs')[0].eventType).toBe('record.create')
    })

    it('operator without canCreate is rejected', async () => {
      seed({ rolePerms: [buildRolePermission({ roleCode: 'role_operator', collectionName: BUSINESS, canList: true })] })
      const res = await call(fn, 'create', {
        token: TOKEN_OPERATOR(),
        data: { collectionName: BUSINESS, record: { title: 'no' } },
      })
      expect(res.code).toBe(40301)
    })

    it('disabled role cannot create', async () => {
      seed({
        rolePerms: [buildRolePermission({ roleCode: 'role_archived', collectionName: BUSINESS, canCreate: true })],
      })
      const res = await call(fn, 'create', {
        token: TOKEN_CUSTOM('role_archived'),
        data: { collectionName: BUSINESS, record: { title: 'x' } },
      })
      expect(res.code).toBe(40301)
    })

    it('rejects missing required field', async () => {
      seed()
      const res = await call(fn, 'create', {
        token: TOKEN_SUPER_ADMIN(),
        data: { collectionName: BUSINESS, record: { count: 1 } },
      })
      expect(res.code).toBe(40002)
    })

    it('rejects missing multi asset field when minItems is required', async () => {
      seed({
        collectionFields: [
          { fieldKey: 'title', label: '标题', type: 'text', required: true },
          { fieldKey: 'gallery', label: '图库', type: 'image', allowMultiple: true, minItems: 1 },
        ],
      })

      const missingRes = await call(fn, 'create', {
        token: TOKEN_SUPER_ADMIN(),
        data: { collectionName: BUSINESS, record: { title: 'foo' } },
      })
      expect(missingRes.code).toBe(40002)
      expect(missingRes.message).toContain('至少需要上传 1 个资源')

      const emptyRes = await call(fn, 'create', {
        token: TOKEN_SUPER_ADMIN(),
        data: { collectionName: BUSINESS, record: { title: 'foo', gallery: '[]' } },
      })
      expect(emptyRes.code).toBe(40002)
      expect(emptyRes.message).toContain('至少需要上传 1 个资源')
    })

    it('allows empty multi asset field when not required and no minItems is set', async () => {
      seed({
        collectionFields: [
          { fieldKey: 'title', label: '标题', type: 'text', required: true },
          { fieldKey: 'gallery', label: '图库', type: 'image', allowMultiple: true },
        ],
      })

      const res = await call(fn, 'create', {
        token: TOKEN_SUPER_ADMIN(),
        data: { collectionName: BUSINESS, record: { title: 'foo' } },
      })
      expect(res.code).toBe(0)

      const emptyRes = await call(fn, 'create', {
        token: TOKEN_SUPER_ADMIN(),
        data: { collectionName: BUSINESS, record: { title: 'bar', gallery: '' } },
      })
      expect(emptyRes.code).toBe(0)
    })
  })

  describe('update', () => {
    it('operator with canUpdate can update', async () => {
      seed({
        records: [baseRecord({ _id: 'rec1', title: 'old' })],
        rolePerms: [buildRolePermission({ roleCode: 'role_operator', collectionName: BUSINESS, canUpdate: true })],
      })
      const res = await call(fn, 'update', {
        token: TOKEN_OPERATOR(),
        data: { collectionName: BUSINESS, id: 'rec1', record: { title: 'new' } },
      })
      expect(res.code).toBe(0)
      const stored = getDocs(BUSINESS).find((r) => r._id === 'rec1')
      expect(stored.title).toBe('new')
      expect(typeof stored.modmin_updateTime).toBe('number')
      expect(getDocs('modmin_audit_logs')).toHaveLength(1)
      expect(getDocs('modmin_audit_logs')[0].eventType).toBe('record.update')
    })

    it('operator without canUpdate is rejected', async () => {
      seed({ records: [baseRecord({ _id: 'rec1' })] })
      const res = await call(fn, 'update', {
        token: TOKEN_OPERATOR(),
        data: { collectionName: BUSINESS, id: 'rec1', record: { title: 'x' } },
      })
      expect(res.code).toBe(40301)
    })

    it('disabled role cannot update', async () => {
      seed({
        records: [baseRecord({ _id: 'rec1' })],
        rolePerms: [buildRolePermission({ roleCode: 'role_archived', collectionName: BUSINESS, canUpdate: true })],
      })
      const res = await call(fn, 'update', {
        token: TOKEN_CUSTOM('role_archived'),
        data: { collectionName: BUSINESS, id: 'rec1', record: { title: 'x' } },
      })
      expect(res.code).toBe(40301)
    })

    it('returns 40404 for unknown id', async () => {
      seed()
      const res = await call(fn, 'update', {
        token: TOKEN_SUPER_ADMIN(),
        data: { collectionName: BUSINESS, id: 'no_such', record: { title: 'x' } },
      })
      expect(res.code).toBe(40404)
    })

    it('refuses to update soft-deleted record', async () => {
      seed({ records: [baseRecord({ _id: 'rec_gone', modmin_isDeleted: true })] })
      const res = await call(fn, 'update', {
        token: TOKEN_SUPER_ADMIN(),
        data: { collectionName: BUSINESS, id: 'rec_gone', record: { title: 'x' } },
      })
      expect(res.code).toBe(40404)
    })
  })

  describe('delete (soft delete)', () => {
    it('super admin soft-deletes a record', async () => {
      seed({ records: [baseRecord({ _id: 'rec1' })] })
      const res = await call(fn, 'delete', {
        token: TOKEN_SUPER_ADMIN(),
        data: { collectionName: BUSINESS, id: 'rec1' },
      })
      expect(res.code).toBe(0)
      const stored = getDocs(BUSINESS).find((r) => r._id === 'rec1')
      expect(stored.modmin_isDeleted).toBe(true)
      expect(typeof stored.modmin_deleteTime).toBe('number')
      expect(getDocs('modmin_audit_logs')).toHaveLength(1)
      expect(getDocs('modmin_audit_logs')[0].eventType).toBe('record.delete')
    })

    it('operator without canDelete is rejected', async () => {
      seed({
        records: [baseRecord({ _id: 'rec1' })],
        rolePerms: [buildRolePermission({ roleCode: 'role_operator', collectionName: BUSINESS, canList: true })],
      })
      const res = await call(fn, 'delete', {
        token: TOKEN_OPERATOR(),
        data: { collectionName: BUSINESS, id: 'rec1' },
      })
      expect(res.code).toBe(40301)
      const stored = getDocs(BUSINESS).find((r) => r._id === 'rec1')
      expect(stored.modmin_isDeleted).toBe(false)
    })

    it('disabled role cannot delete', async () => {
      seed({
        records: [baseRecord({ _id: 'rec1' })],
        rolePerms: [buildRolePermission({ roleCode: 'role_archived', collectionName: BUSINESS, canDelete: true })],
      })
      const res = await call(fn, 'delete', {
        token: TOKEN_CUSTOM('role_archived'),
        data: { collectionName: BUSINESS, id: 'rec1' },
      })
      expect(res.code).toBe(40301)
    })

    it('returns 40404 for already-deleted record', async () => {
      seed({ records: [baseRecord({ _id: 'rec1', modmin_isDeleted: true })] })
      const res = await call(fn, 'delete', {
        token: TOKEN_SUPER_ADMIN(),
        data: { collectionName: BUSINESS, id: 'rec1' },
      })
      expect(res.code).toBe(40404)
    })

    it('deleted record disappears from list', async () => {
      seed({ records: [baseRecord({ _id: 'rec1', title: 'doomed' })] })
      await call(fn, 'delete', { token: TOKEN_SUPER_ADMIN(), data: { collectionName: BUSINESS, id: 'rec1' } })
      const res = await call(fn, 'list', { token: TOKEN_SUPER_ADMIN(), data: { collectionName: BUSINESS } })
      expect(res.data.list).toHaveLength(0)
    })
  })

  describe('detail', () => {
    it('returns soft-deleted as not found', async () => {
      seed({ records: [baseRecord({ _id: 'rec1', modmin_isDeleted: true })] })
      const res = await call(fn, 'detail', {
        token: TOKEN_SUPER_ADMIN(),
        data: { collectionName: BUSINESS, id: 'rec1' },
      })
      expect(res.code).toBe(40404)
    })
  })

  describe('unauthenticated', () => {
    it('list without token → 40101', async () => {
      seed()
      const res = await call(fn, 'list', { data: { collectionName: BUSINESS } })
      expect(res.code).toBe(40101)
    })
  })
})
