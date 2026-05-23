import { Button, Space, Typography } from 'antd'
import {
  ApiOutlined,
  AppstoreAddOutlined,
  AuditOutlined,
  DatabaseOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons'

interface DashboardHeaderProps {
  isSuperAdmin: boolean
  onNavigate: (path: string) => void
}

export function DashboardHeader({ isSuperAdmin, onNavigate }: DashboardHeaderProps) {
  return (
    <section className="dashboard-hero">
      <div className="dashboard-hero-main">
        <Typography.Title level={2}>控制台</Typography.Title>
        <Typography.Paragraph>
          {isSuperAdmin ? '查看系统配置状态、业务模型入口和需要处理的后台事项。' : '查看当前账号可访问的业务数据入口。'}
        </Typography.Paragraph>
      </div>
      <Space wrap size={10} className="dashboard-quick-actions">
        {isSuperAdmin ? (
          <>
            <Button type="primary" icon={<AppstoreAddOutlined />} onClick={() => onNavigate('/config/models/create')}>
              创建模型
            </Button>
            <Button icon={<DatabaseOutlined />} onClick={() => onNavigate('/config/models')}>
              模型列表
            </Button>
            <Button icon={<SafetyCertificateOutlined />} onClick={() => onNavigate('/config/roles')}>
              角色管理
            </Button>
            <Button icon={<ApiOutlined />} onClick={() => onNavigate('/config/webhooks')}>
              Webhook
            </Button>
            <Button icon={<AuditOutlined />} onClick={() => onNavigate('/config/audit-logs')}>
              操作日志
            </Button>
          </>
        ) : null}
      </Space>
    </section>
  )
}
