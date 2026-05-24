import { useEffect, useState } from 'react'
import { Button, DatePicker, Descriptions, Drawer, Form, Modal, Select, Space, Tag, Typography, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { PageShell, PageHeader, PanelCard, ConfigDataTable } from '@/components/ui'
import { getAuditLogDetail, listAuditLogs, type AuditLogFilters, type AuditLogItem } from '@/runtime/loader/auditLogs'
import { loadCollectionSchemaDetail } from '@/runtime/loader/loadCollectionSchemaDetail'
import { listCollectionSchemas } from '@/runtime/loader/listCollectionSchemas'

const EVENT_TYPE_LABELS: Record<string, string> = {
  'auth.login.success': '登录成功',
  'auth.login.failure': '登录失败',
  'record.create': '创建记录',
  'record.update': '更新记录',
  'record.delete': '删除记录',
  'schema.create': '创建模型',
  'schema.update': '更新模型',
  'schema.delete': '删除模型',
  'role.create': '创建角色',
  'role.update': '更新角色',
  'role.delete': '删除角色',
  'user.create': '创建用户',
  'user.update': '更新用户',
  'user.delete': '删除用户',
  'menuGroup.create': '创建菜单分组',
  'menuGroup.update': '更新菜单分组',
  'menuGroup.delete': '删除菜单分组',
  'menu.create': '创建业务目录',
  'menu.update': '更新业务目录',
  'webhook.create': '创建 Webhook',
  'webhook.update': '更新 Webhook',
  'webhook.delete': '删除 Webhook',
  'webhook.delivery.failure': 'Webhook 投递失败',
}

const RESOURCE_TYPE_LABELS: Record<string, string> = {
  auth: '登录认证',
  record: '业务记录',
  schema: '数据模型',
  role: '角色',
  user: '后台用户',
  menuGroup: '菜单分组',
  menu: '业务目录',
  webhook: 'Webhook',
}

const EVENT_TYPE_OPTIONS = [
  'auth.login.success',
  'auth.login.failure',
  'record.create',
  'record.update',
  'record.delete',
  'webhook.create',
  'webhook.update',
  'webhook.delete',
  'webhook.delivery.failure',
]
  .map((value) => ({ label: EVENT_TYPE_LABELS[value] || value, value }))

const RESOURCE_TYPE_OPTIONS = ['auth', 'record', 'schema', 'role', 'user', 'menuGroup', 'menu', 'webhook']
  .map((value) => ({ label: RESOURCE_TYPE_LABELS[value] || value, value }))

const ROLE_CODE_LABELS: Record<string, string> = {
  role_super_admin: '超级管理员',
  role_operator: '运营人员',
  role_editor: '内容编辑',
}

function getEventTypeLabel(eventType: string) {
  return EVENT_TYPE_LABELS[eventType] || eventType || '-'
}

function getResourceTypeLabel(resourceType: string) {
  return RESOURCE_TYPE_LABELS[resourceType] || resourceType || '-'
}

function getRoleCodeLabel(roleCode: string) {
  return ROLE_CODE_LABELS[roleCode] || roleCode || '-'
}

function getActorDisplayName(actor?: { nickName?: string; userName?: string; userId?: string }) {
  return actor?.nickName || actor?.userName || actor?.userId || '-'
}

function stringifyAuditValue(value: unknown) {
  if (value === undefined) {
    return 'undefined'
  }

  return JSON.stringify(value, null, 2)
}

function buildDiffPreviewValue(diff: Record<string, unknown>, fieldLabelMap: Record<string, string>) {
  const entries = Object.entries(diff || {})
  const preview: Record<string, unknown> = {}

  for (const [fieldKey, item] of entries) {
    const label = fieldLabelMap[fieldKey] || DEFAULT_FIELD_LABELS[fieldKey] || fieldKey
    const previewKey = label === fieldKey ? fieldKey : `${label} (${fieldKey})`
    preview[previewKey] = item
  }

  return preview
}

const DEFAULT_FIELD_LABELS: Record<string, string> = {
  _id: 'ID',
  title: '标题',
  description: '描述',
  status: '状态',
  collection: '模型信息',
  fields: '字段列表',
  systemFieldSettings: '系统字段设置',
  layoutSchema: '布局配置',
  pages: '页面配置',
  menuGroupId: '菜单分组',
  collectionName: '集合名',
  modelCode: '模型编码',
  modelName: '模型名称',
  pageCode: '页面编码',
  icon: '图标',
  fieldCount: '字段数量',
  sortOrder: '排序',
  modmin_createTime: '创建时间',
  modmin_createBy: '创建人',
  modmin_updateTime: '更新时间',
  modmin_updateBy: '更新人',
  modmin_isDeleted: '已删除',
  modmin_deleteTime: '删除时间',
  modmin_deleteBy: '删除人',
}

function JsonBlock({
  title,
  value,
  onOpenPreview,
}: {
  title: string
  value: unknown
  onOpenPreview: (title: string, value: unknown) => void
}) {
  const text = stringifyAuditValue(value)

  return (
    <section className="audit-log-json-block">
      <div className="audit-log-json-block-head">
        <h4>{title}</h4>
        <Space size={12}>
          <Button type="link" size="small" className="audit-log-preview-btn" onClick={() => onOpenPreview(title, value)}>
            弹窗查看
          </Button>
          <Typography.Paragraph
            copyable={{ text, tooltips: ['复制', '已复制'] }}
            className="audit-log-copy-entry"
          >
            复制
          </Typography.Paragraph>
        </Space>
      </div>
      <div className="audit-log-json-hint">
        已按安全规则脱敏，超长内容可能被裁剪。
      </div>
      <div className="audit-log-json-content-wrap">
        <pre className="audit-log-json-content">{text}</pre>
      </div>
    </section>
  )
}

function DiffBlock({
  diff,
  fieldLabelMap,
  onOpenPreview,
}: {
  diff: Record<string, unknown>
  fieldLabelMap: Record<string, string>
  onOpenPreview: (title: string, value: unknown) => void
}) {
  const entries = Object.entries(diff || {})

  if (entries.length === 0) {
    return (
      <section className="audit-log-empty-diff">
        <h4>Diff</h4>
        <p>当前事件无字段级差异，请查看下方原始数据。</p>
      </section>
    )
  }

  const previewValue = buildDiffPreviewValue(diff, fieldLabelMap)

  return (
    <section className="audit-log-json-block">
      <div className="audit-log-json-block-head">
        <h4>Diff</h4>
        <Space size={12}>
          <Button type="link" size="small" className="audit-log-preview-btn" onClick={() => onOpenPreview('Diff', diff)}>
            弹窗查看
          </Button>
          <Typography.Paragraph
            copyable={{ text: stringifyAuditValue(previewValue), tooltips: ['复制', '已复制'] }}
            className="audit-log-copy-entry"
          >
            复制
          </Typography.Paragraph>
        </Space>
      </div>
      <div className="audit-log-json-hint">
        仅展示字段级差异，值内容可能经过脱敏或裁剪。
      </div>
      <div className="audit-log-json-content-wrap">
        <pre className="audit-log-json-content">{stringifyAuditValue(previewValue)}</pre>
      </div>
    </section>
  )
}

function DiffModalContent({
  diff,
  fieldLabelMap,
}: {
  diff: Record<string, unknown>
  fieldLabelMap: Record<string, string>
}) {
  const entries = Object.entries(diff || {})

  if (entries.length === 0) {
    return <div className="audit-log-diff-empty">无字段差异</div>
  }

  return (
    <div className="audit-log-modal-diff-list">
      {entries.map(([fieldKey, item]) => {
        const change = item && typeof item === 'object' ? (item as { before?: unknown; after?: unknown }) : {}
        const label = fieldLabelMap[fieldKey] || DEFAULT_FIELD_LABELS[fieldKey] || fieldKey

        return (
          <div key={fieldKey} className="audit-log-modal-diff-item">
            <div className="audit-log-diff-title">
              <strong>{label}</strong>
              {label !== fieldKey ? <span>{fieldKey}</span> : null}
            </div>
            <div className="audit-log-modal-diff-columns">
              <div className="audit-log-modal-diff-column">
                <div className="audit-log-diff-label">变更前</div>
                <pre className="audit-log-modal-diff-value">{stringifyAuditValue(change.before)}</pre>
              </div>
              <div className="audit-log-modal-diff-column">
                <div className="audit-log-diff-label">变更后</div>
                <pre className="audit-log-modal-diff-value">{stringifyAuditValue(change.after)}</pre>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function AuditLogPage() {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [logs, setLogs] = useState<AuditLogItem[]>([])
  const [collectionOptions, setCollectionOptions] = useState<Array<{ label: string; value: string }>>([])
  const [pagination, setPagination] = useState({ pageNo: 1, pageSize: 20, total: 0 })
  const [detail, setDetail] = useState<AuditLogItem | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [fieldLabelMap, setFieldLabelMap] = useState<Record<string, string>>({})
  const [previewModal, setPreviewModal] = useState<{ title: string; value: unknown; mode?: 'json' | 'diff' } | null>(null)

  useEffect(() => {
    void fetchList(1, 20)
    void loadCollectionOptions()
  }, [])

  async function loadCollectionOptions() {
    const res = await listCollectionSchemas()
    if (res.code !== 0) {
      return
    }

    setCollectionOptions(
      res.data.list.map((item) => ({
        label: `${item.modelName || item.collectionName} (${item.collectionName})`,
        value: item.collectionName,
      })),
    )
  }

  async function fetchList(pageNo = pagination.pageNo, pageSize = pagination.pageSize) {
    const values = form.getFieldsValue()
    const range = values.timeRange as [dayjs.Dayjs, dayjs.Dayjs] | undefined
    const filters: AuditLogFilters = {
      eventType: values.eventType || undefined,
      resourceType: values.resourceType || undefined,
      collectionName: values.collectionName?.trim() || undefined,
      result: values.result || undefined,
      startTime: range?.[0]?.valueOf(),
      endTime: range?.[1]?.valueOf(),
    }

    setLoading(true)
    const res = await listAuditLogs({ filters, pageNo, pageSize })
    setLoading(false)
    if (res.code !== 0) {
      void message.error(res.message || '加载操作日志失败')
      return
    }

    setLogs(res.data.list)
    setPagination(res.data.pagination)
  }

  async function handleOpenDetail(logId: string) {
    setDrawerOpen(true)
    setDetailLoading(true)
    const res = await getAuditLogDetail(logId)
    setDetailLoading(false)

    if (res.code !== 0) {
      void message.error(res.message || '加载日志详情失败')
      return
    }

    setDetail(res.data.detail)

    const collectionName = res.data.detail.collectionName
    if (collectionName && (res.data.detail.resourceType === 'record' || res.data.detail.resourceType === 'schema')) {
      const schemaRes = await loadCollectionSchemaDetail(collectionName)
      if (schemaRes.code === 0) {
        const labels = schemaRes.data.detail.fields.reduce<Record<string, string>>((acc, field) => {
          acc[field.fieldKey] = field.label || field.fieldName || field.fieldKey
          return acc
        }, {})
        setFieldLabelMap({
          ...DEFAULT_FIELD_LABELS,
          ...labels,
        })
        return
      }
    }

    setFieldLabelMap(DEFAULT_FIELD_LABELS)
  }

  function handleOpenPreview(title: string, value: unknown, mode: 'json' | 'diff' = 'json') {
    setPreviewModal({ title, value, mode })
  }

  const columns: ColumnsType<AuditLogItem> = [
    {
      title: '操作时间',
      dataIndex: 'createTime',
      key: 'createTime',
      width: 180,
      render: (value: number) => dayjs(value).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '操作者',
      key: 'actor',
      width: 160,
      render: (_value: unknown, record) => getActorDisplayName(record.actor),
    },
    {
      title: '事件',
      dataIndex: 'eventType',
      key: 'eventType',
      width: 180,
      render: (value: string) => getEventTypeLabel(value),
    },
    {
      title: '资源',
      key: 'resource',
      render: (_value: unknown, record) =>
        [getResourceTypeLabel(record.resourceType), record.collectionName, record.recordId].filter(Boolean).join(' / ') || '-',
    },
    {
      title: '结果',
      dataIndex: 'result',
      key: 'result',
      width: 100,
      render: (value: string) => value === 'success' ? <Tag color="success">成功</Tag> : <Tag color="error">失败</Tag>,
    },
    { title: '请求 ID', dataIndex: 'requestId', key: 'requestId', width: 180, render: (value: string) => value || '-' },
    {
      title: '操作',
      key: 'actions',
      width: 90,
      fixed: 'right',
      render: (_value: unknown, record) => <Button size="small" onClick={() => void handleOpenDetail(record._id)}>详情</Button>,
    },
  ]

  return (
    <PageShell>
      <PageHeader
        title="操作日志"
        description="查看后台关键写操作和登录结果，支持按时间、事件、资源和结果筛选。"
      />
      <PanelCard>
        <Form form={form} layout="vertical" className="audit-log-filter-form">
          <div className="audit-log-filter-grid">
            <Form.Item name="eventType" label="事件">
              <Select allowClear options={EVENT_TYPE_OPTIONS} placeholder="全部事件" />
            </Form.Item>
            <Form.Item name="resourceType" label="资源">
              <Select allowClear options={RESOURCE_TYPE_OPTIONS} placeholder="全部资源" />
            </Form.Item>
            <Form.Item name="collectionName" label="模型">
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder="选择模型"
                options={collectionOptions}
              />
            </Form.Item>
            <Form.Item name="result" label="结果">
              <Select
                allowClear
                placeholder="全部结果"
                options={[{ label: '成功', value: 'success' }, { label: '失败', value: 'failure' }]}
              />
            </Form.Item>
            <Form.Item name="timeRange" label="时间" className="audit-log-filter-time">
              <DatePicker.RangePicker showTime style={{ width: '100%' }} />
            </Form.Item>
          </div>
          <div className="audit-log-filter-actions">
            <Space>
              <Button type="primary" onClick={() => void fetchList(1, pagination.pageSize)}>查询</Button>
              <Button onClick={() => { form.resetFields(); void fetchList(1, pagination.pageSize) }}>重置</Button>
            </Space>
          </div>
        </Form>
      </PanelCard>
      <PanelCard noPadding>
        <ConfigDataTable<AuditLogItem>
          rowKey="_id"
          loading={loading}
          columns={columns}
          dataSource={logs}
          scroll={{ x: 1080, y: 520 }}
          serverPagination={{
            state: pagination,
            onChange: (pageNo, pageSize) => void fetchList(pageNo, pageSize),
          }}
        />
      </PanelCard>

      <Drawer title="日志详情" open={drawerOpen} width={760} onClose={() => setDrawerOpen(false)} loading={detailLoading}>
        {detail ? (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="事件">{getEventTypeLabel(detail.eventType)}</Descriptions.Item>
              <Descriptions.Item label="事件编码">{detail.eventType}</Descriptions.Item>
              <Descriptions.Item label="结果">{detail.result === 'success' ? '成功' : '失败'}</Descriptions.Item>
              <Descriptions.Item label="操作者">{getActorDisplayName(detail.actor)}</Descriptions.Item>
              <Descriptions.Item label="资源类型">{getResourceTypeLabel(detail.resourceType)}</Descriptions.Item>
              <Descriptions.Item label="资源类型编码">{detail.resourceType || '-'}</Descriptions.Item>
              <Descriptions.Item label="角色">{getRoleCodeLabel(detail.actor?.roleCode || '')}</Descriptions.Item>
              <Descriptions.Item label="角色编码">{detail.actor?.roleCode || '-'}</Descriptions.Item>
              <Descriptions.Item label="模型">{detail.collectionName || '-'}</Descriptions.Item>
              <Descriptions.Item label="记录 ID">{detail.recordId || '-'}</Descriptions.Item>
              <Descriptions.Item label="来源 IP">{detail.clientIp || '-'}</Descriptions.Item>
              <Descriptions.Item label="User-Agent">{detail.userAgent || '-'}</Descriptions.Item>
              <Descriptions.Item label="请求 ID">{detail.requestId || '-'}</Descriptions.Item>
              <Descriptions.Item label="错误信息">{detail.errorMessage || '-'}</Descriptions.Item>
            </Descriptions>
            <DiffBlock
              diff={detail.diff}
              fieldLabelMap={fieldLabelMap}
              onOpenPreview={(title, value) => handleOpenPreview(title, value, 'diff')}
            />
            <section className="audit-log-secondary-section">
              <div className="audit-log-secondary-head">
                <h4>原始数据</h4>
                <span>用于查看完整操作前后快照</span>
              </div>
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <JsonBlock title="操作前数据" value={detail.before} onOpenPreview={handleOpenPreview} />
                <JsonBlock title="操作后数据" value={detail.after} onOpenPreview={handleOpenPreview} />
              </Space>
            </section>
          </Space>
        ) : null}
      </Drawer>
      <Modal
        title={previewModal?.title || '内容详情'}
        open={!!previewModal}
        width={960}
        footer={null}
        onCancel={() => setPreviewModal(null)}
      >
        <div className="audit-log-modal-content">
          {previewModal?.mode === 'diff' ? (
            <DiffModalContent diff={(previewModal.value as Record<string, unknown>) || {}} fieldLabelMap={fieldLabelMap} />
          ) : (
            <pre className="audit-log-modal-pre">{stringifyAuditValue(previewModal?.value)}</pre>
          )}
        </div>
      </Modal>
    </PageShell>
  )
}
