import { describe, it, expect, beforeEach } from 'vitest'
import { loadCloudFunction, resetDb, getDocs } from './helpers/load-fn.js'
import { TOKEN_SUPER_ADMIN } from './helpers/jwt.js'
import { buildCollectionDoc } from './helpers/fixtures.js'

function call(fn, action, { data, token } = {}) {
  return fn.main({ action, data, context: token ? { accessToken: token } : undefined, meta: { requestId: 'webhook_req' } })
}

describe('modmin_webhook', () => {
  let webhookFn
  let crudFn

  beforeEach(() => {
    resetDb({
      modmin_webhooks: [
        {
          _id: 'webhook_1',
          webhookId: 'webhook_1',
          name: '文章同步',
          description: '',
          status: 'enabled',
          events: ['record.create'],
          collectionName: 'articles',
          targetType: 'cloudFunction',
          httpConfig: { url: '', method: 'POST', headers: {}, secret: '', timeoutMs: 3000 },
          cloudFunctionConfig: { functionName: 'downstream_fn', action: 'handleModminWebhook', timeoutMs: 3000 },
          retryConfig: { maxAttempts: 3, backoffSeconds: 60 },
          createTime: Date.now(),
          updateTime: Date.now(),
          createBy: { userId: 'admin_id', userName: 'admin' },
          updateBy: { userId: 'admin_id', userName: 'admin' },
        },
      ],
      modmin_collections: [
        buildCollectionDoc({
          collectionName: 'articles',
          modelName: '文章',
          fields: [{ fieldKey: 'title', label: '标题', type: 'text', required: true }],
        }),
      ],
      modmin_admin_roles: [],
      modmin_role_permissions: [],
    })
    webhookFn = loadCloudFunction('modmin_webhook')
    crudFn = loadCloudFunction('modmin_crud')
  })

  it('allows super admin to save webhook', async () => {
    const res = await call(webhookFn, 'saveWebhook', {
      token: TOKEN_SUPER_ADMIN(),
      data: {
        webhook: {
          name: '同步文章到 HTTPS',
          description: '',
          status: 'enabled',
          events: ['record.update'],
          collectionName: 'articles',
          targetType: 'http',
          httpConfig: {
            url: 'https://example.com/webhook',
            headers: {},
            secret: 'abc',
            timeoutMs: 3000,
          },
          retryConfig: {
            maxAttempts: 3,
            backoffSeconds: 60,
          },
        },
      },
    })
    expect(res.code).toBe(0)
    expect(getDocs('modmin_webhooks')).toHaveLength(2)
    expect(getDocs('modmin_audit_logs')[0].eventType).toBe('webhook.create')
  })

  it('stores cloud function extraParams', async () => {
    const res = await call(webhookFn, 'saveWebhook', {
      token: TOKEN_SUPER_ADMIN(),
      data: {
        webhook: {
          name: '同步到云函数',
          description: '',
          status: 'enabled',
          events: ['record.update'],
          collectionName: 'articles',
          targetType: 'cloudFunction',
          extraParams: {
            tenantId: 't_001',
            syncMode: 'incremental',
          },
          cloudFunctionConfig: {
            functionName: 'article_sync_handler',
            action: 'handleModminWebhook',
            timeoutMs: 3000,
          },
          retryConfig: {
            maxAttempts: 3,
            backoffSeconds: 60,
          },
        },
      },
    })
    expect(res.code).toBe(0)
    const saved = getDocs('modmin_webhooks').find((item) => item.name === '同步到云函数')
    expect(saved.extraParams).toMatchObject({
      tenantId: 't_001',
      syncMode: 'incremental',
    })
  })

  it('stores top-level extraParams for https webhook', async () => {
    const res = await call(webhookFn, 'saveWebhook', {
      token: TOKEN_SUPER_ADMIN(),
      data: {
        webhook: {
          name: '同步到 HTTPS',
          description: '',
          status: 'enabled',
          events: ['record.update'],
          collectionName: 'articles',
          targetType: 'http',
          extraParams: {
            tenantId: 'https_001',
          },
          httpConfig: {
            url: 'https://example.com/webhook',
            headers: {},
            secret: 'abc',
            timeoutMs: 3000,
          },
          retryConfig: {
            maxAttempts: 3,
            backoffSeconds: 60,
          },
        },
      },
    })
    expect(res.code).toBe(0)
    const saved = getDocs('modmin_webhooks').find((item) => item.name === '同步到 HTTPS')
    expect(saved.extraParams).toMatchObject({
      tenantId: 'https_001',
    })
  })

  it('updates existing webhook instead of creating a new one', async () => {
    const res = await call(webhookFn, 'saveWebhook', {
      token: TOKEN_SUPER_ADMIN(),
      data: {
        webhook: {
          webhookId: 'webhook_1',
          name: '文章同步已更新',
          description: 'updated',
          status: 'enabled',
          events: ['record.create', 'record.update'],
          collectionName: 'articles',
          targetType: 'cloudFunction',
          cloudFunctionConfig: {
            functionName: 'downstream_fn',
            action: 'handleModminWebhook',
            timeoutMs: 3000,
            extraParams: {},
          },
          retryConfig: {
            maxAttempts: 3,
            backoffSeconds: 60,
          },
        },
      },
    })
    expect(res.code).toBe(0)
    const docs = getDocs('modmin_webhooks')
    expect(docs).toHaveLength(1)
    expect(docs[0].name).toBe('文章同步已更新')
    expect(docs[0].description).toBe('updated')
    expect(getDocs('modmin_audit_logs')[0].eventType).toBe('webhook.update')
  })

  it('writes audit log when deleting webhook', async () => {
    const res = await call(webhookFn, 'deleteWebhook', {
      token: TOKEN_SUPER_ADMIN(),
      data: { webhookId: 'webhook_1' },
    })
    expect(res.code).toBe(0)
    expect(getDocs('modmin_webhooks')).toHaveLength(0)
    expect(getDocs('modmin_audit_logs')[0].eventType).toBe('webhook.delete')
  })

  it('enqueue delivery after record create', async () => {
    const res = await crudFn.main({
      action: 'create',
      data: { collectionName: 'articles', record: { title: 'hello' } },
      context: { accessToken: TOKEN_SUPER_ADMIN() },
      meta: { requestId: 'crud_req' },
    })
    expect(res.code).toBe(0)
    const deliveries = getDocs('modmin_webhook_deliveries')
    expect(deliveries).toHaveLength(1)
    expect(deliveries[0].eventType).toBe('record.create')
    expect(deliveries[0].status).toBe('pending')
  })
})
