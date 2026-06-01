import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Form, Select, Space } from 'antd'
import { useNavigate } from 'react-router-dom'
import { ConfigDataTable, PageHeader, PageShell, PanelCard, StatusBadge } from '@/components/ui'
import { TransferJobDetailDrawer } from '@/pages/config/components/import-export/TransferJobDetailDrawer'
import { formatTransferJobTime, getTransferJobTypeLabel, resolveTransferJobStatusTone } from '@/pages/config/components/import-export/transferJobMeta'
import { useImportExportCollections } from '@/pages/config/hooks/useImportExportCollections'
import { getTransferJobDetail, listTransferJobs } from '@/runtime/loader/importExport'
import type { ListTransferJobsPayload, TransferJobItem } from '@/types/import-export'

interface HistoryFilterValues {
  collectionName?: string
  jobType?: TransferJobItem['jobType']
  status?: TransferJobItem['status']
  format?: TransferJobItem['format']
}

export function ImportExportHistoryPage() {
  const navigate = useNavigate()
  const [form] = Form.useForm<HistoryFilterValues>()
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState('')
  const [jobs, setJobs] = useState<TransferJobItem[]>([])
  const [activeJob, setActiveJob] = useState<TransferJobItem | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [filters, setFilters] = useState<HistoryFilterValues>({})
  const [pagination, setPagination] = useState({ pageNo: 1, pageSize: 20, total: 0 })
  const { loading: collectionLoading, error: collectionError, collectionOptions } = useImportExportCollections()

  useEffect(() => {
    void loadJobs(1, pagination.pageSize, filters)
  }, [filters])

  async function loadJobs(pageNo = 1, pageSize = 20, nextFilters = filters) {
    setLoading(true)
    setError('')
    const payload: ListTransferJobsPayload = {
      ...nextFilters,
      pageNo,
      pageSize,
    }
    const response = await listTransferJobs(payload)
    setLoading(false)

    if (response.code !== 0) {
      setError(response.message || '加载任务记录失败')
      return
    }

    setJobs(response.data.list)
    setPagination(response.data.pagination)
  }

  async function openDetail(jobId: string) {
    setDetailLoading(true)
    const response = await getTransferJobDetail(jobId)
    setDetailLoading(false)

    if (response.code !== 0) {
      setError(response.message || '加载任务详情失败')
      return
    }

    setActiveJob(response.data.job)
    setDrawerOpen(true)
  }

  const statusOptions = useMemo(
    () => [
      { label: '成功', value: 'success' },
      { label: '部分成功', value: 'partialSuccess' },
      { label: '预检完成', value: 'previewed' },
      { label: '处理中', value: 'processing' },
      { label: '失败', value: 'failed' },
    ],
    [],
  )

  return (
    <PageShell>
      <PageHeader
        title="导入导出任务记录"
        description="按任务类型、业务模型、状态和格式查看导入导出历史记录，并支持查看任务详情。"
        extra={(
          <Space>
            <Button onClick={() => navigate('/config/data-export')}>返回数据导出</Button>
            <Button onClick={() => navigate('/config/data-import')}>返回数据导入</Button>
          </Space>
        )}
      />
      <PanelCard>
        {error || collectionError ? <Alert type="error" showIcon title={error || collectionError} style={{ marginBottom: 16 }} /> : null}
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => {
            setFilters(values)
            void loadJobs(1, pagination.pageSize, values)
          }}
        >
          <div className="audit-log-filter-grid">
            <Form.Item name="collectionName" label="业务模型">
              <Select allowClear showSearch optionFilterProp="label" loading={collectionLoading} placeholder="全部模型" options={collectionOptions} />
            </Form.Item>
            <Form.Item name="jobType" label="任务类型">
              <Select
                allowClear
                options={[
                  { label: '导出', value: 'export' },
                  { label: '导入预检', value: 'import_preview' },
                  { label: '导入执行', value: 'import_confirm' },
                ]}
                placeholder="全部类型"
              />
            </Form.Item>
            <Form.Item name="status" label="任务状态">
              <Select allowClear options={statusOptions} placeholder="全部状态" />
            </Form.Item>
            <Form.Item name="format" label="文件格式">
              <Select
                allowClear
                options={[
                  { label: 'XLSX', value: 'xlsx' },
                  { label: 'CSV', value: 'csv' },
                  { label: 'JSON', value: 'json' },
                ]}
                placeholder="全部格式"
              />
            </Form.Item>
          </div>
          <div className="audit-log-filter-actions">
            <Space>
              <Button type="primary" htmlType="submit">查询</Button>
              <Button
                onClick={() => {
                  form.resetFields()
                  const nextFilters = {}
                  setFilters(nextFilters)
                  void loadJobs(1, pagination.pageSize, nextFilters)
                }}
              >
                重置
              </Button>
            </Space>
          </div>
        </Form>
      </PanelCard>
      <PanelCard noPadding>
        <ConfigDataTable<TransferJobItem>
          rowKey="jobId"
          loading={loading}
          columns={[
            {
              title: '任务类型',
              dataIndex: 'jobType',
              width: 140,
              render: (value: TransferJobItem['jobType']) => getTransferJobTypeLabel(value),
            },
            {
              title: '业务模型',
              dataIndex: 'collectionName',
              width: 180,
            },
            {
              title: '格式',
              dataIndex: 'format',
              width: 100,
              render: (value: TransferJobItem['format']) => value.toUpperCase(),
            },
            {
              title: '状态',
              dataIndex: 'status',
              width: 140,
              render: (value: TransferJobItem['status']) => <StatusBadge tone={resolveTransferJobStatusTone(value)}>{value || '-'}</StatusBadge>,
            },
            {
              title: '摘要',
              dataIndex: 'summary',
              ellipsis: true,
            },
            {
              title: '创建时间',
              dataIndex: 'createTime',
              width: 180,
              render: (value: number) => formatTransferJobTime(value),
            },
            {
              title: '操作',
              key: 'actions',
              width: 120,
              render: (_, record: TransferJobItem) => (
                <Button type="link" onClick={() => void openDetail(record.jobId)}>
                  详情
                </Button>
              ),
            },
          ]}
          dataSource={jobs}
          scroll={{ x: 1100, y: 560 }}
          serverPagination={{
            state: pagination,
            onChange: (pageNo, pageSize) => void loadJobs(pageNo, pageSize),
          }}
        />
      </PanelCard>
      <TransferJobDetailDrawer open={drawerOpen} loading={detailLoading} job={activeJob} onClose={() => setDrawerOpen(false)} />
    </PageShell>
  )
}
