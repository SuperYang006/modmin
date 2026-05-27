import { useEffect, useRef, useState } from 'react'
import {
  Alert,
  Button,
  Checkbox,
  Col,
  Descriptions,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
  message,
} from 'antd'
import { CloudUploadOutlined } from '@ant-design/icons'
import type { StatusTone } from '@/components/ui'
import { PageHeader, PageShell, PanelCard, SectionHeader, StatusBadge } from '@/components/ui'
import { DEPLOY_REGION_OPTIONS } from '@/pages/dev-deploy/constants'
import { createDeployTask, type DeployTaskPayload } from '@/pages/dev-deploy/services'
import { useDeployConfig } from '@/pages/dev-deploy/useDeployConfig'
import { useDeployTask } from '@/pages/dev-deploy/useDeployTask'
import './dev-deploy.css'

const localServerUrl = import.meta.env.VITE_LOCAL_SERVER_URL ?? 'http://localhost:3100'

interface DeployFormValues extends DeployTaskPayload {}

function defaultJwtSecret() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function resolveStatusTone(status: string) {
  if (status === 'success') return 'success'
  if (status === 'error') return 'error'
  if (status === 'running') return 'processing'
  return 'warning'
}

function resolveTaskSummary(taskId: string, status?: string) {
  if (!taskId) {
    return '填写参数后提交，local-server 会创建一个新的部署任务。'
  }
  if (status === 'success') {
    return '任务已完成，可以直接打开后台地址做登录验证。'
  }
  if (status === 'error') {
    return '任务已失败，先看右侧日志和错误提示，再决定是否调整参数后重新提交。'
  }
  if (status === 'running') {
    return '任务执行中，右侧日志会持续刷新。'
  }
  return '任务已排队，等待 local-server 开始执行。'
}

function resolveReuseSummary(config?: { secretsDetected: Record<string, boolean> } | null) {
  if (!config) {
    return '正在读取本地已有部署配置。'
  }

  const labels = [
    config.secretsDetected.envId ? '环境 ID' : '',
    config.secretsDetected.secretId ? 'SecretId' : '',
    config.secretsDetected.secretKey ? 'SecretKey' : '',
    config.secretsDetected.authHttpUrl ? 'HTTP 触发器地址' : '',
  ].filter(Boolean)

  if (!labels.length) {
    return '当前没有检测到可直接复用的敏感字段。'
  }

  return `已检测到可复用字段：${labels.join('、')}。未进入手动编辑前，提交时会自动沿用旧值。`
}

function resolveDeployStage(logs?: Array<{ message: string; level: string }>) {
  const entries = logs || []
  const latestMessage = entries.length ? entries[entries.length - 1].message : ''
  const latestWarning = [...entries].reverse().find((item) => item.level === 'warning' || item.level === 'error')?.message || ''

  const stageMatchers = [
    { label: '准备阶段', pattern: /开始部署到环境|CloudBase CLI 已登录|已读取私钥文件|已写入 .*cloudbase\.local\.json|已写入 .*\.env\.production\.local/i },
    { label: '数据库集合', pattern: /创建 \/ 校验数据库集合|关键集合|modmin_collections|modmin_admin_users/i },
    { label: '云函数部署', pattern: /同步云函数 shared 模块|已生成 cloudbaserc|开始部署云函数|开始部署函数：|函数部署完成：/i },
    { label: '前端构建', pattern: /开始构建前端|前端构建完成/i },
    { label: '前端发布', pattern: /开始部署前端到|前端部署完成/i },
    { label: '管理员初始化', pattern: /创建或更新初始管理员|管理员账号已处理|超管账号/i },
    { label: '系统初始化', pattern: /初始化内置角色|内置角色初始化完成/i },
    { label: '验收检查', pattern: /执行最小验收|触发器可访问|后台地址|已识别 .* 个云函数/i },
  ]

  let currentStage = '等待开始'
  for (const entry of entries) {
    const matched = stageMatchers.find((item) => item.pattern.test(entry.message))
    if (matched) {
      currentStage = matched.label
    }
  }

  return {
    currentStage,
    latestMessage: latestMessage || '任务创建后，这里会显示当前执行步骤。',
    latestWarning,
  }
}

