import { Alert, Col, Descriptions, Row, Statistic, Table, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { ImportConflictDetail, ImportPreviewSummary } from '@/types/import-export'

interface ImportResultSummaryProps {
  summary: ImportPreviewSummary
  errors: ImportConflictDetail[]
  conflicts: ImportConflictDetail[]
}

const columns: ColumnsType<ImportConflictDetail> = [
  {
    title: '行号',
    dataIndex: 'rowNo',
    key: 'rowNo',
    width: 96,
  },
  {
    title: '字段',
    dataIndex: 'fieldKey',
    key: 'fieldKey',
    width: 160,
    render: (value?: string) => value || '-',
  },
  {
    title: '匹配值',
    dataIndex: 'matchValue',
    key: 'matchValue',
    width: 180,
    ellipsis: true,
    render: (value?: string) => value || '-',
  },
  {
    title: '冲突记录',
    dataIndex: 'matchedRecordIds',
    key: 'matchedRecordIds',
    width: 220,
    render: (value?: string[]) => Array.isArray(value) && value.length > 0 ? value.join(', ') : '-',
  },
  {
    title: '说明',
    dataIndex: 'message',
    key: 'message',
  },
]

export function ImportResultSummary({ summary, errors, conflicts }: ImportResultSummaryProps) {
  const failedRows = summary.errorRows + summary.conflictRows
  const successRate = summary.totalRows > 0 ? `${Math.round((summary.validRows / summary.totalRows) * 100)}%` : '0%'

  return (
    <>
      <Row gutter={16}>
        <Col span={6}>
          <Statistic title="总行数" value={summary.totalRows} />
        </Col>
        <Col span={6}>
          <Statistic title="有效行" value={summary.validRows} valueStyle={{ color: 'var(--color-success)' }} />
        </Col>
        <Col span={6}>
          <Statistic title="失败行" value={failedRows} valueStyle={{ color: failedRows > 0 ? 'var(--color-error)' : 'var(--color-text)' }} />
        </Col>
        <Col span={6}>
          <Statistic title="通过率" value={successRate} />
        </Col>
      </Row>
      <Descriptions
        bordered
        size="small"
        column={2}
        items={[
          { key: 'total', label: '总行数', children: summary.totalRows },
          { key: 'valid', label: '有效行', children: summary.validRows },
          { key: 'error', label: '错误行', children: summary.errorRows },
          { key: 'conflict', label: '冲突行', children: summary.conflictRows },
        ]}
      />
      {failedRows === 0 ? (
        <Alert type="success" showIcon title="当前预检结果全部通过，可以直接确认导入。" />
      ) : (
        <Alert type="warning" showIcon title="存在错误或冲突，请根据下方明细修正后重新预检。" />
      )}
      {errors.length > 0 ? (
        <>
          <Typography.Text strong>校验错误</Typography.Text>
          <Table
            rowKey={(item) => `error_${item.rowNo}_${item.fieldKey || 'na'}_${item.message}`}
            size="small"
            pagination={false}
            columns={columns}
            dataSource={errors}
          />
        </>
      ) : null}
      {conflicts.length > 0 ? (
        <>
          <Typography.Text strong>匹配冲突</Typography.Text>
          <Alert type="warning" showIcon title="存在冲突行，请根据导入行号和已有记录 ID 修正后重试。" />
          <Table
            rowKey={(item) => `conflict_${item.rowNo}_${item.fieldKey || 'na'}_${item.message}`}
            size="small"
            pagination={false}
            columns={columns}
            dataSource={conflicts}
          />
        </>
      ) : null}
    </>
  )
}
