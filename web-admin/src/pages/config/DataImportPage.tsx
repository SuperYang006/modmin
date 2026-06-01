import { useMemo, useState } from 'react'
import { Alert, App, Button, Empty } from 'antd'
import { useNavigate } from 'react-router-dom'
import { PageHeader, PageShell, PanelCard } from '@/components/ui'
import { ImportForm } from '@/pages/config/components/import-export/ImportForm'
import { ImportMappingEditor } from '@/pages/config/components/import-export/ImportMappingEditor'
import { ImportResultSummary } from '@/pages/config/components/import-export/ImportResultSummary'
import { TransferJobSection } from '@/pages/config/components/import-export/TransferJobSection'
import { bufferToBase64, triggerDownload } from '@/pages/config/components/import-export/fileTransfer'
import { useImportExportCollections } from '@/pages/config/hooks/useImportExportCollections'
import { uploadAsset } from '@/services/asset'
import { confirmImport, downloadImportTemplate, previewImport } from '@/runtime/loader/importExport'
import type { ConfirmImportResult, ImportColumnMapping, PreviewImportResult } from '@/types/import-export'

const apiMode = (import.meta.env.VITE_API_MODE as 'mock' | 'http' | 'tcb' | undefined) ?? 'mock'
const shouldSendMockFileBase64 = apiMode === 'mock'