function resolveDeployImpact(overwriteAdmin: boolean, config?: { secretsDetected: Record<string, boolean> } | null) {
  return [
    overwriteAdmin ? '本次会覆盖同名管理员账号，并更新其密码。' : '若管理员已存在，本次会保留原管理员密码与账号。',
    config?.secretsDetected.jwtSecret ? '当前环境似乎已有 JWT 密钥，重新部署时建议优先复用，避免踢掉已有登录态。' : '当前未检测到旧 JWT 密钥，提交前请确认本次填写值可长期保留。',
    config?.secretsDetected.authHttpUrl ? 'HTTP 触发器地址可沿用旧值；只有确认触发器地址已变化时才建议手动覆盖。' : '请确认 modmin_auth HTTP 触发器地址可从浏览器直接访问。',
  ]
}

function createSecretFieldRule(messageText: string, allowReuse: boolean) {
  return {
    validator: async (_: unknown, value: string | undefined) => {
      if (allowReuse) return
      if (String(value || '').trim()) return
      throw new Error(messageText)
    },
  }
}

function createAdminPasswordRule(overwriteAdmin: boolean) {
  return {
    validator: async (_: unknown, value: string | undefined) => {
      if (!overwriteAdmin) return
      if (String(value || '').trim()) return
      throw new Error('覆盖管理员账号时请输入管理员密码')
    },
  }
}

