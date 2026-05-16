import { useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Button, Select, Space, Tooltip } from 'antd'
import { DownOutlined, UpOutlined } from '@ant-design/icons'
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
  onRefresh?: () => void
}

export function RuntimeSearchForm(props: RuntimeSearchFormProps) {
  const { allFields, fields, dictMap, values, loading = false, onValueChange, onAddField, onRemoveField, onClear, onSearch, onRefresh } = props
  const [adderResetKey, setAdderResetKey] = useState(0)
  const [collapsed, setCollapsed] = useState(false)
  const hasSearchFields = fields.length > 0
  const availableFieldOptions = allFields
    .filter((field) => !fields.some((activeField) => activeField.fieldKey === field.fieldKey))
    .map((field) => ({
      label: field.label,
      value: field.fieldKey,
    }))
  const activeCount = hasSearchFields
    ? fields.filter((field) => {
        const value = values[field.fieldKey]

        if (field.type === 'date' || field.type === 'datetime') {
          return Boolean(value && typeof value === 'object' && (value.start || value.end))
        }

        return String(value || '').trim().length > 0
      }).length
    : 0
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
    if (target.tagName === 'TEXTAREA') {
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
          {activeCount > 0 ? (
            <span className="runtime-search-panel-badge">{activeCount} 项</span>
          ) : null}
        </div>
        <div className="runtime-search-panel-head-meta">
          {!collapsed && availableFieldOptions.length > 0 ? (
            <Select
              key={adderResetKey}
              className="runtime-search-field-adder"
              placeholder="添加搜索字段"
              value={undefined}
              options={availableFieldOptions}
              onChange={(fieldKey) => {
                onAddField?.(String(fieldKey))
                setAdderResetKey((prev) => prev + 1)
              }}
            />
          ) : null}
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
        </div>
      </div>
      {!collapsed ? (
        hasSearchFields ? (
          <div className="runtime-search-panel-body">
            <div
              className="runtime-search-panel-filters generated-search-grid runtime-search-grid"
              onKeyDown={handleFiltersKeyDown}
            >
              {fields.map((field) => (
                <div key={field.fieldKey} className="runtime-search-field-item">
                  {onRemoveField ? (
                    <button type="button" className="runtime-search-field-remove" onClick={() => onRemoveField(field.fieldKey)}>
                      移除
                    </button>
                  ) : null}
                  {renderSearchField({
                    field,
                    value: values[field.fieldKey] ?? '',
                    dictMap,
                    onChange: (value) => onValueChange(field.fieldKey, value),
                  })}
                </div>
              ))}
              <Space size={8} wrap className="runtime-search-panel-actions runtime-search-panel-actions-inline">
                <Button type="primary" className="runtime-search-action-primary" onClick={() => onSearch?.()} disabled={loading}>
                  查询
                </Button>
                <Button className="runtime-search-action-secondary" onClick={() => onRefresh?.()} disabled={loading}>
                  刷新
                </Button>
                <Button type="text" className="runtime-search-action-ghost" onClick={clearAll} disabled={loading || activeCount === 0}>
                  清空
                </Button>
              </Space>
            </div>
          </div>
        ) : (
          <div className="runtime-search-panel-empty">
            当前模型未配置搜索字段
          </div>
        )
      ) : null}
    </section>
  )
}
