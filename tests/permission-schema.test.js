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

describe('modmin_schema permission gate', () => {
  let fn
  beforeEach(() => {
    resetDb({
      [COLLECTIONS.collections]: [
        buildCollectionDoc({ collectionName: 'articles', modelName: '文章', sortOrder: 10 }),
        buildCollectionDoc({ collectionName: 'orders', modelName: '订单', sortOrder: 20 }),
        buildCollectionDoc({ collectionName: 'products', modelName: '商品', sortOrder: 30 }),
      ],
      [COLLECTIONS.adminRoles]: [
        buildRoleDoc({ roleCode: 'role_operator', status: 'enabled' }),
        buildRoleDoc({ roleCode: 'role_archived', status: 'disabled' }),
      ],
      [COLLECTIONS.rolePermissions]: [
        buildRolePermission({ roleCode: 'role_operator', collectionName: 'articles', canList: true }),
        buildRolePermission({ roleCode: 'role_operator', collectionName: 'orders', canList: false }),
      ],
    })
    fn = loadCloudFunction('modmin_schema')
  })

  describe('listCollectionSchemas', () => {
    it('super admin sees all collections', async () => {
      const res = await call(fn, 'listCollectionSchemas', { token: TOKEN_SUPER_ADMIN() })
      expect(res.code).toBe(0)
      const names = res.data.list.map((c) => c.collectionName)
      expect(names).toEqual(['articles', 'orders', 'products'])
    })

    it('operator sees only canList=true collections', async () => {
      const res = await call(fn, 'listCollectionSchemas', { token: TOKEN_OPERATOR() })
      expect(res.code).toBe(0)
      const names = res.data.list.map((c) => c.collectionName)
      expect(names).toEqual(['articles'])
    })

    it('disabled role sees nothing', async () => {
      const res = await call(fn, 'listCollectionSchemas', { token: TOKEN_CUSTOM('role_archived') })
      expect(res.code).toBe(0)
      expect(res.data.list).toEqual([])
    })

    it('rejects unauthenticated request', async () => {
      const res = await call(fn, 'listCollectionSchemas', {})
      expect(res.code).toBe(40101)
    })
  })

  describe('getCollectionSchemaDetail', () => {
    it('allows operator with canList', async () => {
      const res = await call(fn, 'getCollectionSchemaDetail', {
        token: TOKEN_OPERATOR(),
        data: { collectionName: 'articles' },
      })
      expect(res.code).toBe(0)
    })

    it('rejects operator without canList', async () => {
      const res = await call(fn, 'getCollectionSchemaDetail', {
        token: TOKEN_OPERATOR(),
        data: { collectionName: 'orders' },
      })
      expect(res.code).toBe(40301)
    })

    it('rejects when role is disabled', async () => {
      const res = await call(fn, 'getCollectionSchemaDetail', {
        token: TOKEN_CUSTOM('role_archived'),
        data: { collectionName: 'articles' },
      })
      expect(res.code).toBe(40301)
    })

    it('returns 40404 for unknown collection', async () => {
      const res = await call(fn, 'getCollectionSchemaDetail', {
        token: TOKEN_SUPER_ADMIN(),
        data: { collectionName: 'mystery' },
      })
      expect(res.code).toBe(40404)
    })
  })

  describe('saveCollectionSchema', () => {
    const schemaPayload = {
      schema: {
        mode: 'create',
        collectionName: 'notices',
        modelCode: 'notices',
        modelName: '公告',
        pageCode: 'notices_list',
        fields: [
          { key: 'title', title: '标题', type: 'text', required: true },
        ],
      },
    }

    it('rejects unauthenticated save', async () => {
      const res = await call(fn, 'saveCollectionSchema', { data: schemaPayload })
      expect(res.code).toBe(40101)
    })

    it('rejects non-super-admin save', async () => {
      const res = await call(fn, 'saveCollectionSchema', {
        token: TOKEN_OPERATOR(),
        data: schemaPayload,
      })
      expect(res.code).toBe(40301)
    })

    it('allows super admin to save schema', async () => {
      const res = await call(fn, 'saveCollectionSchema', {
        token: TOKEN_SUPER_ADMIN(),
        data: schemaPayload,
      })
      expect(res.code).toBe(0)
      expect(res.data.detail.collection.collectionName).toBe('notices')
      expect(res.data.detail.fields.map((field) => field.fieldKey)).toEqual(['title'])
      const logs = getDocs('modmin_audit_logs')
      expect(logs).toHaveLength(1)
      expect(logs[0].eventType).toBe('schema.create')
    })

    it('preserves readonly create and edit settings when saving schema', async () => {
      const res = await call(fn, 'saveCollectionSchema', {
        token: TOKEN_SUPER_ADMIN(),
        data: {
          schema: {
            ...schemaPayload.schema,
            collectionName: 'readonly_cases',
            modelCode: 'readonly_cases',
            pageCode: 'readonly_cases_list',
            fields: [
              {
                key: 'code',
                title: '编码',
                type: 'text',
                readonlyOnCreate: true,
                readonlyOnEdit: true,
              },
            ],
          },
        },
      })

      expect(res.code).toBe(0)
      expect(res.data.detail.fields[0].readonlyOnCreate).toBe(true)
      expect(res.data.detail.fields[0].readonlyOnEdit).toBe(true)
      expect(res.data.detail.fields[0].formConfig.readonlyOnCreate).toBe(true)
      expect(res.data.detail.fields[0].formConfig.readonlyOnEdit).toBe(true)

      const collection = getDocs(COLLECTIONS.collections).find((item) => item.collectionName === 'readonly_cases')
      expect(collection.fields[0].readonlyOnCreate).toBe(true)
      expect(collection.fields[0].readonlyOnEdit).toBe(true)

      const detailRes = await call(fn, 'getCollectionSchemaDetail', {
        token: TOKEN_SUPER_ADMIN(),
        data: { collectionName: 'readonly_cases' },
      })
      expect(detailRes.code).toBe(0)
      expect(detailRes.data.detail.fields[0].readonlyOnCreate).toBe(true)
      expect(detailRes.data.detail.fields[0].readonlyOnEdit).toBe(true)
      expect(detailRes.data.detail.fields[0].formConfig.readonlyOnCreate).toBe(true)
      expect(detailRes.data.detail.fields[0].formConfig.readonlyOnEdit).toBe(true)
    })

    it('rejects duplicate field keys after trimming', async () => {
      const res = await call(fn, 'saveCollectionSchema', {
        token: TOKEN_SUPER_ADMIN(),
        data: {
          schema: {
            ...schemaPayload.schema,
            collectionName: 'trim_case',
            modelCode: 'trim_case',
            pageCode: 'trim_case_list',
            fields: [
              { key: 'title', title: '标题', type: 'text' },
              { key: ' title ', title: '标题副本', type: 'text' },
            ],
          },
        },
      })
      expect(res.code).toBe(40004)
    })

    it('writes update audit log when editing schema', async () => {
      const res = await call(fn, 'saveCollectionSchema', {
        token: TOKEN_SUPER_ADMIN(),
        data: {
          schema: {
            mode: 'edit',
            collectionName: 'articles',
            modelCode: 'articles',
            modelName: '文章中心',
            pageCode: 'articles',
            fields: [
              { key: 'title', title: '标题', type: 'text', required: true },
            ],
          },
        },
      })
      expect(res.code).toBe(0)
      const logs = getDocs('modmin_audit_logs')
      expect(logs).toHaveLength(1)
      expect(logs[0].eventType).toBe('schema.update')
    })
  })

  describe('deleteCollectionSchema', () => {
    it('writes delete audit log', async () => {
      const res = await call(fn, 'deleteCollectionSchema', {
        token: TOKEN_SUPER_ADMIN(),
        data: { collectionName: 'articles' },
      })
      expect(res.code).toBe(0)
      const logs = getDocs('modmin_audit_logs')
      expect(logs).toHaveLength(1)
      expect(logs[0].eventType).toBe('schema.delete')
    })
  })
})
