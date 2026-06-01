import type { StatusTone } from '@/components/ui'
import type { TransferJobItem } from '@/types/import-export'

export function formatTransferJobTime(value?: number) {
  if (!value) return '-'
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}

export function resolveTransferJobStatusTone(status?: TransferJobItem['status']): StatusTone {
  switch (status) {
    case 'success':
      return 'success'
    case 'partialSuccess':
      return 'warning'
    case 'failed':
      return 'error'
    case 'processing':
      return 'processing'
    case 'previewed':
      return 'info'
    default:
      return 'neutral'
  }
}

export function getTransferJobTypeLabel(jobType: TransferJobItem['jobType']) {
  return jobType === 'export' ? '导出' : jobType === 'import_preview' ? '导入预检' : '导入执行'
}
