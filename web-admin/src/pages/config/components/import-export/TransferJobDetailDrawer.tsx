import { Alert, Descriptions, Drawer, Empty, Space, Tag } from 'antd'
import { SectionHeader, StatusBadge } from '@/components/ui'
import type { ImportConflictDetail, TransferJobItem } from '@/types/import-export'
import { formatTransferJobTime, getTransferJobTypeLabel, resolveTransferJobStatusTone } from './transferJobMeta'

interface TransferJobDetailDrawerProps {
  open: boolean
  loading?: boolean
  job: TransferJobItem | null
  onClose: () => void
}

function renderIssueList(items?: ImportConflictDetail[]) {
  if (!items?.length) {
    return <Empty description="无明细" image={Empty.PRESENTED_IMAGE_SIMPLE} />
  }

  return (
    <Space orientation="vertical" size={8} style={{ width: '100%' }}>
      {items.map((item, index) => (
        <Alert
          key={`${item.rowNo}_${item.fieldKey || 'field'}_${index}`}
          type="warning"
          showIcon
          title={`第 ${item.rowNo} 行${item.fieldKey ? ` / ${item.fieldKey}` : ''}`}
          description={`${item.message}${item.matchedRecordIds?.length ? `；匹配记录：${item.matchedRecordIds.join('、')}` : ''}`}
        />
      ))}
    </Space>
  )
}

export function TransferJobDetailDrawer(props: TransferJobDetailDrawerProps) {
  const { open, loading = false, job, onClose } = props

  return (
    <Drawer title="任务详情" size={720} open={open} onClose={onClose} loading={loading}>
      {job ? (
        <Space orientation="vertical" size={20} style={{ width: '100%' }}>
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="任务 ID" span={2}>{job.jobId}</Descriptions.Item>
            <Descriptions.Item label="任务类型">{getTransferJobTypeLabel(job.jobType)}</Descriptions.Item>
            <Descriptions.Item label="状态"><StatusBadge tone={resolveTransferJobStatusTone(job.status)}>{job.status || '-'}</StatusBadge></Descriptions.Item>
            <Descriptions.Item label="业务模型">{job.collectionName}</Descriptions.Item>
            <Descriptions.Item label="文件格式">{job.format.toUpperCase()}</Descriptions.Item>
            <Descriptions.Item label="创建时间">{formatTransferJobTime(job.createTime)}</Descriptions.Item>
            <Descriptions.Item label="更新时间">{formatTransferJobTime(job.updateTime)}</Descriptions.Item>
            {job.sourcePreviewJobId ? <Descriptions.Item label="来源预检任务" span={2}>{job.sourcePreviewJobId}</Descriptions.Item> : null}
            <Descriptions.Item label="总行数">{job.totalRows ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="成功行数">{job.successRows ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="失败行数">{job.failedRows ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="摘要" span={2}>{job.summary || '-'}</Descriptions.Item>
            {job.mode ? <Descriptions.Item label="导入模式">{job.mode}</Descriptions.Item> : null}
            {job.matchFieldKey ? <Descriptions.Item label="匹配字段">{job.matchFieldKey}</Descriptions.Item> : null}
            {job.fileMeta?.name ? <Descriptions.Item label="源文件" span={2}>{job.fileMeta.name}</Descriptions.Item> : null}
            {job.fieldKeys?.length ? (
              <Descriptions.Item label="导出字段" span={2}>
                <Space wrap>
                  {job.fieldKeys.map((fieldKey) => <Tag key={fieldKey}>{fieldKey}</Tag>)}
                </Space>
              </Descriptions.Item>
            ) : null}
          </Descriptions>
          {job.detail?.summary ? (
            <Descriptions column={2} bordered size="small" title="结果摘要">
              <Descriptions.Item label="总行数">{job.detail.summary.totalRows}</Descriptions.Item>
              <Descriptions.Item label="有效行数">{job.detail.summary.validRows}</Descriptions.Item>
              <Descriptions.Item label="错误行数">{job.detail.summary.errorRows}</Descriptions.Item>
              <Descriptions.Item label="冲突行数">{job.detail.summary.conflictRows}</Descriptions.Item>
            </Descriptions>
          ) : null}
          {job.detail?.errors ? (
            <div>
              <SectionHeader title="错误明细" />
              {renderIssueList(job.detail.errors)}
            </div>
          ) : null}
          {job.detail?.conflicts ? (
            <div>
              <SectionHeader title="冲突明细" />
              {renderIssueList(job.detail.conflicts)}
            </div>
          ) : null}
        </Space>
      ) : (
        <Empty description="未找到任务详情" />
      )}
    </Drawer>
  )
}
