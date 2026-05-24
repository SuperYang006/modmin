import { useEffect, useState } from 'react'
import { Button, Result, Space, Typography } from 'antd'
import { LockOutlined, LogoutOutlined, ReloadOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { getStoredAuthSession } from '@/auth/session'
import { logoutAdminUser } from '@/runtime/loader/auth'
import { displayRoleName } from '@/runtime/roles/displayRoleName'

const { Paragraph, Text } = Typography

export function NoAccessPage() {
  const navigate = useNavigate()
  const [session, setSession] = useState(() => getStoredAuthSession())
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    function handleSessionUpdate() {
      setSession(getStoredAuthSession())
    }
    window.addEventListener('modmin:session-updated', handleSessionUpdate)
    return () => window.removeEventListener('modmin:session-updated', handleSessionUpdate)
  }, [])

  const userInfo = session?.userInfo
  const displayName = userInfo?.nickName || userInfo?.userName || '当前用户'
  const roleLabel = displayRoleName(userInfo?.roleCode) || '未分配角色'

  function handleRefresh() {
    window.location.reload()
  }

  async function handleLogout() {
    setLoggingOut(true)
    try {
      await logoutAdminUser()
    } finally {
      setLoggingOut(false)
      navigate('/login', { replace: true })
    }
  }

  return (
    <div className="no-access-page">
      <Result
        status="403"
        icon={<LockOutlined className="no-access-icon" />}
        title="暂无可访问的页面"
        subTitle="您当前的角色尚未分配任何业务模型权限，无法进入工作台。请联系系统管理员为您配置权限。"
        extra={
          <Space size={12} wrap>
            <Button type="primary" icon={<ReloadOutlined />} onClick={handleRefresh}>
              刷新页面
            </Button>
            <Button icon={<LogoutOutlined />} loading={loggingOut} onClick={() => void handleLogout()}>
              退出登录
            </Button>
          </Space>
        }
      >
        <div className="no-access-detail">
          <Paragraph className="no-access-detail-title">当前账号信息</Paragraph>
          <ul className="no-access-detail-list">
            <li>
              <Text type="secondary">账号</Text>
              <Text strong>{displayName}</Text>
            </li>
            <li>
              <Text type="secondary">角色</Text>
              <span className={userInfo?.roleCode ? 'no-access-role-tag' : undefined}>{roleLabel}</span>
            </li>
          </ul>
          <Paragraph type="secondary" className="no-access-detail-tip">
            管理员可前往「系统配置 → 角色管理」为该角色配置可访问的模型权限。
          </Paragraph>
        </div>
      </Result>
    </div>
  )
}
