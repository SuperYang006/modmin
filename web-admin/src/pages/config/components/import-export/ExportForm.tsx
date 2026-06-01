import { useEffect, useMemo, useState } from 'react'
import { App, Alert, Button, Form, Input, Radio, Select, Space } from 'antd'
import { RuntimeSearchForm } from '@/components/common/RuntimeSearchForm'
import { serializeDateFieldValue } from '@/pages/generated/formUtils'
import type { CrudFilterItem, DictOption, RuntimeField } from '@/types/runtime'

interface ExportFormValues {
  collectionName: string
  format: 'xlsx' | 'csv' | 'json'
  fieldKeys: string[]
  fileName?: string
  headerMode: 'label' | 'fieldKey'
  exportScope: 'all' | 'filtered'
  sortField?: string
  sortOrder?: 'asc' | 'desc'
}

type SearchValue = string | { start?: string; end?: string }

interface ExportFormProps {
  loading: boolean
  exporting: boolean
  collectionOptions: Array<{ label: string; value: string }>
  fieldOptions: Array<{ label: string; value: string }>
  fields: RuntimeField[]
  searchFields: RuntimeField[]
  dictMap: Record<string, DictOption[]>
  onCollectionChange: (collectionName: string) => void
  onSubmit: (values: ExportFormValues & { filters: CrudFilterItem[] }) => void
}

function getFilterOperator(field: RuntimeField): CrudFilterItem['operator'] {
  const operator = field.searchConfig?.operator
  if (operator === 'like' || operator === 'gte' || operator === 'lte') {
    return operator
  }
  return 'eq'
}

function buildFilters(fields: RuntimeField[], values: Record<string, SearchValue>): CrudFilterItem[] {
  return fields.reduce<CrudFilterItem[]>((acc, field) => {
    const value = values[field.fieldKey]

    if (field.type === 'date' || field.type === 'datetime') {
      const rangeValue = value && typeof value === 'object' ? value : {}

      if (rangeValue.start) {
        acc.push({
          field: field.fieldKey,
          operator: 'gte',
          value: serializeDateFieldValue(field, rangeValue.start, 'start'),
        })
      }

      if (rangeValue.end) {
        acc.push({
          field: field.fieldKey,
          operator: 'lte',
          value: serializeDateFieldValue(field, rangeValue.end, 'end'),
        })
      }

      return acc
    }

    if (typeof value === 'string' && value.trim()) {
      acc.push({
        field: field.fieldKey,
        operator: getFilterOperator(field),
        value,
      })
    }

    return acc
  }, [])
}