function renderReusableField(options: {
  detected: boolean
  editing: boolean
  maskedText: string
  placeholder: string
  onEdit: () => void
  onReuse: () => void
  input: React.ReactNode
}) {
  const { detected, editing, maskedText, placeholder, onEdit, onReuse, input } = options

  return (
    <div className={`dev-deploy-editable-field${detected ? ' is-reusable' : ''}`}>
      <div className="dev-deploy-editable-field__control">
        {!detected || editing ? input : (
          <div className="dev-deploy-editable-field__display">
            {maskedText || placeholder}
          </div>
        )}
      </div>
      {detected ? (
        <div className="dev-deploy-editable-field__action">
          <Button type="link" className="dev-deploy-secret-edit" onClick={editing ? onReuse : onEdit}>
            {editing ? '改回沿用' : '改为手动输入'}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

export default function DevDeployPage() {
  const [form] = Form.useForm<DeployFormValues>()
  const [submitting, setSubmitting] = useState(false)
  const [taskId, setTaskId] = useState('')
  const logPanelRef = useRef<HTMLDivElement | null>(null)
  const [editingEnvId, setEditingEnvId] = useState(false)
  const [editingSecretId, setEditingSecretId] = useState(false)
  const [editingSecretKey, setEditingSecretKey] = useState(false)
  const [editingAuthHttpUrl, setEditingAuthHttpUrl] = useState(false)
  const overwriteAdmin = Form.useWatch('overwriteAdmin', form) ?? true
  const { task, loading: taskLoading, error: taskError } = useDeployTask(taskId)
  const { config, loading: configLoading, error: configError } = useDeployConfig()
  const allowReuseEnvId = Boolean(config?.secretsDetected.envId && !editingEnvId)
  const allowReuseSecretId = Boolean(config?.secretsDetected.secretId && !editingSecretId)
  const allowReuseSecretKey = Boolean(config?.secretsDetected.secretKey && !editingSecretKey)
  const allowReuseAuthHttpUrl = Boolean(config?.secretsDetected.authHttpUrl && !editingAuthHttpUrl)
  const taskStage = resolveDeployStage(task?.logs)
  const deployImpact = resolveDeployImpact(overwriteAdmin, config)
  const taskRunning = task?.status === 'running'

  useEffect(() => {
    if (!config) return
    form.setFieldsValue({
      ...config.values,
      envId: '',
      secretId: '',
      secretKey: '',
      authHttpUrl: '',
      adminPassword: '',
    })
  }, [config, form])

  useEffect(() => {
    const panel = logPanelRef.current
    if (!panel) return
    panel.scrollTop = panel.scrollHeight
  }, [task?.logs, task?.status])

  function submitDeployTask(values: DeployFormValues) {
    setSubmitting(true)
    createDeployTask({ ...values, cleanHosting: false })
      .then((result) => {
        setTaskId(result.taskId)
        void message.success('部署任务已提交到 local-server')
      })
      .catch((error) => {
        void message.error(error instanceof Error ? error.message : '提交部署任务失败')
      })
      .finally(() => {
        setSubmitting(false)
      })
  }

  function handleSubmit(values: DeployFormValues) {
    Modal.confirm({
      title: '确认提交部署任务？',
      content: (
        <Typography.Text style={{ display: 'block', fontSize: 13, lineHeight: 1.7 }}>
          <div>目标环境：<Typography.Text code>{values.envId || '（沿用旧值）'}</Typography.Text></div>
          <div style={{ marginTop: 4 }}>
            管理员：<Typography.Text code>{values.adminUserName}</Typography.Text>
            <Typography.Text type="secondary">{overwriteAdmin ? '（本次会覆盖已有账号）' : '（已有账号将保留原密码）'}</Typography.Text>
          </div>
          <div style={{ marginTop: 8 }}>
            <Typography.Text type="warning">提交后会直接修改目标环境，请确认操作无误。</Typography.Text>
          </div>
        </Typography.Text>
      ),
      okText: '确认提交',
      cancelText: '返回修改',
      okButtonProps: { danger: overwriteAdmin },
      onOk: () => submitDeployTask(values),
    })
  }

  return (
    <PageShell className="dev-deploy-page">
      <PageHeader
        title="本地部署工具"
        description="把本地初始化、云函数部署、前端发布和管理员创建收拢到同一个控制台里。页面只负责组织参数，实际执行全部委托给 local-server。"
        extra={<Tag color="warning">DEV ONLY</Tag>}
      />

      {configError ? <Alert type="error" showIcon message={configError} /> : null}

      <Row gutter={[16, 16]}>
        <Col xs={24}>
          <PanelCard compact title="环境概览">
            <div className="dev-deploy-overview-grid">
              <div className="dev-deploy-overview-main">
                <div className="dev-deploy-meta-stack">
                  <div className="dev-deploy-meta-row">
                    <span>执行入口</span>
                    <Typography.Text code>{localServerUrl}</Typography.Text>
                  </div>
                  <div className="dev-deploy-meta-row">
                    <span>配置回填</span>
                    <Typography.Text>{configLoading ? '读取中' : config?.detected ? '已加载' : '未检测到'}</Typography.Text>
                  </div>
                  <div className="dev-deploy-meta-row">
                    <span>当前任务</span>
                    <Typography.Text>{taskId || '未创建'}</Typography.Text>
                  </div>
                </div>
                <p className="dev-deploy-overview-copy">{resolveReuseSummary(config)}</p>
              </div>
              <div className="dev-deploy-overview-side">
                <div className="dev-deploy-overview-badges">
                  <StatusBadge tone="warning">DEV ONLY</StatusBadge>
                  <StatusBadge tone={resolveStatusTone(task?.status || (taskId ? 'queued' : 'warning')) as StatusTone}>
                    {task?.status || (taskId ? 'queued' : 'ready')}
                  </StatusBadge>
                </div>
                <p>{resolveTaskSummary(taskId, task?.status)}</p>
              </div>
            </div>
            {config?.detected ? (
              <Alert
                className="dev-deploy-overview-alert"
                type="success"
                showIcon
                message="已检测到现有部署配置"
                description={`已从 ${config.sources.localServerConfig || '本地配置'}${config.sources.webEnv ? `、${config.sources.webEnv}` : ''} 回填可复用字段。管理员密码不会回填。`}
              />
            ) : (
              <Alert
                className="dev-deploy-overview-alert"
                type="info"
                showIcon
                message="尚未检测到可复用配置"
                description="首次初始化时，请按顺序填写云环境、JWT 密钥、HTTP 触发器地址和管理员账号。"
              />
            )}
          </PanelCard>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={16}>
          {configLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
              <Spin size="large" tip="正在读取已有部署配置…" />
            </div>
          ) : (
          <Form<DeployFormValues>
            form={form}
            layout="vertical"
            initialValues={{
              region: 'ap-shanghai',
              basePath: '/',
              adminUserName: 'admin',
              adminNickName: '系统管理员',
              overwriteAdmin: true,
              jwtSecret: defaultJwtSecret(),
              loginKeyPath: 'cloudfunctions/modmin_auth/tcb_custom_login.json',
            }}
            onFinish={handleSubmit}
          >
            <div className="dev-deploy-form-stack">
              <PanelCard title="基础连接">
                <SectionHeader title="目标环境与执行凭据" description="这些字段决定本次部署会把资源推到哪个 CloudBase 环境，以及 local-server 用什么身份执行。" />
                <Row gutter={16}>
                  <Col xs={24} md={12}>
                  <Form.Item label="CloudBase 环境 ID" name="envId" rules={[createSecretFieldRule('请输入环境 ID', allowReuseEnvId)]}>
                    {renderReusableField({
                      detected: Boolean(config?.secretsDetected.envId),
                      editing: editingEnvId,
                      maskedText: `已检测到现有环境 ID：${config?.masked.envId || ''}`,
                      placeholder: 'your-env-id',
                      onEdit: () => setEditingEnvId(true),
                      onReuse: () => {
                        setEditingEnvId(false)
                        form.setFieldValue('envId', '')
                      },
                      input: <Input placeholder="your-env-id" />,
                    })}
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="地域" name="region" rules={[{ required: true, message: '请输入地域' }]}>
                    <Select options={DEPLOY_REGION_OPTIONS.map((item) => ({ label: item.label, value: item.value }))} placeholder="请选择地域" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="腾讯云 SecretId" name="secretId" rules={[createSecretFieldRule('请输入 SecretId', allowReuseSecretId)]}>
                    {renderReusableField({
                      detected: Boolean(config?.secretsDetected.secretId),
                      editing: editingSecretId,
                      maskedText: `已检测到现有 SecretId：${config?.masked.secretId || ''}`,
                      placeholder: 'SecretId',
                      onEdit: () => setEditingSecretId(true),
                      onReuse: () => {
                        setEditingSecretId(false)
                        form.setFieldValue('secretId', '')
                      },
                      input: <Input placeholder="SecretId" />,
                    })}
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="腾讯云 SecretKey" name="secretKey" rules={[createSecretFieldRule('请输入 SecretKey', allowReuseSecretKey)]}>
                    {renderReusableField({
                      detected: Boolean(config?.secretsDetected.secretKey),
                      editing: editingSecretKey,
                      maskedText: `已检测到现有 SecretKey：${config?.masked.secretKey || ''}`,
                      placeholder: 'SecretKey',
                      onEdit: () => setEditingSecretKey(true),
                      onReuse: () => {
                        setEditingSecretKey(false)
                        form.setFieldValue('secretKey', '')
                      },
                      input: <Input.Password placeholder="SecretKey" />,
                    })}
                  </Form.Item>
                </Col>
                </Row>
              </PanelCard>

              <PanelCard title="部署凭据">
                <SectionHeader title="JWT、触发器与前端路径" description="这里的值会直接影响当前部署目标。修改 JWT 或 HTTP 触发器时，请确认你知道它会影响谁。" />
                <Row gutter={16}>
                  <Col xs={24}>
                    <Form.Item
                      label={(
                        <span className="dev-deploy-field-label-with-action">
                          <span>JWT 密钥</span>
                          <Button type="link" className="dev-deploy-secret-edit" onClick={() => form.setFieldValue('jwtSecret', defaultJwtSecret())}>
                            生成新 JWT 密钥
                          </Button>
                        </span>
                      )}
                      name="jwtSecret"
                      rules={[{ required: true, message: '请输入 JWT 密钥' }, { min: 32, message: '长度至少 32 位' }]}
                    >
                      <Input.Password placeholder="至少 32 字符，重新部署时尽量复用旧值" />
                    </Form.Item>
                  </Col>
                  <Col xs={24}>
                    <Alert
                      className="dev-deploy-inline-alert"
                      type="warning"
                      showIcon
                      message="JWT 风险提醒"
                      description="生成新 JWT 密钥后，当前部署目标环境里依赖旧密钥签发的登录态会全部失效。只有确认需要整体轮换时才建议更换。"
                    />
                  </Col>
                  <Col xs={24}>
                    <Form.Item label="modmin_auth HTTP 触发器地址" name="authHttpUrl" rules={[createSecretFieldRule('请输入 HTTP 触发器地址', allowReuseAuthHttpUrl)]}>
                      {renderReusableField({
                        detected: Boolean(config?.secretsDetected.authHttpUrl),
                        editing: editingAuthHttpUrl,
                        maskedText: `已检测到现有触发器地址：${config?.masked.authHttpUrl || ''}`,
                        placeholder: 'https://xxx.ap-shanghai.app.tcloudbase.com/modmin_auth',
                        onEdit: () => setEditingAuthHttpUrl(true),
                        onReuse: () => {
                          setEditingAuthHttpUrl(false)
                          form.setFieldValue('authHttpUrl', '')
                        },
                        input: <Input placeholder="https://xxx.ap-shanghai.app.tcloudbase.com/modmin_auth" />,
                      })}
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item label="前端部署目录" name="basePath" rules={[{ required: true, message: '请输入部署目录' }]}>
                      <Input placeholder="/" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item label="私钥文件路径" name="loginKeyPath" rules={[{ required: true, message: '请输入私钥文件路径' }]}>
                      <Input placeholder="cloudfunctions/modmin_auth/tcb_custom_login.json" />
                    </Form.Item>
                  </Col>
                </Row>
              </PanelCard>

              <PanelCard title="管理员初始化">
                <SectionHeader title="首个管理员与覆盖策略" description="如果环境里已经有管理员账号，建议先确认是否真的需要覆盖它，再决定是否填写新密码。" />
                <Row gutter={16}>
                  <Col xs={24} md={8}>
                    <Form.Item label="管理员账号" name="adminUserName" rules={[{ required: true, message: '请输入管理员账号' }]}>
                      <Input placeholder="admin" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item label="管理员密码" name="adminPassword" rules={[createAdminPasswordRule(overwriteAdmin)]}>
                      <Input.Password placeholder={overwriteAdmin ? '覆盖管理员账号时必填' : '已有管理员且不覆盖时可留空'} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item label="管理员显示名" name="adminNickName" rules={[{ required: true, message: '请输入显示名' }]}>
                      <Input placeholder="系统管理员" />
                    </Form.Item>
                  </Col>
                </Row>

                <Alert
                  className="dev-deploy-inline-alert"
                  type="warning"
                  showIcon
                  message="管理员风险提醒"
                  description={overwriteAdmin
                    ? '当前勾选了覆盖管理员账号。若该账号已存在，本次部署会重置其密码并覆盖显示信息。'
                    : '当前未勾选覆盖管理员账号。若环境里已存在该管理员，本次部署会保留原密码与账号信息。'}
                />

                <Space size={20} wrap className="dev-deploy-form-options">
                  <Form.Item name="overwriteAdmin" valuePropName="checked" noStyle>
                    <Checkbox>覆盖已存在的管理员账号</Checkbox>
                  </Form.Item>
                </Space>
              </PanelCard>

              <PanelCard title="确认并提交">
                <div className="dev-deploy-submit-card">
                  <div className="dev-deploy-submit-copy">
                    <strong>提交前确认</strong>
                    <span>{resolveTaskSummary(taskId, task?.status)}</span>
                  </div>
                  <Button type="primary" htmlType="submit" icon={<CloudUploadOutlined />} loading={submitting}>
                    提交部署任务
                  </Button>
                </div>
              </PanelCard>
            </div>
          </Form>
          )}
        </Col>

        <Col xs={24} xl={8}>
          <div className="dev-deploy-sidebar">
            <PanelCard title="任务状态">
              {!taskId ? (
                <Alert type="warning" showIcon message="尚未提交部署任务" description="填写左侧表单后提交，任务状态和部署日志会出现在这里。" />
              ) : (
                <Space direction="vertical" size={16} style={{ width: '100%' }}>
                  <Descriptions size="small" column={1} bordered>
                    <Descriptions.Item label="任务 ID">{taskId}</Descriptions.Item>
                    <Descriptions.Item label="状态">
                      <Space>
                        <StatusBadge tone={resolveStatusTone(task?.status || 'queued') as StatusTone}>
                          {task?.status || 'queued'}
                        </StatusBadge>
                        {taskLoading ? <Spin size="small" /> : null}
                      </Space>
                    </Descriptions.Item>
                    <Descriptions.Item label="最近更新时间">
                      {task?.updatedAt ? new Date(task.updatedAt).toLocaleString() : '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="完成时间">
                      {task?.finishedAt ? new Date(task.finishedAt).toLocaleString() : '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="后台地址">
                      {task?.result?.adminAccessUrl ? (
                        <Typography.Link href={task.result.adminAccessUrl} target="_blank" rel="noreferrer">
                          {task.result.adminAccessUrl}
                        </Typography.Link>
                      ) : (
                        '-'
                      )}
                    </Descriptions.Item>
                  </Descriptions>

                  {taskError ? <Alert type="error" showIcon message={taskError} /> : null}
                  {task?.error ? <Alert type="error" showIcon message={task.error} /> : null}

                  <div className="dev-deploy-stage-card">
                    <div className="dev-deploy-stage-row">
                      <span>当前阶段</span>
                      <strong className={taskRunning ? 'dev-deploy-stage-live' : undefined}>
                        {taskRunning ? <span className="dev-deploy-stage-live-dot" aria-hidden="true" /> : null}
                        {taskStage.currentStage}
                      </strong>
                    </div>
                    <div className="dev-deploy-stage-row">
                      <span>最近动作</span>
                      <strong>{taskStage.latestMessage}</strong>
                    </div>
                    {taskStage.latestWarning ? (
                      <div className="dev-deploy-stage-row is-warning">
                        <span>最近异常</span>
                        <strong>{taskStage.latestWarning}</strong>
                      </div>
                    ) : null}
                  </div>
                </Space>
              )}
            </PanelCard>

            <PanelCard title="本次提交影响">
              <div className="dev-deploy-note-list">
                {deployImpact.map((item) => (
                  <div key={item}>{item}</div>
                ))}
              </div>
            </PanelCard>

            <PanelCard title="填写建议">
              <div className="dev-deploy-note-list">
                <div>首次初始化时，先确认私钥文件、HTTP 触发器地址和管理员密码都已准备好。</div>
                <div>如果只是重复部署前端或云函数，优先沿用旧 JWT 和管理员账号，避免制造额外变更。</div>
                <div>遇到失败时，先看“当前阶段”和“最近异常”，再往下看完整日志细节。</div>
              </div>
            </PanelCard>

            <PanelCard title="部署日志">
              <div ref={logPanelRef} className="dev-deploy-log-panel">
                {taskRunning ? (
                  <div className="dev-deploy-log-live-banner">
                    <span className="dev-deploy-log-live-pulse" aria-hidden="true" />
                    <span>任务执行中，日志会自动滚动到最新进度。</span>
                  </div>
                ) : null}
                {task?.logs?.length ? task.logs.map((log) => (
                  <div key={log.id} className={`dev-deploy-log-item is-${log.level}`}>
                    <span className="dev-deploy-log-time">{new Date(log.time).toLocaleTimeString()}</span>
                    <span className="dev-deploy-log-message">{log.message}</span>
                  </div>
                )) : (
                  <div className="dev-deploy-log-empty">提交后这里会持续显示 local-server 返回的部署日志。</div>
                )}
              </div>
            </PanelCard>
          </div>
        </Col>
      </Row>
    </PageShell>
  )
}
