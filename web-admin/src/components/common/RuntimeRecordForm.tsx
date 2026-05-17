import { Alert, Button, Col, Drawer, Form, Row, Space, Tag } from 'antd'
import type { DictOption, RuntimeField } from '@/types/runtime'
import { renderFormField, renderFormFieldTitleAction } from '@/runtime/registry/componentRegistry'

interface RuntimeRecordFormProps {
  visible: boolean
  mode: 'create' | 'edit'
  fields: RuntimeField[]
  dictMap: Record<string, DictOption[]>
  collectionName: string
  values: Record<string, unknown>
  errors: Record<string, string>
  submitError?: string
  submitting?: boolean
  onClose: () => void
  onChange: (fieldKey: string, value: string) => void
  onSubmit: () => void
}

export function RuntimeRecordForm(props: RuntimeRecordFormProps) {
  const { visible, mode, fields, dictMap, collectionName, values, errors, submitError, submitting = false, onClose, onChange, onSubmit } = props
  const systemFields = fields.filter((field) => isSystemReservedField(field.fieldKey))
  const businessFields = fields.filter((field) => !isSystemReservedField(field.fieldKey))
  const errorEntries = Object.entries(errors).filter(([, message]) => Boolean(message))
  const firstErrorFieldKey = errorEntries[0]?.[0] || ''
  const firstErrorField = fields.find((field) => field.fieldKey === firstErrorFieldKey)
  const firstErrorMessage = errorEntries[0]?.[1] || ''

  function scrollToFirstError() {
    if (!firstErrorFieldKey) return
    const target = document.getElementById(`runtime-record-field-${firstErrorFieldKey}`)
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <Drawer
      open={visible}
      title={
        <div className="runtime-record-form-drawer-title">
          <strong>{mode === 'create' ? '新增记录' : '编辑记录'}</strong>
          <span>{mode === 'create' ? '填写并保存一条新数据' : '在当前列表上下文中编辑这条记录'}</span>
        </div>
      }
      onClose={onClose}
      maskClosable={!submitting}
      keyboard={!submitting}
      width={760}
      destroyOnClose
      placement="right"
      styles={{
        body: { padding: 0, overflow: 'hidden' },
      }}
      extra={
        <Tag color={mode === 'create' ? 'processing' : 'blue'} bordered={false}>
          {mode === 'create' ? '新建模式' : '编辑模式'}
        </Tag>
      }
      footer={
        <div className="runtime-record-form-drawer-footer">
          {errorEntries.length > 0 ? (
            <div className="runtime-record-form-error-summary">
              <strong>{errorEntries.length} 个字段需要处理</strong>
              <span>
                {firstErrorField?.label || firstErrorFieldKey}
                {firstErrorMessage ? `：${firstErrorMessage}` : ''}
              </span>
            </div>
          ) : (
            <div className="runtime-record-form-drawer-footer-copy">
              {mode === 'create' ? '创建后会立即出现在当前列表中' : '保存后会刷新当前列表数据'}
            </div>
          )}
          <Space size={10} className="runtime-record-form-drawer-actions">
            {errorEntries.length > 0 ? (
              <Button danger onClick={scrollToFirstError}>
                定位错误
              </Button>
            ) : null}
            <Button onClick={onClose} disabled={submitting}>
              取消
            </Button>
            <Button type="primary" onClick={onSubmit} loading={submitting} disabled={submitting}>
              {submitting ? '保存中' : '保存'}
            </Button>
          </Space>
        </div>
      }
    >
      <div className="runtime-record-form-body">
        <Form layout="vertical" className="runtime-record-form-shell">
          {submitError ? (
            <Alert
              type="error"
              showIcon
              message={submitError}
              style={{ marginBottom: 16 }}
            />
          ) : null}
          {systemFields.length > 0 ? (
            <div className="runtime-record-form-system-block">
              <div className="runtime-record-form-system-head">
                <strong>系统字段</strong>
                <span>自动维护，只读显示</span>
              </div>
              <Row gutter={[12, 10]}>
                {systemFields.map((field) => renderReadonlySystemField(field, values[field.fieldKey]))}
              </Row>
            </div>
          ) : null}
          <Row gutter={[0, 12]}>
            {businessFields.map((field) => renderFieldItem(field, mode, values, dictMap, collectionName, errors, onChange, false, submitting))}
          </Row>
        </Form>
      </div>
    </Drawer>
  )
}

