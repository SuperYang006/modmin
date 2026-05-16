import { describe, it, expect, beforeEach } from 'vitest'
import { loadCloudFunction, resetDb } from './helpers/load-fn.js'
import { TOKEN_SUPER_ADMIN, TOKEN_OPERATOR } from './helpers/jwt.js'

function call(fn, action, { data, token } = {}) {
  return fn.main({ action, data, context: token ? { accessToken: token } : undefined, meta: { requestId: 'audit_req' } })
}

describe('modmin_audit', () => {
  let fn

  beforeEach(() => {
    resetDb({
      modmin_audit_logs: [
        {
          _id: 'log_1',
          eventId: 'evt_1',
          eventType: 'record.update',
          resourceType: 'record',
          collectionName: 'articles',
          recordId: 'rec_1',
          actor: { userId: 'user_super', userName: 'root', nickName: 'Root', roleCode: 'role_super_admin' },
          result: 'success',
          before: { title: 'old' },
          after: { title: 'new' },
          diff: { title: { before: 'old', after: 'new' } },
          errorMessage: '',
          requestId: 'req_1',
          createTime: 200,
        },
        {
          _id: 'log_2',
          eventId: 'evt_2',
          eventType: 'auth.login.failure',
          resourceType: 'auth',
          collectionName: '',
          recordId: '',
          actor: { userId: '', userName: 'alice', nickName: 'alice', roleCode: '' },
          result: 'failure',
          before: null,
          after: null,
          diff: {},
          errorMessage: '账号或密码错误',
          requestId: 'req_2',
          createTime: 100,
        },
      ],
    })
    fn = loadCloudFunction('modmin_audit')
  })

  it('allows super admin to list logs', async () => {
    const res = await call(fn, 'listAuditLogs', { token: TOKEN_SUPER_ADMIN(), data: { pagination: { pageNo: 1, pageSize: 10 } } })
    expect(res.code).toBe(0)
    expect(res.data.list).toHaveLength(2)
    expect(res.data.list[0]._id).toBe('log_1')
  })

  it('filters by eventType', async () => {
    const res = await call(fn, 'listAuditLogs', {
      token: TOKEN_SUPER_ADMIN(),
      data: { filters: { eventType: 'auth.login.failure' }, pagination: { pageNo: 1, pageSize: 10 } },
    })
    expect(res.code).toBe(0)
    expect(res.data.list).toHaveLength(1)
    expect(res.data.list[0]._id).toBe('log_2')
  })

  it('rejects non-super-admin access', async () => {
    const res = await call(fn, 'listAuditLogs', { token: TOKEN_OPERATOR(), data: { pagination: { pageNo: 1, pageSize: 10 } } })
    expect(res.code).toBe(40301)
  })
})
