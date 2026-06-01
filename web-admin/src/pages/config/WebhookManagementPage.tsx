import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Drawer, Form, Input, InputNumber, Modal, Select, Space, Tag, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { PageShell, PageHeader, PanelCard, ConfigDataTable } from '@/components/ui'
import { listCollectionSchemas } from '@/runtime/loader/listCollectionSchemas'
import { deleteWebhook, listWebhooks, saveWebhook, testWebhook } from '@/runtime/loader/webhooks'
import type { SaveWebhookPayload, WebhookItem } from '@/types/schema'
import { getWebhookEventLabel, getWebhookTargetSummary } from './webhookPageShared'

const EVENT_OPTIONS = [
  { label: '创建记录', value: 'record.create' },
  { label: '更新记录', value: 'record.update' },
  { label: '删除记录', value: 'record.delete' },
]

function parseHeaders(text: string) {
  if (!text.trim()) return {}
  return JSON.parse(text)
}

function parseJsonObject(text: string, fieldLabel: string) {
  if (!text.trim()) return {}
  const parsed = JSON.parse(text)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${fieldLabel} 必须是 JSON 对象`)
  }
  return parsed
}

export function WebhookManagementPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState('')
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([])
  const [collectionOptions, setCollectionOptions] = useState<Array<{ label: string; value: string }>>([])
  const [filterTargetType, setFilterTargetType] = useState('')
  const [filterCollectionName, setFilterCollectionName] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<WebhookItem | null>(null)
  const [form] = Form.useForm()

  function getCollectionLabel(collectionName: string) {
    return collectionOptions.find((item) => item.value === collectionName)?.label || collectionName
  }

  useEffect(() => {
    void reloadData()
  }, [])

  const filteredWebhooks = useMemo(
    () =>
      webhooks.filter((item) => {
        if (filterTargetType && item.targetType !== filterTargetType) {
          return false
        }
        if (filterCollectionName && item.collectionName !== filterCollectionName) {
          return false
        }
        return true
      }),
    [webhooks, filterTargetType, filterCollectionName],
  )

  function handleSearch(values?: { targetType?: string; collectionName?: string }) {
    setFilterTargetType(values?.targetType || '')
    setFilterCollectionName(values?.collectionName || '')
  }

  function handleReset() {
    form.resetFields()
    setFilterTargetType('')
    setFilterCollectionName('')
  }

  async function reloadData() {
    setLoading(true)
    setError('')
    const [webhookRes, collectionRes] = await Promise.all([listWebhooks(), listCollectionSchemas()])
    setLoading(false)

    if (webhookRes.code !== 0) {
      setError(webhookRes.message || '加载 Webhook 列表失败')
      return
    }

    setWebhooks(webhookRes.data.list)

    if (collectionRes.code === 0) {
      setCollectionOptions(collectionRes.data.list.map((item) => ({
        label: `${item.modelName || item.collectionName} (${item.collectionName})`,
        value: item.collectionName,
      })))
    }
  }

  function handleCreate() {
    setEditingItem(null)
    form.resetFields()
    form.setFieldsValue({
      status: 'enabled',
      targetType: 'http',
      events: ['record.create'],
      extraParamsText: '{}',
      httpConfig: { timeoutMs: 3000, headersText: '{}' },
      cloudFunctionConfig: { action: 'handleModminWebhook', timeoutMs: 3000 },
      retryConfig: { maxAttempts: 3, backoffSeconds: 60 },
    })
    setDrawerOpen(true)
  }

  function handleEdit(item: WebhookItem) {
    setEditingItem(item)
    form.setFieldsValue({
      webhookId: item.webhookId,
      name: item.name,
      description: item.description,
      status: item.status,
      events: item.events,
      collectionName: item.collectionName,
      targetType: item.targetType,
      extraParamsText: JSON.stringify(item.extraParams || {}, null, 2),
      httpConfig: {
        url: item.httpConfig?.url || '',
        headersText: JSON.stringify(item.httpConfig?.headers || {}, null, 2),
        secret: '',
        timeoutMs: item.httpConfig?.timeoutMs || 3000,
      },
      cloudFunctionConfig: {
        functionName: item.cloudFunctionConfig?.functionName || '',
        action: item.cloudFunctionConfig?.action || 'handleModminWebhook',
        timeoutMs: item.cloudFunctionConfig?.timeoutMs || 3000,
      },
      retryConfig: {
        maxAttempts: item.retryConfig?.maxAttempts || 3,
        backoffSeconds: item.retryConfig?.backoffSeconds || 60,
      },
    })
    setDrawerOpen(true)
  }

  async function submit(runTest: boolean) {
    let values: Record<string, any>
    try {
      values = await form.validateFields()
    } catch {
      return
    }

    let headers = {}
    let extraParams = {}
    try {
      headers = parseHeaders(values.httpConfig?.headersText || '{}')
    } catch {
      void message.error('HTTP 请求头必须是合法 JSON')
      return
    }

    try {
      extraParams = parseJsonObject(values.extraParamsText || '{}', '额外入参')
    } catch (error) {
      void message.error(error instanceof Error ? error.message : '额外入参必须是合法 JSON')
      return
    }

    const payload: SaveWebhookPayload = {
      webhookId: values.webhookId,
      name: values.name,
      description: values.description || '',
      status: values.status,
      events: values.events || [],
      collectionName: values.collectionName,
      targetType: values.targetType,
      extraParams,
      httpConfig: {
        url: values.httpConfig?.url || '',
        headers,
        secret: values.httpConfig?.secret || undefined,
        timeoutMs: Number(values.httpConfig?.timeoutMs || 3000),
      },
      cloudFunctionConfig: {
        functionName: values.cloudFunctionConfig?.functionName || '',
        action: values.cloudFunctionConfig?.action || 'handleModminWebhook',
        timeoutMs: Number(values.cloudFunctionConfig?.timeoutMs || 3000),
      },
      retryConfig: {
        maxAttempts: Number(values.retryConfig?.maxAttempts || 3),
        backoffSeconds: Number(values.retryConfig?.backoffSeconds || 60),
      },
    }

    if (runTest) {
      setTesting(true)
      const res = await testWebhook(payload)
      setTesting(false)
      if (res.code !== 0) {
        void message.error(res.message || '测试投递失败')
        return
      }
      void message.success('测试投递成功')
      return
    }

    setSaving(true)
    const res = await saveWebhook(payload)
    setSaving(false)

    if (res.code !== 0 || !res.data.item) {
      void message.error(res.message || '保存失败')
      return
    }

    const nextItem = res.data.item
    setWebhooks((prev) => {
      const exists = prev.some((entry) => entry.webhookId === nextItem.webhookId)
      return exists
        ? prev.map((entry) => (entry.webhookId === nextItem.webhookId ? nextItem : entry))
        : [nextItem, ...prev]
    })
    setDrawerOpen(false)
    void message.success(editingItem ? '更新成功' : '创建成功')
  }

  async function handleDelete(item: WebhookItem) {
    Modal.confirm({
      title: `确定删除 Webhook「${item.name}」吗？`,
      content: '删除后该 Webhook 将不再匹配和触发，历史投递记录仍会保留。',
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        const res = await deleteWebhook(item.webhookId)
        if (res.code !== 0) {
          void message.error(res.message || '删除失败')
          return
        }
        setWebhooks((prev) => prev.filter((entry) => entry.webhookId !== item.webhookId))
        void message.success('删除成功')
      },
    })
  }

  const columns: ColumnsType<WebhookItem> = [
    { title: '名称', dataIndex: 'name', key: 'name', width: 180 },
    { title: '模型', dataIndex: 'collectionName', key: 'collectionName', width: 220, render: (value: string) => getCollectionLabel(value) },
    { title: '事件', dataIndex: 'events', key: 'events', render: (value: string[]) => (value || []).map((item) => getWebhookEventLabel(item)).join('、') || '-' },
    {
      title: '目标类型',
      dataIndex: 'targetType',
      key: 'targetType',
      width: 100,
      render: (value: string) => value === 'http' ? <Tag color="blue">HTTPS</Tag> : <Tag color="purple">云函数</Tag>,
    },
    { title: '目标摘要', key: 'targetSummary', width: 260, render: (_value: unknown, record) => getWebhookTargetSummary(record) },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (value: string) => value === 'enabled' ? <Tag color="success">启用</Tag> : <Tag>停用</Tag>,
    },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      fixed: 'right',
      render: (_value: unknown, record) => (
        <Space size={4}>
          <Button size="small" type="primary" onClick={() => handleEdit(record)}>编辑</Button>
          <Button size="small" danger onClick={() => void handleDelete(record)}>删除</Button>
        </Space>
      ),
    },
  ]

  return (
    <PageShell>
      <PageHeader
        title="Webhook 配置"
        description="配置业务数据变更后的 HTTPS 或云函数回调。"
        extra={<Button type="primary" onClick={handleCreate}>新建 Webhook</Button>}
      />
      <PanelCard>
        {error ? <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} /> : null}
        <Form form={form} layout="vertical" className="audit-log-filter-form" onFinish={(values) => handleSearch(values)}>
          <div className="audit-log-filter-grid">
            <Form.Item name="targetType" label="目标类型">
              <Select
                allowClear
                placeholder="全部目标类型"
                options={[
                  { label: 'HTTPS', value: 'http' },
                  { label: '云函数', value: 'cloudFunction' },
                ]}
              />
            </Form.Item>
            <Form.Item name="collectionName" label="模型">
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder="筛选模型"
                options={collectionOptions}
              />
            </Form.Item>
          </div>
          <div className="audit-log-filter-actions">
            <Space>
              <Button type="primary" htmlType="submit">查询</Button>
              <Button onClick={handleReset}>重置</Button>
            </Space>
          </div>
        </Form>
      </PanelCard>
      <PanelCard noPadding>
        <ConfigDataTable<WebhookItem>
          rowKey="webhookId"
          loading={loading}
          columns={columns}
          dataSource={filteredWebhooks}
          scroll={{ x: 1200, y: 520 }}
          pagination={{
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            showTotal: (total) => `共 ${total} 条`,
          }}
        />
      </PanelCard>

      <Drawer
        title={editingItem ? '编辑 Webhook' : '新建 Webhook'}
        open={drawerOpen}
        size={640}
        onClose={() => setDrawerOpen(false)}
        footer={
          <Space style={{ justifyContent: 'space-between', width: '100%' }}>
            <Button loading={testing} onClick={() => void submit(true)}>测试投递</Button>
            <Space>
              <Button onClick={() => setDrawerOpen(false)}>取消</Button>
              <Button type="primary" loading={saving} onClick={() => void submit(false)}>保存</Button>
            </Space>
          </Space>
        }
      >
        <Form form={form} layout="vertical">
          <Form.Item name="webhookId" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select options={[{ label: '启用', value: 'enabled' }, { label: '停用', value: 'disabled' }]} />
          </Form.Item>
          <Form.Item name="events" label="订阅事件" rules={[{ required: true, message: '请选择事件' }]}>
            <Select mode="multiple" options={EVENT_OPTIONS} />
          </Form.Item>
          <Form.Item name="collectionName" label="适用模型" rules={[{ required: true, message: '请选择模型' }]}>
            <Select showSearch optionFilterProp="label" options={collectionOptions} />
          </Form.Item>
          <Form.Item name="targetType" label="目标类型" rules={[{ required: true, message: '请选择目标类型' }]}>
            <Select options={[{ label: 'HTTPS', value: 'http' }, { label: '云函数', value: 'cloudFunction' }]} />
          </Form.Item>
          <Form.Item name="extraParamsText" label="额外入参（JSON）">
            <Input.TextArea rows={4} placeholder='{"tenantId":"t_001"}' />
          </Form.Item>
          <Form.Item shouldUpdate noStyle>
            {({ getFieldValue }) =>
              getFieldValue('targetType') === 'cloudFunction' ? (
                <>
                  <Form.Item name={['cloudFunctionConfig', 'functionName']} label="云函数名称" rules={[{ required: true, message: '请输入云函数名称' }]}>
                    <Input placeholder="如 article_sync_handler" />
                  </Form.Item>
                  <Form.Item name={['cloudFunctionConfig', 'action']} label="action">
                    <Input placeholder="handleModminWebhook" />
                  </Form.Item>
                  <Form.Item name={['cloudFunctionConfig', 'timeoutMs']} label="超时（毫秒）">
                    <InputNumber min={1000} max={10000} style={{ width: '100%' }} />
                  </Form.Item>
                </>
              ) : (
                <>
                  <Form.Item name={['httpConfig', 'url']} label="HTTPS 地址" rules={[{ required: true, message: '请输入 HTTPS 地址' }]}>
                    <Input placeholder="https://example.com/webhook" />
                  </Form.Item>
                  <Form.Item name={['httpConfig', 'headersText']} label="自定义请求头（JSON）">
                    <Input.TextArea rows={4} placeholder='{"X-Token":"demo"}' />
                  </Form.Item>
                  <Form.Item name={['httpConfig', 'secret']} label="签名 Secret">
                    <Input.Password placeholder={editingItem?.httpConfig?.secret ? '留空表示不修改当前 Secret' : '可选'} />
                  </Form.Item>
                  <Form.Item name={['httpConfig', 'timeoutMs']} label="超时（毫秒）">
                    <InputNumber min={1000} max={10000} style={{ width: '100%' }} />
                  </Form.Item>
                </>
              )
            }
          </Form.Item>
          <Form.Item name={['retryConfig', 'maxAttempts']} label="最大尝试次数">
            <InputNumber min={1} max={10} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name={['retryConfig', 'backoffSeconds']} label="重试间隔（秒）">
            <InputNumber min={10} max={3600} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Drawer>
    </PageShell>
  )
}
