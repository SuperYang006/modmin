import { Tag } from 'antd'
import type { WebhookItem } from '@/types/schema'

export const WEBHOOK_EVENT_LABEL_MAP: Record<string, string> = {
  'record.create': '创建记录',
  'record.update': '更新记录',
  'record.delete': '删除记录',
}

export const DELIVERY_STATUS_META: Record<string, { label: string; color: string }> = {
  pending: { label: '待投递', color: 'default' },
  processing: { label: '处理中', color: 'processing' },
  success: { label: '成功', color: 'success' },
  retrying: { label: '重试中', color: 'warning' },
  failed: { label: '失败', color: 'error' },
}

export function getWebhookEventLabel(eventType: string) {
  return WEBHOOK_EVENT_LABEL_MAP[eventType] || eventType
}

export function renderDeliveryStatus(status: string) {
  const meta = DELIVERY_STATUS_META[status] || { label: status || '-', color: 'default' }
  return <Tag color={meta.color}>{meta.label}</Tag>
}

export function getWebhookTargetSummary(item: WebhookItem) {
  if (item.targetType === 'cloudFunction') {
    const functionName = item.cloudFunctionConfig?.functionName || '-'
    const action = item.cloudFunctionConfig?.action || 'handleModminWebhook'
    return `${functionName} / ${action}`
  }

  const url = item.httpConfig?.url || ''
  if (!url) return '-'

  try {
    const parsed = new URL(url)
    return `${parsed.host}${parsed.pathname}`
  } catch {
    return url
  }
}
