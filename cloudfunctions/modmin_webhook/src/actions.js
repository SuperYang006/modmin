function createWebhookActions(deps) {
  const {
    db,
    collections,
    command,
    success,
    fail,
    requireSuperAdmin,
    pickOperator,
    normalizeWebhookConfig,
    createWebhookDeliveryHelpers,
    emitAuditLogSafe,
  } = deps

  async function listWebhooks(event) {
    const authError = requireSuperAdmin(event)
    if (authError) return authError

    const result = await db.collection(collections.webhooks).get()
    const list = (result.data || [])
      .sort((a, b) => (b.updateTime || 0) - (a.updateTime || 0))
      .map((item) => ({
        ...item,
        httpConfig: item.httpConfig
          ? {
              ...item.httpConfig,
              secret: item.httpConfig.secret ? '********' : '',
            }
          : item.httpConfig,
      }))

    return success(event, { list })
  }

  async function saveWebhook(event) {
    const authError = requireSuperAdmin(event)
    if (authError) return authError

    const payload = event?.data?.webhook
    if (!payload?.name || !payload?.collectionName) {
      return fail(event, 40001, '缺少 Webhook 名称或模型集合名')
    }

    if (!Array.isArray(payload.events) || payload.events.length === 0) {
      return fail(event, 40002, '请至少选择一个事件')
    }

    if (!['http', 'cloudFunction'].includes(payload.targetType)) {
      return fail(event, 40002, '非法的目标类型')
    }

    if (payload.targetType === 'http') {
      const url = String(payload.httpConfig?.url || '').trim()
      if (!/^https:\/\//i.test(url)) {
        return fail(event, 40002, 'HTTP Webhook 仅支持 https:// 地址')
      }
    }

    if (payload.targetType === 'cloudFunction') {
      const functionName = String(payload.cloudFunctionConfig?.functionName || '').trim()
      if (!functionName) {
        return fail(event, 40002, '缺少目标云函数名称')
      }
    }

    const now = Date.now()
    const operator = pickOperator(event)
    const webhookId = payload.webhookId ? String(payload.webhookId).trim() : ''
    let currentDoc = null

    if (webhookId) {
      const current = await db.collection(collections.webhooks).where({ webhookId }).limit(1).get()
      currentDoc = current.data?.[0] || null
    }

    const nextDoc = normalizeWebhookConfig(payload, now, operator, currentDoc)

    if (currentDoc?._id) {
      await db.collection(collections.webhooks).doc(currentDoc._id).update(nextDoc)
      const latest = await db.collection(collections.webhooks).doc(currentDoc._id).get()
      const item = latest.data?.[0] || null
      await emitAuditLogSafe(event, {
        eventType: 'webhook.update',
        resourceType: 'webhook',
        recordId: currentDoc._id,
        actor: operator,
        result: 'success',
        before: currentDoc,
        after: item,
      })
      return success(event, {
        item: item
          ? {
              ...item,
              httpConfig: item.httpConfig ? { ...item.httpConfig, secret: item.httpConfig.secret ? '********' : '' } : item.httpConfig,
            }
          : null,
      })
    }

    const addResult = await db.collection(collections.webhooks).add(nextDoc)
    const latest = await db.collection(collections.webhooks).doc(addResult.id).get()
    const item = latest.data?.[0] || null

    await emitAuditLogSafe(event, {
      eventType: 'webhook.create',
      resourceType: 'webhook',
      recordId: addResult.id,
      actor: operator,
      result: 'success',
      after: item,
    })

    return success(event, {
      item: item
        ? {
            ...item,
            httpConfig: item.httpConfig ? { ...item.httpConfig, secret: item.httpConfig.secret ? '********' : '' } : item.httpConfig,
          }
        : null,
    })
  }

  async function deleteWebhook(event) {
    const authError = requireSuperAdmin(event)
    if (authError) return authError

    const webhookId = String(event?.data?.webhookId || '').trim()
    if (!webhookId) {
      return fail(event, 40001, 'webhookId is required')
    }

    const current = await db.collection(collections.webhooks).where({ webhookId }).limit(1).get()
    const currentDoc = current.data?.[0]
    if (!currentDoc?._id) {
      return fail(event, 40404, 'webhook not found')
    }

    await db.collection(collections.webhooks).doc(currentDoc._id).remove()

    await emitAuditLogSafe(event, {
      eventType: 'webhook.delete',
      resourceType: 'webhook',
      recordId: currentDoc._id,
      actor: pickOperator(event),
      result: 'success',
      before: currentDoc,
      after: null,
    })

    return success(event, { webhookId })
  }

  async function listWebhookDeliveries(event) {
    const authError = requireSuperAdmin(event)
    if (authError) return authError

    const pagination = event?.data?.pagination || {}
    const pageNo = Number(pagination.pageNo || 1)
    const pageSize = Number(pagination.pageSize || 20)
    const filters = event?.data?.filters || {}
    const where = {}

    if (filters.webhookId) where.webhookId = String(filters.webhookId)
    if (filters.status) where.status = String(filters.status)
    if (filters.eventType) where.eventType = String(filters.eventType)
    if (filters.startTime || filters.endTime) {
      const range = []
      if (filters.startTime) range.push(command.gte(Number(filters.startTime)))
      if (filters.endTime) range.push(command.lte(Number(filters.endTime)))
      if (range.length === 1) {
        where.createTime = range[0]
      } else if (range.length > 1) {
        where.createTime = command.and(...range)
      }
    }

    const baseQuery = db.collection(collections.webhookDeliveries).where(where)
    const countResult = await baseQuery.count()
    const result = await baseQuery.orderBy('createTime', 'desc').skip((pageNo - 1) * pageSize).limit(pageSize).get()

    return success(event, {
      list: result.data || [],
      pagination: {
        pageNo,
        pageSize,
        total: Number(countResult?.total || 0),
      },
    })
  }

  async function processPendingDeliveries(event) {
    const now = Date.now()
    const lockId = `lock_${now}_${Math.random().toString(16).slice(2, 8)}`
    const filters = event?.data?.filters || {}
    const webhookId = String(filters.webhookId || event?.data?.webhookId || '').trim()
    const result = await db.collection(collections.webhookDeliveries)
      .where({
        ...(webhookId ? { webhookId } : {}),
        status: command.in(['pending', 'retrying']),
        ...(filters.eventType ? { eventType: String(filters.eventType) } : {}),
        nextAttemptTime: command.lte(now),
      })
      .limit(20)
      .get()

    const list = result.data || []
    let processed = 0

    for (const item of list) {
      const locked = await createWebhookDeliveryHelpers.tryLockDelivery(item, lockId)
      if (!locked) continue

      const webhookResult = await db.collection(collections.webhooks)
        .where({ webhookId: locked.webhookId })
        .limit(1)
        .get()
      const webhook = webhookResult.data?.[0]
      if (!webhook) {
        await createWebhookDeliveryHelpers.updateDeliveryResult(locked, { retryConfig: { maxAttempts: 1, backoffSeconds: 60 } }, null, new Error('webhook config not found'))
        await emitAuditLogSafe(event, {
          eventType: 'webhook.delivery.failure',
          resourceType: 'webhook',
          recordId: locked.webhookId,
          result: 'failure',
          errorMessage: 'webhook config not found',
          after: {
            deliveryId: locked.deliveryId,
            eventId: locked.eventId,
            eventType: locked.eventType,
          },
        })
        processed += 1
        continue
      }

      try {
        const deliverResult = await createWebhookDeliveryHelpers.deliverSingle(webhook, locked)
        await createWebhookDeliveryHelpers.updateDeliveryResult(locked, webhook, deliverResult, null)
      } catch (error) {
        await createWebhookDeliveryHelpers.updateDeliveryResult(locked, webhook, null, error)
        await emitAuditLogSafe(event, {
          eventType: 'webhook.delivery.failure',
          resourceType: 'webhook',
          recordId: webhook._id || webhook.webhookId,
          actor: webhook.updateBy || {},
          result: 'failure',
          errorMessage: error instanceof Error ? error.message : 'webhook delivery failed',
          after: {
            deliveryId: locked.deliveryId,
            eventId: locked.eventId,
            eventType: locked.eventType,
            target: locked.target,
          },
        })
      }
      processed += 1
    }

    return success(event, { processed })
  }

  async function retryWebhookDelivery(event) {
    const authError = requireSuperAdmin(event)
    if (authError) return authError

    const deliveryId = String(event?.data?.deliveryId || '').trim()
    if (!deliveryId) {
      return fail(event, 40001, 'deliveryId is required')
    }

    await db.collection(collections.webhookDeliveries).doc(deliveryId).update({
      status: 'pending',
      nextAttemptTime: Date.now(),
      updateTime: Date.now(),
      lockedAt: null,
      lockedBy: '',
    })

    return success(event, { deliveryId })
  }

  async function testWebhook(event) {
    const authError = requireSuperAdmin(event)
    if (authError) return authError

    const payload = event?.data?.webhook
    if (!payload) {
      return fail(event, 40001, 'webhook is required')
    }

    const now = Date.now()
    const operator = pickOperator(event)
    const webhook = normalizeWebhookConfig(payload, now, operator, null)
    const sampleEvent = {
      eventId: `evt_test_${now}`,
      eventType: (payload.events || [])[0] || 'record.create',
      occurredAt: now,
      actor: operator,
      resource: {
        type: 'record',
        collectionName: payload.collectionName,
        recordId: 'test_record_id',
      },
      data: {
        before: null,
        after: { title: 'test payload' },
      },
      meta: {
        requestId: event?.meta?.requestId || '',
        source: 'modmin_test',
      },
    }

    try {
      const result = await createWebhookDeliveryHelpers.deliverSingle(webhook, {
        requestPayload: sampleEvent,
      })
      return success(event, { result })
    } catch (error) {
      return fail(event, 50001, error instanceof Error ? error.message : 'Webhook 测试投递失败')
    }
  }

  return {
    listWebhooks,
    saveWebhook,
    deleteWebhook,
    listWebhookDeliveries,
    processPendingDeliveries,
    retryWebhookDelivery,
    testWebhook,
  }
}

module.exports = {
  createWebhookActions,
}