function renderFieldItem(
  field: RuntimeField,
  mode: 'create' | 'edit',
  values: Record<string, unknown>,
  dictMap: Record<string, DictOption[]>,
  collectionName: string,
  errors: Record<string, string>,
  onChange: (fieldKey: string, value: string) => void,
  compact = false,
  submitting = false,
) {
  const configuredReadonly =
    field.readonly === true ||
    (mode === 'create' ? field.formConfig?.readonlyOnCreate === true : field.formConfig?.readonlyOnEdit === true)
  const readonly = submitting || configuredReadonly
  const itemCountTag = !compact ? buildItemCountTagText(field) : ''
  const fileSizeTag = !compact ? buildFileSizeTagText(field) : ''

  return (
    <Col
      key={field.fieldKey}
      id={`runtime-record-field-${field.fieldKey}`}
      span={24}
      className={`${compact ? 'runtime-record-form-item-compact' : ''}${errors[field.fieldKey] ? ' runtime-record-form-item-error' : ''}`.trim() || undefined}
    >
      <div
        style={{
          marginBottom: compact ? 2 : 8,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 500 }}>{field.label}</span>
        {!compact && field.required === true ? <Tag color="error" bordered={false}>必填</Tag> : null}
        {itemCountTag ? <Tag color="processing" bordered={false}>{itemCountTag}</Tag> : null}
        {fileSizeTag ? <Tag color="processing" bordered={false}>{fileSizeTag}</Tag> : null}
        {!compact ? renderFormFieldTitleAction(field, values[field.fieldKey] ?? '') : null}
        {!compact && isSystemReservedField(field.fieldKey) ? <Tag color="default">系统保留</Tag> : null}
        {configuredReadonly ? <Tag color="blue">{compact ? '只读' : '不可编辑'}</Tag> : null}
      </div>
      <Form.Item
        required={field.required === true}
        validateStatus={errors[field.fieldKey] ? 'error' : undefined}
        help={errors[field.fieldKey]}
        style={{ marginBottom: 0 }}
      >
        {renderFormField({
          field,
          value: values[field.fieldKey] ?? '',
          dictMap,
          collectionName,
          onChange: (value) => onChange(field.fieldKey, value),
          readonly,
        })}
      </Form.Item>
    </Col>
  )
}

const ITEM_COUNT_TYPES = new Set(['array', 'multiRelation', 'multiPolyRelation'])
const ASSET_TYPES = new Set(['image', 'file', 'video', 'audio'])

function buildItemCountTagText(field: RuntimeField) {
  const isCollection = ITEM_COUNT_TYPES.has(field.type) || (ASSET_TYPES.has(field.type) && field.allowMultiple === true)
  if (!isCollection) {
    return ''
  }
  const min = typeof field.minItems === 'number' ? field.minItems : null
  const max = typeof field.maxItems === 'number' ? field.maxItems : null
  if (min !== null && max !== null) {
    return min === max ? `需 ${min} 项` : `${min}~${max} 项`
  }
  if (min !== null) {
    return `至少 ${min} 项`
  }
  if (max !== null) {
    return `最多 ${max} 项`
  }
  return ''
}

function buildFileSizeTagText(field: RuntimeField) {
  if (!ASSET_TYPES.has(field.type)) {
    return ''
  }
  if (typeof field.maxFileSizeMB !== 'number' || field.maxFileSizeMB <= 0) {
    return ''
  }
  return `单文件 ≤ ${field.maxFileSizeMB}MB`
}

function renderReadonlySystemField(field: RuntimeField, value: unknown) {
  return (
    <Col key={field.fieldKey} xs={24} md={12}>
      <div className="runtime-record-form-system-cell">
        <div className="runtime-record-form-system-label-row">
          <span className="runtime-record-form-system-label">{field.label}</span>
          <Tag color="blue">只读</Tag>
        </div>
        <div className="runtime-record-form-system-value" title={formatReadonlyValue(field, value)}>
          {formatReadonlyValue(field, value)}
        </div>
      </div>
    </Col>
  )
}

function formatReadonlyValue(field: RuntimeField, value: unknown) {
  if (value === null || value === undefined || value === '') {
    return '-'
  }

  if (field.type === 'date' || field.type === 'datetime') {
    return formatDateValue(value, field.type, field.dateStorageFormat)
  }

  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      return '[object]'
    }
  }

  return String(value)
}

function formatDateValue(value: unknown, type: 'date' | 'datetime', storageFormat?: RuntimeField['dateStorageFormat']) {
  const nextStorageFormat = storageFormat || 'string'
  let date: Date | null = null

  if (nextStorageFormat === 'timestamp' || nextStorageFormat === 'timestampMs') {
    const rawNumber = typeof value === 'number' ? value : Number(String(value).trim())

    if (!Number.isNaN(rawNumber)) {
      date = new Date(nextStorageFormat === 'timestamp' ? rawNumber * 1000 : rawNumber)
    }
  } else if (typeof value === 'string') {
    const trimmed = value.trim()

    if (/^\d+$/.test(trimmed)) {
      const rawNumber = Number(trimmed)
      date = new Date(trimmed.length <= 10 ? rawNumber * 1000 : rawNumber)
    } else {
      const normalized = trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T')
      date = new Date(normalized)
    }
  } else if (value instanceof Date) {
    date = value
  }

  if (!date || Number.isNaN(date.getTime())) {
    return String(value)
  }

  if (type === 'date') {
    return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`
  }

  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function isSystemReservedField(fieldKey: string) {
  return fieldKey === '_id' || String(fieldKey).startsWith('modmin_')
}
