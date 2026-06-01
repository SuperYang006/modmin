import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, DatePicker, Drawer, Empty, Form, Select, Space, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { useLocation, useNavigate } from 'react-router-dom'
import { PageShell, PageHeader, PanelCard, ConfigDataTable } from '@/components/ui'
import { listWebhooks, listWebhookDeliveries, processPendingWebhookDeliveries, retryWebhookDelivery } from '@/runtime/loader/webhooks'
import type { WebhookDeliveryItem, WebhookItem } from '@/types/schema'
import { DELIVERY_STATUS_META, WEBHOOK_EVENT_LABEL_MAP, getWebhookEventLabel, getWebhookTargetSummary, renderDeliveryStatus } from './webhookPageShared'

function useWebhookId() {
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  return params.get('webhookId') || ''
}

export function WebhookDeliveriesPage() {
  const navigate = useNavigate()
  const webhookId = useWebhookId()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([])
  const [selectedWebhookId, setSelectedWebhookId] = useState(webhookId)
  const [selectedEventType, setSelectedEventType] = useState('')
  const [selectedTimeRange, setSelectedTimeRange] = useState<[number, number] | null>(null)
  const [processing, setProcessing] = useState(false)
  const [deliveries, setDeliveries] = useState<WebhookDeliveryItem[]>([])
  const [pagination, setPagination] = useState({ pageNo: 1, pageSize: 20, total: 0 })
  const [detail, setDetail] = useState<WebhookDeliveryItem | null>(null)
  const [form] = Form.useForm()

  const webhookMap = useMemo(
    () => new Map(webhooks.map((item) => [item.webhookId, item])),
    [webhooks],
  )

  useEffect(() => {
    setSelectedWebhookId(webhookId)
    form.setFieldsValue({ webhookId: webhookId || undefined })
  }, [webhookId])

  useEffect(() => {
    void loadWebhooks()
  }, [])

  useEffect(() => {
    void loadDeliveries(1, pagination.pageSize, selectedWebhookId)
  }, [selectedWebhookId, selectedEventType, selectedTimeRange])

  async function loadWebhooks() {
    const res = await listWebhooks()
    if (res.code !== 0) {
      setError(res.message || '加载 Webhook 列表失败')
      return
    }
    setWebhooks(res.data.list)
  }

  async function loadDeliveries(pageNo = 1, pageSize = 20, currentWebhookId = selectedWebhookId) {
    setLoading(true)
    setError('')
    const res = await listWebhookDeliveries({
      webhookId: currentWebhookId || undefined,
      eventType: selectedEventType || undefined,
      startTime: selectedTimeRange?.[0],
      endTime: selectedTimeRange?.[1],
      pageNo,
      pageSize,
    })
    setLoading(false)
    if (res.code !== 0) {
      setError(res.message || '加载投递记录失败')
      return
    }
    setDeliveries(res.data.list)
    setPagination(res.data.pagination)
  }

  const webhookOptions = webhooks.map((item) => ({
    label: item.name,
    value: item.webhookId,
  }))

  const eventOptions = Object.entries(WEBHOOK_EVENT_LABEL_MAP).map(([value, label]) => ({
    label,
    value,
  }))

  const processButtonLabel = selectedWebhookId
    ? '处理当前 Webhook 待投递'
    : '处理当前筛选范围'

  function handleSearch(values?: { webhookId?: string; eventType?: string; timeRange?: [dayjs.Dayjs, dayjs.Dayjs] }) {
    const nextWebhookId = values?.webhookId || ''
    const nextEventType = values?.eventType || ''
    const nextTimeRange = values?.timeRange
      ? [values.timeRange[0].valueOf(), values.timeRange[1].valueOf()] as [number, number]
      : null
    setSelectedWebhookId(nextWebhookId)
    setSelectedEventType(nextEventType)
    setSelectedTimeRange(nextTimeRange)
  }

  function handleReset() {
    form.resetFields()
    setSelectedWebhookId('')
    setSelectedEventType('')
    setSelectedTimeRange(null)
  }

  const columns: ColumnsType<WebhookDeliveryItem> = [
    {
      title: 'Webhook',
      dataIndex: 'webhookId',
      key: 'webhookId',
      width: 220,
      render: (value: string) => webhookMap.get(value)?.name || value,
    },
    { title: '事件', dataIndex: 'eventType', key: 'eventType', width: 140, render: (value: string) => getWebhookEventLabel(value) },
    {
      title: '目标摘要',
      key: 'targetSummary',
      width: 260,
      render: (_value: unknown, record) => {
        const webhook = webhookMap.get(record.webhookId)
        return webhook ? getWebhookTargetSummary(webhook) : record.target || '-'
      },
    },
    { title: '状态', dataIndex: 'status', key: 'status', width: 100, render: (value: string) => renderDeliveryStatus(value) },
    { title: '尝试次数', dataIndex: 'attempts', key: 'attempts', width: 90 },
    { title: '响应码', dataIndex: 'responseStatus', key: 'responseStatus', width: 90, render: (value: number | null) => value ?? '-' },
    { title: '耗时(ms)', dataIndex: 'durationMs', key: 'durationMs', width: 100, render: (value: number) => value || '-' },
    {
      title: '操作',
      key: 'actions',
      width: 160,
      render: (_value: unknown, record) => (
        <Space size={4}>
          <Button size="small" onClick={() => setDetail(record)}>详情</Button>
          <Button size="small" onClick={() => void retryWebhookDelivery(record.deliveryId).then(() => loadDeliveries(pagination.pageNo, pagination.pageSize))}>
            重试
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <PageShell>
      <PageHeader
        title="Webhook 投递记录"
        description="查看 Webhook 的投递执行记录，可按 Webhook 维度筛选和重试。"
        extra={<Button onClick={() => navigate('/config/webhooks')}>返回 Webhook 配置</Button>}
      />
      <PanelCard>
        {error ? <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} /> : null}
        <Form form={form} layout="vertical" className="audit-log-filter-form" onFinish={(values) => handleSearch(values)}>
          <div className="audit-log-filter-grid">
            <Form.Item name="webhookId" label="Webhook">
              <Select allowClear placeholder="筛选 Webhook" options={webhookOptions} />
            </Form.Item>
            <Form.Item name="eventType" label="事件">
              <Select allowClear placeholder="筛选事件" options={eventOptions} />
            </Form.Item>
            <Form.Item name="timeRange" label="时间" className="audit-log-filter-time">
              <DatePicker.RangePicker showTime style={{ width: '100%' }} />
            </Form.Item>
          </div>
          <div className="audit-log-filter-actions">
            <Space>
              <Button type="primary" htmlType="submit">查询</Button>
              <Button onClick={handleReset}>重置</Button>
              <Button
                loading={processing}
                onClick={() => {
                  setProcessing(true)
                  void processPendingWebhookDeliveries({
                    webhookId: selectedWebhookId || undefined,
                    eventType: selectedEventType || undefined,
                  }).then((res) => {
                    setProcessing(false)
                    if (res.code !== 0) {
                      void message.error(res.message || '处理待投递记录失败')
                      return
                    }
                    void message.success(`已处理 ${res.data.processed} 条待投递记录`)
                    void loadDeliveries(pagination.pageNo, pagination.pageSize)
                  }).catch(() => {
                    setProcessing(false)
                    void message.error('处理待投递记录失败')
                  })
                }}
              >
                {processButtonLabel}
              </Button>
            </Space>
          </div>
        </Form>
      </PanelCard>
      <PanelCard noPadding>
        {deliveries.length === 0 && !loading ? (
          <Empty description="暂无投递记录" />
        ) : (
          <ConfigDataTable<WebhookDeliveryItem>
            rowKey="deliveryId"
            loading={loading}
            columns={columns}
            dataSource={deliveries}
            scroll={{ x: 1200, y: 520 }}
            serverPagination={{
              state: pagination,
              onChange: (pageNo, pageSize) => void loadDeliveries(pageNo, pageSize),
            }}
          />
        )}
      </PanelCard>

      <Drawer title="投递详情" open={!!detail} size={860} onClose={() => setDetail(null)}>
        {detail ? (
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <div className="audit-log-json-block">
              <div className="audit-log-json-block-head">
                <h4>基础信息</h4>
              </div>
              <div style={{ padding: 14, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                <div><strong>Webhook：</strong>{webhookMap.get(detail.webhookId)?.name || detail.webhookId}</div>
                <div><strong>事件：</strong>{getWebhookEventLabel(detail.eventType)}</div>
                <div><strong>状态：</strong>{renderDeliveryStatus(detail.status)}</div>
                <div><strong>目标类型：</strong>{detail.targetType === 'http' ? 'HTTPS' : '云函数'}</div>
                <div><strong>目标：</strong>{detail.target || '-'}</div>
                <div><strong>尝试次数：</strong>{detail.attempts} / {detail.maxAttempts}</div>
                <div><strong>响应码：</strong>{detail.responseStatus ?? '-'}</div>
                <div><strong>耗时：</strong>{detail.durationMs || '-'} ms</div>
                <div><strong>错误信息：</strong>{detail.errorMessage || '-'}</div>
              </div>
            </div>
            <div className="audit-log-json-block">
              <div className="audit-log-json-block-head">
                <h4>请求 Payload</h4>
              </div>
              <div style={{ padding: '0 14px 10px', fontSize: 12, color: '#64748b' }}>
                已按安全规则脱敏，超长内容可能被裁剪。
              </div>
              <div className="audit-log-json-content-wrap">
                <pre className="audit-log-json-content">{JSON.stringify(detail.requestPayload || {}, null, 2)}</pre>
              </div>
            </div>
            <div className="audit-log-json-block">
              <div className="audit-log-json-block-head">
                <h4>响应内容</h4>
              </div>
              <div style={{ padding: '0 14px 10px', fontSize: 12, color: '#64748b' }}>
                响应内容可能被截断，仅用于排查参考。
              </div>
              <div className="audit-log-json-content-wrap">
                <pre className="audit-log-json-content">{detail.responseBody || '-'}</pre>
              </div>
            </div>
          </Space>
        ) : null}
      </Drawer>
    </PageShell>
  )
}
