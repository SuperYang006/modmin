import { callCloudFunction } from '@/services/cloud'

export interface AuditLogItem {
  _id: string
  eventId: string
  eventType: string
  resourceType: string
  collectionName: string
  recordId: string
  actor: {
    userId: string
    userName: string
    nickName: string
    roleCode: string
  }
  result: 'success' | 'failure'
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  diff: Record<string, unknown>
  errorMessage: string
  requestId: string
  clientIp?: string
  userAgent?: string
  createTime: number
}

export interface AuditLogFilters {
  eventType?: string
  resourceType?: string
  collectionName?: string
  result?: 'success' | 'failure'
  startTime?: number
  endTime?: number
}

interface AuditLogListResult {
  list: AuditLogItem[]
  pagination: {
    pageNo: number
    pageSize: number
    total: number
  }
}

interface AuditLogDetailResult {
  detail: AuditLogItem
}

export async function listAuditLogs(params: {
  filters?: AuditLogFilters
  pageNo?: number
  pageSize?: number
}) {
  return callCloudFunction<{ filters?: AuditLogFilters; pagination: { pageNo: number; pageSize: number } }, AuditLogListResult>('modmin_audit', {
    action: 'listAuditLogs',
    data: {
      filters: params.filters || {},
      pagination: {
        pageNo: params.pageNo || 1,
        pageSize: params.pageSize || 20,
      },
    },
    meta: {
      requestId: `audit_list_${Date.now()}`,
      clientTime: Date.now(),
    },
  })
}

export async function getAuditLogDetail(logId: string) {
  return callCloudFunction<{ logId: string }, AuditLogDetailResult>('modmin_audit', {
    action: 'getAuditLogDetail',
    data: { logId },
    meta: {
      requestId: `audit_detail_${Date.now()}`,
      clientTime: Date.now(),
    },
  })
}
