import { Button, Col, Drawer, Row, Space, Tag } from 'antd'
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
      size={820}
      destroyOnHidden
      placement="right"
      styles={{
        body: { padding: 20, background: 'var(--bg-layout)' },
      }}
      extra={
        <span className="runtime-record-detail-readonly-tag">只读查看</span>
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
      <Space orientation="vertical" size={16} style={{ display: 'flex' }}>
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

        <div className="runtime-record-detail-section">
          <div className="runtime-record-detail-section-head">
            <strong>业务信息</strong>
            <span className="runtime-record-detail-section-tag">当前记录内容</span>
          </div>
          <div className="runtime-record-detail-grid-stack">
            {businessFieldRows.map((row, index) => (
              <div
                key={row.map((field) => field.fieldKey).join('__')}
                className={[
                  'runtime-record-detail-row',
                  index < businessFieldRows.length - 1 ? 'runtime-record-detail-row--bordered' : '',
                  row.length === 1 ? 'runtime-record-detail-row--single' : '',
                ].filter(Boolean).join(' ')}
              >
                {row.map((field) => (
                  <div key={field.fieldKey} className="runtime-record-detail-item">
                    <div className="runtime-record-detail-item-head">
                      <strong>{field.label}</strong>
                      {field.required ? <Tag color="error" variant="filled">必填</Tag> : null}
                    </div>
                    <div className="runtime-record-detail-item-value">
                      {renderDetailFieldValue(field, record[field.fieldKey], dictMap, collectionName)}
                    </div>
                    {field.description ? (
                      <div className="runtime-record-detail-item-desc">{field.description}</div>
                    ) : null}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
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
    return <span className="runtime-record-detail-empty">-</span>
  }

  if (field.type === 'json') {
    const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2)
    return <pre className="runtime-record-detail-json">{text}</pre>
  }

  if (field.type === 'richtext') {
    return renderDisplayField({ field, value, dictMap, mode: 'detail' })
  }

  if (field.type === 'textarea' || field.type === 'markdown') {
    const text = typeof value === 'string' ? value : String(value)
    return <div className="runtime-record-detail-pre">{text}</div>
  }

  return renderDisplayField({ field, value, dictMap, mode: 'detail' })
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
          <span className="runtime-record-form-system-readonly-tag">只读</span>
        </div>
        <div className="runtime-record-form-system-value">
          {renderDisplayField({ field, value, dictMap })}
        </div>
      </div>
    </Col>
  )
}

function isSystemReservedField(fieldKey: string) {
  return fieldKey === '_id' || String(fieldKey).startsWith('modmin_')
}