export function ExportForm(props: ExportFormProps) {
  const { message } = App.useApp()
  const { loading, exporting, collectionOptions, fieldOptions, fields, searchFields, dictMap, onCollectionChange, onSubmit } = props
  const [form] = Form.useForm<ExportFormValues>()
  const [searchValues, setSearchValues] = useState<Record<string, SearchValue>>({})
  const [activeSearchFieldKeys, setActiveSearchFieldKeys] = useState<string[]>([])
  const collectionName = Form.useWatch('collectionName', form)
  const exportScope = Form.useWatch('exportScope', form) || 'all'

  const activeSearchFields = useMemo(
    () => searchFields.filter((field) => activeSearchFieldKeys.includes(field.fieldKey)),
    [activeSearchFieldKeys, searchFields],
  )

  useEffect(() => {
    setSearchValues({})
    setActiveSearchFieldKeys([])
  }, [collectionName])

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={{
        format: 'xlsx',
        headerMode: 'label',
        exportScope: 'all',
        sortOrder: 'desc',
      }}
      onValuesChange={(changedValues) => {
        if (typeof changedValues.collectionName === 'string') {
          onCollectionChange(changedValues.collectionName)
          form.setFieldsValue({
            fieldKeys: [],
            exportScope: 'all',
            sortField: undefined,
            sortOrder: 'desc',
            fileName: '',
          })
        }
      }}
      onFinish={(values) => {
        const filters = values.exportScope === 'filtered' ? buildFilters(activeSearchFields, searchValues) : []

        if (values.exportScope === 'filtered' && filters.length === 0) {
          void message.warning('请至少填写一个筛选条件，或切换为导出全部数据')
          return
        }

        onSubmit({ ...values, filters })
      }}
    >
      <Form.Item name="collectionName" label="业务模型" rules={[{ required: true, message: '请选择业务模型' }]}>
        <Select
          loading={loading}
          options={collectionOptions}
          placeholder="请选择需要导出的业务模型"
          showSearch
          optionFilterProp="label"
        />
      </Form.Item>
      <Form.Item name="fieldKeys" label="导出字段" rules={[{ required: true, message: '请至少选择一个字段' }]}>
        <Select
          mode="multiple"
          options={fieldOptions}
          placeholder="请选择导出字段"
          showSearch
          optionFilterProp="label"
        />
      </Form.Item>
      <Space size={16} style={{ width: '100%' }} align="start">
        <Form.Item name="format" label="导出格式" rules={[{ required: true, message: '请选择导出格式' }]} style={{ minWidth: 180 }}>
          <Radio.Group
            options={[
              { label: 'XLSX', value: 'xlsx' },
              { label: 'CSV', value: 'csv' },
              { label: 'JSON', value: 'json' },
            ]}
          />
        </Form.Item>
        <Form.Item name="headerMode" label="表头模式" rules={[{ required: true, message: '请选择表头模式' }]} style={{ minWidth: 220 }}>
          <Radio.Group
            options={[
              { label: '字段标题', value: 'label' },
              { label: '字段 Key', value: 'fieldKey' },
            ]}
          />
        </Form.Item>
      </Space>
      <Form.Item name="exportScope" label="导出范围" rules={[{ required: true, message: '请选择导出范围' }]}>
        <Radio.Group
          options={[
            { label: '全部数据', value: 'all' },
            { label: '按筛选条件导出', value: 'filtered' },
          ]}
        />
      </Form.Item>
      {exportScope === 'filtered' ? (
        searchFields.length > 0 ? (
          <RuntimeSearchForm
            allFields={searchFields}
            fields={activeSearchFields}
            dictMap={dictMap}
            values={searchValues}
            loading={exporting}
            onValueChange={(fieldKey, value) => {
              setSearchValues((prev) => ({ ...prev, [fieldKey]: value }))
            }}
            onAddField={(fieldKey) => {
              setActiveSearchFieldKeys((prev) => prev.includes(fieldKey) ? prev : [...prev, fieldKey])
            }}
            onRemoveField={(fieldKey) => {
              setActiveSearchFieldKeys((prev) => prev.filter((item) => item !== fieldKey))
              setSearchValues((prev) => {
                const next = { ...prev }
                delete next[fieldKey]
                return next
              })
            }}
            onClear={() => setSearchValues({})}
          />
        ) : (
          <Alert
            type="info"
            showIcon
            title="当前模型未配置可用于筛选导出的搜索字段，暂时只能导出全部数据。"
          />
        )
      ) : null}
      <Space size={16} style={{ width: '100%' }} align="start">
        <Form.Item name="sortField" label="排序字段" style={{ minWidth: 220 }}>
          <Select
            allowClear
            options={fields.map((field) => ({ label: field.label, value: field.fieldKey }))}
            placeholder="可选"
            showSearch
            optionFilterProp="label"
          />
        </Form.Item>
        <Form.Item name="sortOrder" label="排序方式" style={{ minWidth: 180 }}>
          <Select
            allowClear
            options={[
              { label: '降序', value: 'desc' },
              { label: '升序', value: 'asc' },
            ]}
          />
        </Form.Item>
      </Space>
      <Form.Item name="fileName" label="文件名">
        <Input placeholder="不填则按模型名称自动生成" />
      </Form.Item>
      <Space>
        <Button type="primary" htmlType="submit" loading={exporting}>
          导出并下载
        </Button>
      </Space>
    </Form>
  )
}
