import { callCloudFunction } from '@/services/cloud'
import type {
  ConfirmImportPayload,
  ConfirmImportResult,
  DownloadImportTemplatePayload,
  DownloadImportTemplateResult,
  ExportRecordsPayload,
  ExportRecordsResult,
  ListTransferJobsPayload,
  ListTransferJobsResult,
  ListTransferCollectionsResult,
  PreviewImportPayload,
  PreviewImportResult,
  TransferJobDetailResult,
} from '@/types/import-export'

export async function listTransferCollections() {
  return callCloudFunction<Record<string, never>, ListTransferCollectionsResult>('modmin_import_export', {
    action: 'listTransferCollections',
    data: {},
    meta: {
      requestId: `import_export_collections_${Date.now()}`,
      clientTime: Date.now(),
    },
  })
}

export async function downloadImportTemplate(payload: DownloadImportTemplatePayload) {
  return callCloudFunction<DownloadImportTemplatePayload, DownloadImportTemplateResult>('modmin_import_export', {
    action: 'downloadImportTemplate',
    data: payload,
    meta: {
      requestId: `import_export_template_${payload.collectionName}_${Date.now()}`,
      clientTime: Date.now(),
    },
  })
}

export async function exportRecords(payload: ExportRecordsPayload) {
  return callCloudFunction<ExportRecordsPayload, ExportRecordsResult>('modmin_import_export', {
    action: 'exportRecords',
    data: payload,
    meta: {
      requestId: `import_export_export_${payload.collectionName}_${Date.now()}`,
      clientTime: Date.now(),
    },
  })
}

export async function previewImport(payload: PreviewImportPayload) {
  return callCloudFunction<PreviewImportPayload, PreviewImportResult>('modmin_import_export', {
    action: 'previewImport',
    data: payload,
    meta: {
      requestId: `import_export_preview_${payload.collectionName}_${Date.now()}`,
      clientTime: Date.now(),
    },
  })
}

export async function confirmImport(payload: ConfirmImportPayload) {
  return callCloudFunction<ConfirmImportPayload, ConfirmImportResult>('modmin_import_export', {
    action: 'confirmImport',
    data: payload,
    meta: {
      requestId: `import_export_confirm_${payload.collectionName}_${Date.now()}`,
      clientTime: Date.now(),
    },
  })
}

export async function getTransferJobDetail(jobId: string) {
  return callCloudFunction<{ jobId: string }, TransferJobDetailResult>('modmin_import_export', {
    action: 'getTransferJobDetail',
    data: { jobId },
    meta: {
      requestId: `import_export_job_${jobId}_${Date.now()}`,
      clientTime: Date.now(),
    },
  })
}

export async function listTransferJobs(payload: ListTransferJobsPayload) {
  return callCloudFunction<ListTransferJobsPayload, ListTransferJobsResult>('modmin_import_export', {
    action: 'listTransferJobs',
    data: payload,
    meta: {
      requestId: `import_export_jobs_${payload.jobType || 'all'}_${Date.now()}`,
      clientTime: Date.now(),
    },
  })
}
