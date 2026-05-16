import { describe, it, expect, beforeEach } from 'vitest'
import { loadCloudFunction, resetDb } from './helpers/load-fn.js'
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

describe('modmin_runtime permission gate', () => {
  let fn
  beforeEach(() => {
    resetDb({
      [COLLECTIONS.collections]: [
        buildCollectionDoc({ collectionName: 'articles', pageCode: 'articles', modelName: '文章' }),
      ],
      [COLLECTIONS.adminRoles]: [
        buildRoleDoc({ roleCode: 'role_operator', status: 'enabled' }),
        buildRoleDoc({ roleCode: 'role_archived', status: 'disabled' }),
      ],
      [COLLECTIONS.rolePermissions]: [
        buildRolePermission({ roleCode: 'role_operator', collectionName: 'articles', canList: true }),
      ],
    })
    fn = loadCloudFunction('modmin_runtime')
  })

  it('super admin can read any page', async () => {
    const res = await call(fn, 'getPageRuntimeSchema', { token: TOKEN_SUPER_ADMIN(), data: { pageCode: 'articles' } })
    expect(res.code).toBe(0)
  })

  it('operator with canList passes', async () => {
    const res = await call(fn, 'getPageRuntimeSchema', { token: TOKEN_OPERATOR(), data: { pageCode: 'articles' } })
    expect(res.code).toBe(0)
  })

  it('operator without canList is rejected', async () => {
    resetDb({
      [COLLECTIONS.collections]: [
        buildCollectionDoc({ collectionName: 'articles', pageCode: 'articles' }),
      ],
      [COLLECTIONS.adminRoles]: [buildRoleDoc({ roleCode: 'role_operator', status: 'enabled' })],
      [COLLECTIONS.rolePermissions]: [],
    })
    fn = loadCloudFunction('modmin_runtime')
    const res = await call(fn, 'getPageRuntimeSchema', { token: TOKEN_OPERATOR(), data: { pageCode: 'articles' } })
    expect(res.code).toBe(40301)
  })

  it('disabled role is rejected even if permission row exists', async () => {
    resetDb({
      [COLLECTIONS.collections]: [buildCollectionDoc({ collectionName: 'articles', pageCode: 'articles' })],
      [COLLECTIONS.adminRoles]: [buildRoleDoc({ roleCode: 'role_archived', status: 'disabled' })],
      [COLLECTIONS.rolePermissions]: [
        buildRolePermission({ roleCode: 'role_archived', collectionName: 'articles', canList: true }),
      ],
    })
    fn = loadCloudFunction('modmin_runtime')
    const res = await call(fn, 'getPageRuntimeSchema', { token: TOKEN_CUSTOM('role_archived'), data: { pageCode: 'articles' } })
    expect(res.code).toBe(40301)
  })

  it('unauthenticated request is rejected', async () => {
    const res = await call(fn, 'getPageRuntimeSchema', { data: { pageCode: 'articles' } })
    expect(res.code).toBe(40101)
  })

  it('returns 40404 for missing model', async () => {
    const res = await call(fn, 'getPageRuntimeSchema', { token: TOKEN_SUPER_ADMIN(), data: { pageCode: 'mystery' } })
    expect(res.code).toBe(40404)
  })

  it('rejects without pageCode', async () => {
    const res = await call(fn, 'getPageRuntimeSchema', { token: TOKEN_SUPER_ADMIN(), data: {} })
    expect(res.code).toBe(40001)
  })
})
