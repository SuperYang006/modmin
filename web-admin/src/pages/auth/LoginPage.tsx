import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Alert, Button, Form, Input, Typography, Space } from 'antd'
import { LockOutlined, UserOutlined } from '@ant-design/icons'
import { getStoredAuthSession, isAccessTokenExpired } from '@/auth/session'
import { BrandLogo } from '@/components/common/BrandLogo'
import { loginWithPassword } from '@/runtime/loader/auth'
import { useLocalBootstrapStatus } from '@/pages/auth/useLocalBootstrapStatus'

function renderBootstrapAlert(
  navigate: ReturnType<typeof useNavigate>,
  apiMode: string,
  loading: boolean,
  error: string,
  stage?: 'missing_collections' | 'missing_admin' | 'ready',
  adminUserName?: string,
) {
  if (apiMode !== 'http') {
    return null
  }

  if (loading) {
    return <Alert type="info" showIcon message="正在检查本地初始化状态" description="首次接入项目时，需要先确认本地 CloudBase 环境是否已经完成初始化。" />
  }

  if (error) {
    return <Alert type="warning" showIcon message="本地初始化状态读取失败" description={`无法自动判断是否已创建管理员账号：${error}`} />
  }

  if (stage === 'ready') {
    return <Alert type="success" showIcon message="本地开发环境已完成初始化" description={`检测到可登录管理员账号：${adminUserName || 'admin'}。如果密码不确定，可去“本地部署工具”重新覆盖管理员密码。`} />
  }

  if (stage === 'missing_admin') {
    return (
      <Alert
        type="warning"
        showIcon
        message="还没有管理员账号"
        description={(
          <Space direction="vertical" size={10}>
            <span>当前本地环境已经连接到 CloudBase，但还没创建首个管理员。请先完成一次初始化部署，再回来登录。</span>
            <Button type="primary" onClick={() => navigate('/dev/deploy', { state: { from: '/login' } })}>
              去本地部署工具初始化管理员
            </Button>
          </Space>
        )}
      />
    )
  }

  return (
    <Alert
      type="warning"
      showIcon
      message="本地环境还没完成初始化"
      description={(
        <Space direction="vertical" size={10}>
          <span>当前还没检测到关键系统集合或首个管理员账号。第一次使用项目时，请先完成本地部署初始化。</span>
          <Button type="primary" onClick={() => navigate('/dev/deploy', { state: { from: '/login' } })}>
            去本地部署工具完成初始化
          </Button>
        </Space>
      )}
    />
  )
}

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [userName, setUserName] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const session = getStoredAuthSession()
  const apiMode = import.meta.env.VITE_API_MODE ?? 'mock'
  const { status: bootstrapStatus, loading: bootstrapLoading, error: bootstrapError } = useLocalBootstrapStatus()

  if (session && !isAccessTokenExpired(session)) {
    return <Navigate to="/" replace />
  }

  async function handleSubmit() {
    if (!userName.trim() || !password.trim()) {
      setError('请输入账号和密码')
      return
    }

    try {
      setSubmitting(true)
      setError('')
      const response = await loginWithPassword({
        userName: userName.trim(),
        password,
      })
      setSubmitting(false)

      if (response.code !== 0) {
        setError(response.message || '登录失败')
        return
      }

      const nextPath = (location.state as { from?: string } | null)?.from || '/'
      navigate(nextPath, { replace: true })
    } catch (err) {
      setSubmitting(false)
      setError(err instanceof Error ? err.message : '登录请求未成功发出')
    }
  }

  return (
    <div className="app-auth-shell">
      <div className="app-auth-layout">
        <section className="app-auth-brand-panel">
          <div className="app-auth-brand-top">
            <BrandLogo subtitle="Model Admin" />
          </div>
          <div className="app-auth-illustration" aria-hidden="true">
            <div className="app-auth-illustration-board">
              <div className="app-auth-illustration-head" />
              <div className="app-auth-illustration-chart" />
              <div className="app-auth-illustration-table" />
            </div>
            <div className="app-auth-illustration-node app-auth-illustration-node-a" />
            <div className="app-auth-illustration-node app-auth-illustration-node-b" />
            <div className="app-auth-illustration-node app-auth-illustration-node-c" />
            <div className="app-auth-illustration-link app-auth-illustration-link-a" />
            <div className="app-auth-illustration-link app-auth-illustration-link-b" />
            <div className="app-auth-illustration-panel">
              <span />
              <span />
              <span />
            </div>
          </div>
          <div className="app-auth-brand-copy">
            <Typography.Title level={2}>模型驱动，后台从定义开始</Typography.Title>
            <Typography.Paragraph>
              用模型定义生成后台菜单、CRUD 页面、权限规则与运行时 Schema。
            </Typography.Paragraph>
          </div>
        </section>

        <section className="app-auth-card">
          <Space direction="vertical" size={22} style={{ width: '100%' }}>
            <div className="app-auth-head">
              <Typography.Title level={1} style={{ margin: 0 }}>
                欢迎回来
              </Typography.Title>
              <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                输入您的账号和密码登录
              </Typography.Paragraph>
            </div>

            {renderBootstrapAlert(
              navigate,
              apiMode,
              bootstrapLoading,
              bootstrapError,
              bootstrapStatus?.stage,
              bootstrapStatus?.adminUserName,
            )}

            <Form layout="vertical" onFinish={() => void handleSubmit()} className="app-auth-form">
              <Form.Item label="账号" required>
                <Input
                  prefix={<UserOutlined />}
                  value={userName}
                  onChange={(event) => setUserName(event.target.value)}
                  placeholder="请输入账号"
                  size="large"
                />
              </Form.Item>
              <Form.Item label="密码" required>
                <Input.Password
                  prefix={<LockOutlined />}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="请输入密码"
                  size="large"
                />
              </Form.Item>
              {error ? <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} /> : null}
              <Button type="primary" htmlType="submit" loading={submitting} block size="large" className="app-auth-submit">
                登录
              </Button>
              <div className="app-auth-mode-text">当前接口模式：{apiMode}</div>
            </Form>
          </Space>
        </section>
      </div>
    </div>
  )
}
