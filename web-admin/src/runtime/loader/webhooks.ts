import { callCloudFunction } from '@/services/cloud'
import type {
  DeleteWebhookResult,
  ListWebhookDeliveriesResult,
  ListWebhooksResult,
  SaveWebhookPayload,
  SaveWebhookResult,
} from '@/types/schema'

export async function listWebhooks() {
  return callCloudFunction<Record<string, never>, ListWebhooksResult>('modmin_webhook', {
    action: 'listWebhooks',
    data: {},
    meta: { requestId: `webhook_list_${Date.now()}`, clientTime: Date.now() },
  })
}

export async function saveWebhook(webhook: SaveWebhookPayload) {
  return callCloudFunction<{ webhook: SaveWebhookPayload }, SaveWebhookResult>('modmin_webhook', {
    action: 'saveWebhook',
    data: { webhook },
    meta: { requestId: `webhook_save_${Date.now()}`, clientTime: Date.now() },
  })
}

export async function deleteWebhook(webhookId: string) {
  return callCloudFunction<{ webhookId: string }, DeleteWebhookResult>('modmin_webhook', {
    action: 'deleteWebhook',
    data: { webhookId },
    meta: { requestId: `webhook_delete_${Date.now()}`, clientTime: Date.now() },
  })
}

export async function listWebhookDeliveries(params: {
  webhookId?: string
  status?: string
  eventType?: string
  startTime?: number
  endTime?: number
  pageNo?: number
  pageSize?: number
}) {
  return callCloudFunction<{
    filters: { webhookId?: string; status?: string; eventType?: string; startTime?: number; endTime?: number }
    pagination: { pageNo: number; pageSize: number }
  }, ListWebhookDeliveriesResult>('modmin_webhook', {
    action: 'listWebhookDeliveries',
    data: {
      filters: {
        webhookId: params.webhookId,
        status: params.status,
        eventType: params.eventType,
        startTime: params.startTime,
        endTime: params.endTime,
      },
      pagination: {
        pageNo: params.pageNo || 1,
        pageSize: params.pageSize || 20,
      },
    },
    meta: { requestId: `webhook_deliveries_${Date.now()}`, clientTime: Date.now() },
  })
}

export async function retryWebhookDelivery(deliveryId: string) {
  return callCloudFunction<{ deliveryId: string }, { deliveryId: string }>('modmin_webhook', {
    action: 'retryWebhookDelivery',
    data: { deliveryId },
    meta: { requestId: `webhook_retry_${Date.now()}`, clientTime: Date.now() },
  })
}

export async function testWebhook(webhook: SaveWebhookPayload) {
  return callCloudFunction<{ webhook: SaveWebhookPayload }, { result: Record<string, unknown> }>('modmin_webhook', {
    action: 'testWebhook',
    data: { webhook },
    meta: { requestId: `webhook_test_${Date.now()}`, clientTime: Date.now() },
  })
}

export async function processPendingWebhookDeliveries(filters?: {
  webhookId?: string
  eventType?: string
}) {
  return callCloudFunction<{ filters?: { webhookId?: string; eventType?: string } }, { processed: number }>('modmin_webhook', {
    action: 'processPendingDeliveries',
    data: filters ? { filters } : {},
    meta: { requestId: `webhook_process_${Date.now()}`, clientTime: Date.now() },
  })
}
