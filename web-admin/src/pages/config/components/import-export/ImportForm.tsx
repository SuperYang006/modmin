import { useMemo, useState } from 'react'
import { Alert, Button, Checkbox, Form, Radio, Select, Space, Upload, message } from 'antd'
import type { UploadFile } from 'antd/es/upload/interface'
import { DownloadOutlined, InboxOutlined, UploadOutlined } from '@ant-design/icons'
import type { ConfirmImportResult, PreviewImportResult } from '@/types/import-export'
import type { RuntimeField } from '@/types/runtime'

interface ImportFormValues {
  collectionName: string
  format: 'xlsx' | 'csv' | 'json'
  mode: 'createOnly' | 'updateOnly' | 'upsert'
  matchFieldKey?: string
  skipErrorRows?: boolean
}

interface ImportFormProps {
  loading: boolean
  previewing: boolean
  importing: boolean
  collectionOptions: Array<{ label: string; value: string }>
  fields: RuntimeField[]
  onCollectionChange: (collectionName: string) => void
  onDownloadTemplate: (collectionName: string, format: 'xlsx' | 'csv' | 'json') => void
  onPreview: (params: {
    collectionName: string
    format: 'xlsx' | 'csv' | 'json'
    mode: 'createOnly' | 'updateOnly' | 'upsert'
    matchFieldKey?: string
    file: File
  }) => Promise<void>
  onConfirm: (params: ImportFormValues) => Promise<void>
  previewResult: PreviewImportResult | null
  confirmResult: ConfirmImportResult | null
}

const MAX_IMPORT_FILE_SIZE = 10 * 1024 * 1024
const FORMAT_ACCEPT_MAP: Record<ImportFormValues['format'], string> = {
  xlsx: '.xlsx',
  csv: '.csv',
  json: '.json',
}

function getFileExtension(fileName: string) {
  const dotIndex = fileName.lastIndexOf('.')
  return dotIndex >= 0 ? fileName.slice(dotIndex).toLowerCase() : ''
}

