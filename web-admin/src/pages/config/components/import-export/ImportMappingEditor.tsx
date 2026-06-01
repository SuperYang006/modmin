import { Alert, Button, Select, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { ImportColumnMapping } from '@/types/import-export'
import type { RuntimeField } from '@/types/runtime'

interface ImportMappingEditorProps {
  mappings: ImportColumnMapping[]
  fields: RuntimeField[]
  previewing: boolean
  unmappedRequiredFields: RuntimeField[]
  onChange: (mappings: ImportColumnMapping[]) => void
  onRepreview: () => void
}

export function ImportMappingEditor(props: ImportMappingEditorProps) {
  const { mappings, fields, previewing, unmappedRequiredFields, onChange, onRepreview } = props

  const fieldOptions = [
    { label: '不导入', value: '' },
    ...fields.map((field) => ({
      label: `${field.label} (${field.fieldKey})`,
      value: field.fieldKey,
    })),
  ]

  const columns: ColumnsType<ImportColumnMapping> = [
    {
      title: '文件列',
      dataIndex: 'columnLabel',
      key: 'columnLabel',
      width: 280,
    },
    {
      title: '映射字段',
      dataIndex: 'fieldKey',
      key: 'fieldKey',
      width: 360,
      render: (value: string, record: ImportColumnMapping) => (
        <Select
          value={value}
          options={fieldOptions}
          style={{ width: '100%' }}
          showSearch
          optionFilterProp="label"
          onChange={(nextValue) => {
            onChange(
              mappings.map((item) =>
                item.columnKey === record.columnKey
                  ? { ...item, fieldKey: String(nextValue || '') }
                  : item,
              ),
            )
          }}
        />
      ),
    },
  ]

  return (
    <>
      <Typography.Text strong>字段映射</Typography.Text>
      <Typography.Paragraph type="secondary">
        如果系统自动识别的映射不正确，可以在这里手动调整，然后重新执行预检。
      </Typography.Paragraph>
      {unmappedRequiredFields.length > 0 ? (
        <Alert
          type="warning"
          showIcon
          title="存在未映射的必填字段"
          description={
            <div>
              {unmappedRequiredFields.map((field) => (
                <Tag key={field.fieldKey} color="warning">
                  {field.label} ({field.fieldKey})
                </Tag>
              ))}
            </div>
          }
        />
      ) : (
        <Alert type="success" showIcon title="必填字段已完成映射，可继续预检或导入。" />
      )}
      <Table
        size="small"
        pagination={false}
        rowKey={(item) => item.columnKey}
        columns={columns}
        dataSource={mappings}
      />
      <Button loading={previewing} onClick={onRepreview}>
        按当前映射重新预检
      </Button>
    </>
  )
}