export function DataImportPage() {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const [previewing, setPreviewing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importCollectionName, setImportCollectionName] = useState('')
  const [previewResult, setPreviewResult] = useState<PreviewImportResult | null>(null)
  const [confirmResult, setConfirmResult] = useState<ConfirmImportResult | null>(null)
  const [columnMappings, setColumnMappings] = useState<ImportColumnMapping[]>([])
  const [jobRefreshKey, setJobRefreshKey] = useState(0)
  const [lastImportPayload, setLastImportPayload] = useState<{
    collectionName: string
    fileID: string
    format: 'xlsx' | 'csv' | 'json'
    mode: 'createOnly' | 'updateOnly' | 'upsert'
    matchFieldKey?: string
    skipErrorRows?: boolean
    columnMappings?: ImportColumnMapping[]
    mockFileBase64?: string
    mockFileName?: string
  } | null>(null)
  const {
    loading,
    error,
    collections,
    fieldMap,
    ensureFields,
  } = useImportExportCollections()
  const importableCollections = useMemo(
    () => collections.filter((item) => item.permissions.canCreateOnly || item.permissions.canUpdateOnly || item.permissions.canUpsert),
    [collections],
  )
  const collectionOptions = useMemo(
    () => importableCollections.map((item) => ({ label: `${item.modelName} (${item.collectionName})`, value: item.collectionName })),
    [importableCollections],
  )

  const importFields = fieldMap[importCollectionName] || []
  const unmappedRequiredFields = useMemo(() => {
    if (!previewResult) {
      return []
    }

    const mappedFieldKeys = new Set(columnMappings.map((item) => item.fieldKey).filter(Boolean))
    return previewResult.supportedFields.filter((field) => field.required === true && !mappedFieldKeys.has(field.fieldKey))
  }, [columnMappings, previewResult])

  async function handleTemplateDownload(collectionName: string, format: 'xlsx' | 'csv' | 'json') {
    const response = await downloadImportTemplate({ collectionName, format })
    if (response.code !== 0) {
      void message.error(response.message || '下载模板失败')
      return
    }

    triggerDownload(response.data.fileName, response.data.mimeType, response.data.fileContentBase64)
    void message.success('模板下载成功')
  }

  async function handlePreview(params: {
    collectionName: string
    format: 'xlsx' | 'csv' | 'json'
    mode: 'createOnly' | 'updateOnly' | 'upsert'
    matchFieldKey?: string
    columnMappings?: ImportColumnMapping[]
    file: File
  }) {
    setPreviewing(true)
    setPreviewResult(null)
    setConfirmResult(null)

    const uploadResult = await uploadAsset(params.file, 'modmin_import_export', 'source_file')
    const mockFileBase64 = shouldSendMockFileBase64 ? bufferToBase64(await params.file.arrayBuffer()) : undefined
    const response = await previewImport({
      collectionName: params.collectionName,
      fileID: uploadResult.fileID || uploadResult.fullPath,
      format: params.format,
      mode: params.mode,
      matchFieldKey: params.matchFieldKey,
      columnMappings: params.columnMappings,
      ...(mockFileBase64 ? { mockFileBase64, mockFileName: params.file.name } : {}),
    })

    setPreviewing(false)

    if (response.code !== 0) {
      void message.error(response.message || '导入预检失败')
      return
    }

    setPreviewResult(response.data)
    setColumnMappings(response.data.columnMappings)
    setLastImportPayload({
      collectionName: params.collectionName,
      fileID: uploadResult.fileID || uploadResult.fullPath,
      format: params.format,
      mode: params.mode,
      matchFieldKey: params.matchFieldKey,
      columnMappings: response.data.columnMappings,
      ...(mockFileBase64 ? { mockFileBase64, mockFileName: params.file.name } : {}),
    })
    setJobRefreshKey((prev) => prev + 1)
    void message.success('预检完成')
  }

  async function handleConfirm(values: {
    collectionName: string
    format: 'xlsx' | 'csv' | 'json'
    mode: 'createOnly' | 'updateOnly' | 'upsert'
    matchFieldKey?: string
    skipErrorRows?: boolean
  }) {
    if (!previewResult || !lastImportPayload) {
      void message.error('请先完成预检')
      return
    }

    setImporting(true)
    const response = await confirmImport({
      jobId: previewResult.job.jobId,
      collectionName: values.collectionName,
      fileID: lastImportPayload.fileID,
      format: values.format,
      mode: values.mode,
      matchFieldKey: values.matchFieldKey,
      skipErrorRows: values.skipErrorRows === true,
      columnMappings,
      ...(lastImportPayload.mockFileBase64 ? {
        mockFileBase64: lastImportPayload.mockFileBase64,
        mockFileName: lastImportPayload.mockFileName,
      } : {}),
    })
    setImporting(false)

    if (response.code !== 0) {
      void message.error(response.message || '确认导入失败')
      return
    }

    setConfirmResult(response.data)
    setJobRefreshKey((prev) => prev + 1)
    void message.success('导入执行完成')
  }

  async function handleRepreviewWithMappings() {
    if (!lastImportPayload) {
      void message.error('请先选择文件并完成一次预检')
      return
    }

    setPreviewing(true)
    setConfirmResult(null)
    const response = await previewImport({
      collectionName: lastImportPayload.collectionName,
      fileID: lastImportPayload.fileID,
      format: lastImportPayload.format,
      mode: lastImportPayload.mode,
      matchFieldKey: lastImportPayload.matchFieldKey,
      columnMappings,
      ...(lastImportPayload.mockFileBase64 ? {
        mockFileBase64: lastImportPayload.mockFileBase64,
        mockFileName: lastImportPayload.mockFileName,
      } : {}),
    })
    setPreviewing(false)

    if (response.code !== 0) {
      void message.error(response.message || '重新预检失败')
      return
    }

    setPreviewResult(response.data)
    setColumnMappings(response.data.columnMappings)
    setLastImportPayload((prev) => prev ? { ...prev, columnMappings: response.data.columnMappings } : prev)
    void message.success('已按当前映射重新预检')
  }

  if (error) {
    return (
      <PageShell>
        <PageHeader title="数据导入" description="下载模板、预检并执行批量导入。" />
        <PanelCard>
          <Alert type="error" showIcon title={error} />
        </PanelCard>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <PageHeader
        title="数据导入"
        description="下载模板、预检并执行批量导入。"
        extra={<Button onClick={() => navigate('/config/import-export-history')}>任务记录</Button>}
      />
      <PanelCard>
        {importableCollections.length === 0 && !loading ? (
          <Empty description="当前无可导入的业务模型" />
        ) : (
          <>
            <ImportForm
              loading={loading}
              previewing={previewing}
              importing={importing}
              collectionOptions={collectionOptions}
              fields={importFields}
              onCollectionChange={(collectionName) => {
                setImportCollectionName(collectionName)
                void ensureFields(collectionName)
              }}
              onDownloadTemplate={(collectionName, format) => {
                void handleTemplateDownload(collectionName, format)
              }}
              onPreview={handlePreview}
              onConfirm={handleConfirm}
              previewResult={previewResult}
              confirmResult={confirmResult}
            />
            {previewResult ? (
              <>
                <ImportMappingEditor
                  mappings={columnMappings}
                  fields={previewResult.supportedFields}
                  previewing={previewing}
                  unmappedRequiredFields={unmappedRequiredFields}
                  onChange={setColumnMappings}
                  onRepreview={() => void handleRepreviewWithMappings()}
                />
                <ImportResultSummary
                  summary={confirmResult?.summary || previewResult.summary}
                  errors={confirmResult?.errors || previewResult.errors}
                  conflicts={confirmResult?.conflicts || previewResult.conflicts}
                />
              </>
            ) : null}
          </>
        )}
      </PanelCard>
      <TransferJobSection
        title="最近导入任务"
        description="展示当前可见模型范围内的最近导入预检与执行任务，可查看错误、冲突和执行摘要。"
        jobTypes={['import_preview', 'import_confirm']}
        collectionName={importCollectionName || undefined}
        refreshKey={jobRefreshKey}
      />
    </PageShell>
  )
}
