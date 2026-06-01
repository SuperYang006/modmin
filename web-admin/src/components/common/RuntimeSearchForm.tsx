import { useMemo, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Button, Select, Tooltip } from 'antd'
import { CloseOutlined, DownOutlined, UpOutlined } from '@ant-design/icons'
import type { DictOption, RuntimeField } from '@/types/runtime'
import { renderSearchField } from '@/runtime/registry/componentRegistry'

interface RuntimeSearchFormProps {
  allFields: RuntimeField[]
  fields: RuntimeField[]
  dictMap: Record<string, DictOption[]>
  values: Record<string, string | { start?: string; end?: string }>
  loading?: boolean
  onValueChange: (fieldKey: string, value: string | { start?: string; end?: string }) => void
  onAddField?: (fieldKey: string) => void
  onRemoveField?: (fieldKey: string) => void
  onClear?: () => void
  onSearch?: () => void
}

function isFieldActive(field: RuntimeField, value: string | { start?: string; end?: string } | undefined) {
  if (field.type === 'date' || field.type === 'datetime') {
    return Boolean(value && typeof value === 'object' && (value.start || value.end))
  }
  return String(value || '').trim().length > 0
}

export function RuntimeSearchForm(props: RuntimeSearchFormProps) {
  const { allFields, fields, dictMap, values, loading = false, onValueChange, onAddField, onRemoveField, onClear, onSearch } = props
  const [adderResetKey, setAdderResetKey] = useState(0)
  const [collapsed, setCollapsed] = useState(false)
  const hasSearchFields = fields.length > 0
  const availableFieldOptions = allFields
    .filter((field) => !fields.some((activeField) => activeField.fieldKey === field.fieldKey))
    .map((field) => ({ label: field.label, value: field.fieldKey }))
  const activeFields = useMemo(
    () => fields.filter((field) => isFieldActive(field, values[field.fieldKey])),
    [fields, values],
  )
  const activeCount = activeFields.length

  function clearAll() {
    fields.forEach((field) =>
      onValueChange(field.fieldKey, field.type === 'date' || field.type === 'datetime' ? { start: '', end: '' } : ''),
    )
    onClear?.()
  }

  function handleFiltersKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing || loading) {
      return
    }
    const target = event.target as HTMLElement
    const tag = target.tagName
    if (tag !== 'INPUT' && tag !== 'SELECT') {
      return
    }
    event.preventDefault()
    onSearch?.()
  }

  return (
    <section className={`runtime-search-panel${collapsed ? ' is-collapsed' : ''}`}>
      <div className="runtime-search-panel-head">
        <div className="runtime-search-panel-head-main">
          <strong>筛选条件</strong>
          {activeCount > 0 ? <span className="runtime-search-panel-badge">{activeCount}</span> : null}
          {collapsed && activeCount > 0 ? (
            <span className="runtime-search-panel-summary">
              {activeFields.map((field) => field.label).join('、')}
            </span>
          ) : null}
        </div>
        <div className="runtime-search-panel-head-meta">
          {!collapsed && availableFieldOptions.length > 0 ? (
            <Select
              key={adderResetKey}
              className="runtime-search-field-adder"
              placeholder="+ 添加搜索字段"
              value={undefined}
              options={availableFieldOptions}
              onChange={(fieldKey) => {
                onAddField?.(String(fieldKey))
                setAdderResetKey((prev) => prev + 1)
              }}
            />
          ) : null}
          {hasSearchFields ? (
            <Tooltip title={collapsed ? '展开筛选' : '收起筛选'}>
              <Button
                type="text"
                className="runtime-search-panel-toggle"
                icon={collapsed ? <DownOutlined /> : <UpOutlined />}
                onClick={() => setCollapsed((prev) => !prev)}
              >
                {collapsed ? '展开' : '收起'}
              </Button>
            </Tooltip>
          ) : null}
        </div>
      </div>
      {!collapsed ? (
        hasSearchFields ? (
          <div className="runtime-search-panel-body">
            <div className="runtime-search-grid" onKeyDown={handleFiltersKeyDown}>
              {fields.map((field) => {
                const isRange = field.type === 'date' || field.type === 'datetime'
                return (
                  <div
                    key={field.fieldKey}
                    className={`runtime-search-field-item${isRange ? ' is-range' : ''}`}
                  >
                    <div className="runtime-search-field-header">
                      <span className="runtime-search-field-label">{field.label}</span>
                    </div>
                    {onRemoveField ? (
                      <Tooltip title="移除">
                        <button
                          type="button"
                          className="runtime-search-field-remove"
                          aria-label={`移除 ${field.label}`}
                          onClick={() => onRemoveField(field.fieldKey)}
                        >
                          <CloseOutlined />
                        </button>
                      </Tooltip>
                    ) : null}
                    {renderSearchField({
                      field,
                      value: values[field.fieldKey] ?? '',
                      dictMap,
                      onChange: (value) => onValueChange(field.fieldKey, value),
                    })}
                  </div>
                )
              })}
              <div className="runtime-search-grid-actions">
                {onClear ? (
                  <Button
                    type="text"
                    className="runtime-search-action-ghost"
                    onClick={clearAll}
                    disabled={loading || activeCount === 0}
                  >
                    重置
                  </Button>
                ) : null}
                {onSearch ? (
                  <Button
                    type="primary"
                    className="runtime-search-action-primary"
                    onClick={() => onSearch()}
                    disabled={loading}
                  >
                    查询
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <div className="runtime-search-panel-empty">
            {availableFieldOptions.length > 0 ? '点击右上角"添加搜索字段"开始筛选' : '当前模型未配置搜索字段'}
          </div>
        )
      ) : null}
    </section>
  )
}
