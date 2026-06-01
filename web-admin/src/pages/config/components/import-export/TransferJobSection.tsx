import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Table } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { PanelCard, SectionHeader, StatusBadge } from '@/components/ui'
import { getTransferJobDetail, listTransferJobs } from '@/runtime/loader/importExport'
import type { TransferJobItem } from '@/types/import-export'
import { TransferJobDetailDrawer } from './TransferJobDetailDrawer'
import { formatTransferJobTime, getTransferJobTypeLabel, resolveTransferJobStatusTone } from './transferJobMeta'

interface TransferJobSectionProps {
  title: string
  description: string
  jobTypes: TransferJobItem['jobType'][]
  collectionName?: string
  refreshKey?: number
}

export function TransferJobSection(props: TransferJobSectionProps) {
  const { title, description, jobTypes, collectionName, refreshKey = 0 } = props
  const [loading, setLoading] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState('')
  const [jobs, setJobs] = useState<TransferJobItem[]>([])
  const [activeJob, setActiveJob] = useState<TransferJobItem | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const jobTypeSet = useMemo(() => new Set(jobTypes), [jobTypes])

  useEffect(() => {
    void reload()
  }, [collectionName, refreshKey])

  async function reload() {
    setLoading(true)
    setError('')
    const response = await listTransferJobs({ limit: 20, collectionName })
    setLoading(false)

    if (response.code !== 0) {
      setError(response.message || '加载最近任务失败')
      return
    }

    setJobs(response.data.list.filter((item: TransferJobItem) => jobTypeSet.has(item.jobType)))
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

  return (
    <PanelCard noPadding>
      <div style={{ padding: 20 }}>
        <SectionHeader
          title={title}
          description={description}
          extra={(
            <Button icon={<ReloadOutlined />} onClick={() => void reload()} loading={loading}>
              刷新
            </Button>
          )}
        />
      </div>
      {error ? <Alert type="error" showIcon title={error} style={{ margin: '0 20px 20px' }} /> : null}
      <Table
        rowKey="jobId"
        loading={loading}
        dataSource={jobs}
        locale={{ emptyText: '暂无任务记录' }}
        pagination={false}
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
      />
      <TransferJobDetailDrawer open={drawerOpen} loading={detailLoading} job={activeJob} onClose={() => setDrawerOpen(false)} />
    </PanelCard>
  )
}