export function ImportForm(props: ImportFormProps) {
  const {
    loading,
    previewing,
    importing,
    collectionOptions,
    fields,
    onCollectionChange,
    onDownloadTemplate,
    onPreview,
    onConfirm,
    previewResult,
    confirmResult,
  } = props
  const [form] = Form.useForm<ImportFormValues>()
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const currentFormat = Form.useWatch('format', form) ?? 'xlsx'
  const skipErrorRows = Form.useWatch('skipErrorRows', form) === true

  const matchFieldOptions = useMemo(
    () => [{ label: '_id', value: '_id' }, ...fields.map((field) => ({ label: field.label, value: field.fieldKey }))],
    [fields],
  )

  async function handlePreview() {
    const values = await form.validateFields()
    const rawFile = fileList[0]?.originFileObj

    if (!rawFile) {
      void message.error('请先选择导入文件')
      return
    }

    const expectedExtension = FORMAT_ACCEPT_MAP[values.format]
    const actualExtension = getFileExtension(rawFile.name)
    if (actualExtension !== expectedExtension) {
      void message.error(`当前导入格式为 ${values.format.toUpperCase()}，请重新选择 ${expectedExtension} 文件`)
      return
    }

    await onPreview({
      collectionName: values.collectionName,
      format: values.format,
      mode: values.mode,
      matchFieldKey: values.matchFieldKey,
      file: rawFile,
    })
  }

  async function handleConfirm() {
    const values = await form.validateFields()
    await onConfirm(values)
  }

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={{
        format: 'xlsx',
        mode: 'createOnly',
        matchFieldKey: '_id',
        skipErrorRows: false,
      }}
      onValuesChange={(changedValues, allValues) => {
        if (typeof changedValues.collectionName === 'string') {
          onCollectionChange(changedValues.collectionName)
          setFileList([])
        }
      }}
    >
      <Form.Item name="collectionName" label="业务模型" rules={[{ required: true, message: '请选择业务模型' }]}>
        <Select
          loading={loading}
          options={collectionOptions}
          placeholder="请选择需要导入的业务模型"
          showSearch
          optionFilterProp="label"
        />
      </Form.Item>
      <Space size={16} style={{ width: '100%' }} align="start">
        <Form.Item name="format" label="导入格式" rules={[{ required: true, message: '请选择导入格式' }]} style={{ minWidth: 220 }}>
          <Radio.Group
            options={[
              { label: 'XLSX', value: 'xlsx' },
              { label: 'CSV', value: 'csv' },
              { label: 'JSON', value: 'json' },
            ]}
          />
        </Form.Item>
        <Form.Item name="mode" label="导入模式" rules={[{ required: true, message: '请选择导入模式' }]} style={{ minWidth: 360 }}>
          <Radio.Group
            options={[
              { label: '仅新增', value: 'createOnly' },
              { label: '仅更新', value: 'updateOnly' },
              { label: '有则更新无则新增', value: 'upsert' },
            ]}
          />
        </Form.Item>
      </Space>
      <Form.Item name="matchFieldKey" label="匹配字段">
        <Select
          options={matchFieldOptions}
          placeholder="默认为 _id"
          showSearch
          optionFilterProp="label"
        />
      </Form.Item>
      <div className="import-form-upload-block">
        <Alert
          type="info"
          showIcon
          title="导入限制：单次最多 1000 行，文件大小不超过 10MB。address 按粒度拆列导入，location 仅支持导出。"
        />
        <Upload.Dragger
          accept={FORMAT_ACCEPT_MAP[currentFormat]}
          maxCount={1}
          fileList={fileList}
          beforeUpload={(file) => {
            if (file.size > MAX_IMPORT_FILE_SIZE) {
              void message.error('导入文件不能超过 10MB')
              return Upload.LIST_IGNORE
            }
            const expectedExtension = FORMAT_ACCEPT_MAP[currentFormat]
            const actualExtension = getFileExtension(file.name)
            if (actualExtension !== expectedExtension) {
              void message.error(`当前导入格式为 ${currentFormat.toUpperCase()}，请选择 ${expectedExtension} 文件`)
              return Upload.LIST_IGNORE
            }
            return false
          }}
          onChange={({ fileList: nextFileList }) => {
            setFileList(nextFileList.slice(-1))
          }}
          onRemove={() => {
            setFileList([])
          }}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">点击或拖拽文件到此处</p>
          <p className="ant-upload-hint">支持 `.xlsx`、`.csv`、`.json`</p>
        </Upload.Dragger>
      </div>
      <Space className="import-form-action-row">
        <Button
          icon={<DownloadOutlined />}
          onClick={() => {
            const values = form.getFieldsValue()
            if (!values.collectionName) {
              void message.error('请先选择业务模型')
              return
            }
            onDownloadTemplate(values.collectionName, values.format || 'xlsx')
          }}
        >
          下载模板
        </Button>
        <Button type="primary" icon={<UploadOutlined />} loading={previewing} onClick={() => void handlePreview()}>
          预检导入
        </Button>
        <Button
          disabled={
            !previewResult
            || previewResult.summary.validRows <= 0
            || (
              !skipErrorRows
              && (previewResult.summary.errorRows > 0 || previewResult.summary.conflictRows > 0)
            )
          }
          loading={importing}
          onClick={() => void handleConfirm()}
        >
          确认导入
        </Button>
      </Space>
      <Form.Item name="skipErrorRows" valuePropName="checked">
        <Checkbox>
          跳过错误和冲突行，继续导入有效数据
        </Checkbox>
      </Form.Item>
      {previewResult ? (
        <Alert
          type={previewResult.summary.errorRows > 0 || previewResult.summary.conflictRows > 0 ? 'warning' : 'success'}
          showIcon
          title={`预检完成：共 ${previewResult.summary.totalRows} 行，有效 ${previewResult.summary.validRows} 行，错误 ${previewResult.summary.errorRows} 行，冲突 ${previewResult.summary.conflictRows} 行`}
        />
      ) : null}
      {confirmResult ? (
        <Alert
          type={confirmResult.summary.errorRows > 0 || confirmResult.summary.conflictRows > 0 ? 'warning' : 'success'}
          showIcon
          title={`导入完成：共 ${confirmResult.summary.totalRows} 行，成功 ${confirmResult.summary.validRows} 行，失败 ${confirmResult.summary.errorRows + confirmResult.summary.conflictRows} 行`}
        />
      ) : null}
    </Form>
  )
}
