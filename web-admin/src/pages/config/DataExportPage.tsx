import { useMemo, useState } from 'react'
import { Alert, App, Button, Empty } from 'antd'
import { useNavigate } from 'react-router-dom'
import { PageHeader, PageShell, PanelCard } from '@/components/ui'
import { ExportForm } from '@/pages/config/components/import-export/ExportForm'
import { TransferJobSection } from '@/pages/config/components/import-export/TransferJobSection'
import { triggerDownload } from '@/pages/config/components/import-export/fileTransfer'
import { useImportExportCollections } from '@/pages/config/hooks/useImportExportCollections'
import { exportRecords } from '@/runtime/loader/importExport'
import type { CrudFilterItem } from '@/types/runtime'

export function DataExportPage() {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const [exporting, setExporting] = useState(false)
  const [exportCollectionName, setExportCollectionName] = useState('')
  const [jobRefreshKey, setJobRefreshKey] = useState(0)
  const {
    loading,
    error,
    collections,
    exportContextMap,
    ensureExportContext,
  } = useImportExportCollections()
  const exportableCollections = useMemo(
    () => collections.filter((item) => item.permissions.canExport),
    [collections],
  )
  const collectionOptions = useMemo(
    () => exportableCollections.map((item) => ({ label: `${item.modelName} (${item.collectionName})`, value: item.collectionName })),
    [exportableCollections],
  )

  const exportContext = exportContextMap[exportCollectionName] || {
    fields: [],
    searchFields: [],
    dictMap: {},
  }

  async function handleExport(values: {
    collectionName: string
    format: 'xlsx' | 'csv' | 'json'
    fieldKeys: string[]
    fileName?: string
    headerMode: 'label' | 'fieldKey'
    exportScope: 'all' | 'filtered'
    filters: CrudFilterItem[]
    sortField?: string
    sortOrder?: 'asc' | 'desc'
  }) {
    setExporting(true)
    const response = await exportRecords({
      collectionName: values.collectionName,
      format: values.format,
      fieldKeys: values.fieldKeys,
      fileName: values.fileName,
      headerMode: values.headerMode,
      filters: values.filters,
      sort: values.sortField ? { field: values.sortField, order: values.sortOrder || 'desc' } : undefined,
    })
    setExporting(false)

    if (response.code !== 0) {
      void message.error(response.message || '导出失败')
      return
    }

    triggerDownload(response.data.fileName, response.data.mimeType, response.data.fileContentBase64)
    setJobRefreshKey((prev) => prev + 1)
    void message.success('导出成功')
  }

  if (error) {
    return (
      <PageShell>
        <PageHeader title="数据导出" description="按字段、格式和筛选条件导出业务数据。" />
        <PanelCard>
          <Alert type="error" showIcon title={error} />
        </PanelCard>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <PageHeader
        title="数据导出"
        description="按字段、格式和筛选条件导出业务数据。"
        extra={<Button onClick={() => navigate('/config/import-export-history')}>任务记录</Button>}
      />
      <PanelCard>
        {exportableCollections.length === 0 && !loading ? (
          <Empty description="当前无可导出的业务模型" />
        ) : (
          <ExportForm
            loading={loading}
            exporting={exporting}
            collectionOptions={collectionOptions}
            fieldOptions={exportContext.fields.map((field) => ({ label: field.label, value: field.fieldKey }))}
            fields={exportContext.fields}
            searchFields={exportContext.searchFields}
            dictMap={exportContext.dictMap}
            onCollectionChange={(collectionName) => {
              setExportCollectionName(collectionName)
              void ensureExportContext(collectionName)
            }}
            onSubmit={(values) => void handleExport(values)}
          />
        )}
      </PanelCard>
      <TransferJobSection
        title="最近导出任务"
        description="展示当前可见模型范围内的最近导出任务，可查看导出字段、筛选条件和结果摘要。"
        jobTypes={['export']}
        collectionName={exportCollectionName || undefined}
        refreshKey={jobRefreshKey}
      />
    </PageShell>
  )
}
