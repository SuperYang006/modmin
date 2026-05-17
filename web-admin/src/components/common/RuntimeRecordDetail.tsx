import { Button, Card, Col, Drawer, Row, Space, Tag } from 'antd'
import type { DictOption, RuntimeField } from '@/types/runtime'
import { renderDisplayField, renderFormField } from '@/runtime/registry/componentRegistry'

interface RuntimeRecordDetailProps {
  visible: boolean
  fields: RuntimeField[]
  dictMap: Record<string, DictOption[]>
  record: Record<string, unknown> | null
  collectionName: string
  onClose: () => void
  onEdit?: () => void
}

const ASSET_TYPES = new Set(['image', 'file', 'video', 'audio'])

const LONG_CONTENT_TYPES = new Set([
  'textarea',
  'richtext',
  'markdown',
  'json',
  'array',
  'location',
  'address',
  'relationMany',
  'multiRelation',
  'polyRelation',
  'multiPolyRelation',
  'image',
  'file',
  'video',
  'audio',
])

export function RuntimeRecordDetail(props: RuntimeRecordDetailProps) {
  const { visible, fields, dictMap, record, collectionName, onClose, onEdit } = props

  if (!visible || !record) {
    return null
  }

  const systemFields = fields.filter((field) => isSystemReservedField(field.fieldKey))
  const businessFields = fields.filter((field) => !isSystemReservedField(field.fieldKey))
  const businessFieldRows = buildFieldRows(businessFields)
  return (
    <Drawer
      open={visible}
      title={
        <div className="runtime-record-detail-drawer-title">
          <strong>记录详情</strong>
          <span>{typeof record._id === 'string' ? record._id : '查看当前记录的完整信息'}</span>
        </div>
      }
      onClose={onClose}
      width={820}
      destroyOnClose
      placement="right"
      styles={{
        body: {
          padding: 20,
          background: '#f6f8fb',
        },
      }}
      extra={
        <Tag color="default" bordered={false} style={{ borderRadius: 999, paddingInline: 10 }}>
          只读查看
        </Tag>
      }
      footer={
        <div className="runtime-record-detail-drawer-footer">
          <div className="runtime-record-detail-drawer-footer-copy">
            支持直接查看系统字段与业务字段详情
          </div>
          <Space size={10}>
            <Button onClick={onClose}>关闭</Button>
            {onEdit ? (
              <Button type="primary" onClick={onEdit}>
                编辑
              </Button>
            ) : null}
          </Space>
        </div>
      }
    >
      <Space direction="vertical" size={16} style={{ display: 'flex' }}>
        {systemFields.length > 0 ? (
          <div className="runtime-record-form-system-block">
            <div className="runtime-record-form-system-head">
              <strong>系统字段</strong>
              <span>自动维护，只读显示</span>
            </div>
            <Row gutter={[12, 10]}>
              {systemFields.map((field) => renderReadonlySystemField(field, record[field.fieldKey], dictMap))}
            </Row>
          </div>
        ) : null}

        <Card
          title={
            <Space size={8}>
            <span>业务信息</span>
            <Tag color="processing" bordered={false}>当前记录内容</Tag>
          </Space>
          }
          bordered={false}
          style={{ borderRadius: 18, boxShadow: '0 10px 30px rgba(15, 23, 42, 0.06)' }}
          bodyStyle={{ padding: 20 }}
        >
          <div style={{ display: 'grid', gap: 14 }}>
            {businessFieldRows.map((row, index) => (
              <div
                key={row.map((field) => field.fieldKey).join('__')}
                style={{
                  display: 'grid',
                  gridTemplateColumns: row.length === 1 ? 'minmax(0, 1fr)' : 'repeat(2, minmax(0, 1fr))',
                  gap: 14,
                  paddingBottom: index < businessFieldRows.length - 1 ? 14 : 0,
                  borderBottom: index < businessFieldRows.length - 1 ? '1px solid #eef2f7' : 'none',
                }}
              >
                {row.map((field) => (
                  <div key={field.fieldKey} style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                      <span style={{ color: '#475569', fontWeight: 600 }}>{field.label}</span>
                      {field.required ? <Tag color="error" bordered={false}>必填</Tag> : null}
                    </div>
                    <div
                      style={{
                        minHeight: 22,
                        color: '#0f172a',
                        lineHeight: 1.75,
                        wordBreak: 'break-word',
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {renderDetailFieldValue(field, record[field.fieldKey], dictMap, collectionName)}
                    </div>
                    {field.description ? (
                      <div style={{ marginTop: 6, color: '#94a3b8', fontSize: 12, lineHeight: 1.6 }}>
                        {field.description}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Card>
      </Space>
    </Drawer>
  )
}

function buildFieldRows(fields: RuntimeField[]) {
  const rows: RuntimeField[][] = []
  let pendingShortFields: RuntimeField[] = []

  function flushPending() {
    if (pendingShortFields.length > 0) {
      rows.push(pendingShortFields)
      pendingShortFields = []
    }
  }

  for (const field of fields) {
    if (isLongContentField(field)) {
      flushPending()
      rows.push([field])
      continue
    }

    pendingShortFields.push(field)

    if (pendingShortFields.length === 2) {
      rows.push(pendingShortFields)
      pendingShortFields = []
    }
  }

  flushPending()
  return rows
}

function isLongContentField(field: RuntimeField) {
  return LONG_CONTENT_TYPES.has(field.type)
}

function renderDetailFieldValue(
  field: RuntimeField,
  value: unknown,
  dictMap: Record<string, DictOption[]>,
  collectionName: string,
) {
  if (ASSET_TYPES.has(field.type)) {
    return renderFormField({
      field: { ...field, label: '', readonly: true },
      value,
      dictMap,
      collectionName,
      onChange: () => {},
    })
  }

  if (value === null || value === undefined || value === '') {
    return <span style={{ color: '#94a3b8' }}>-</span>
  }

  if (field.type === 'json') {
    const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2)

    return (
      <pre
        style={{
          margin: 0,
          padding: '12px 14px',
          borderRadius: 12,
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          color: '#0f172a',
          fontSize: 13,
          lineHeight: 1.65,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          overflowWrap: 'anywhere',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        }}
      >
        {text}
      </pre>
    )
  }

  if (field.type === 'richtext') {
    return renderDisplayField({
      field,
      value,
      dictMap,
      mode: 'detail',
    })
  }

  if (field.type === 'textarea' || field.type === 'markdown') {
    const text = typeof value === 'string' ? value : String(value)

    return (
      <div
        style={{
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          overflowWrap: 'anywhere',
          lineHeight: 1.75,
        }}
      >
        {text}
      </div>
    )
  }

  return renderDisplayField({
    field,
    value,
    dictMap,
    mode: 'detail',
  })
}

function renderReadonlySystemField(
  field: RuntimeField,
  value: unknown,
  dictMap: Record<string, DictOption[]>,
) {
  return (
    <Col key={field.fieldKey} xs={24} md={12}>
      <div className="runtime-record-form-system-cell">
        <div className="runtime-record-form-system-label-row">
          <span className="runtime-record-form-system-label">{field.label}</span>
          <Tag color="blue">只读</Tag>
        </div>
        <div className="runtime-record-form-system-value">
          {renderDisplayField({
            field,
            value,
            dictMap,
          })}
        </div>
      </div>
    </Col>
  )
}

function isSystemReservedField(fieldKey: string) {
  return fieldKey === '_id' || String(fieldKey).startsWith('modmin_')
}
