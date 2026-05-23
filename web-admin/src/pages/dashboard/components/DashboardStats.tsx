import { Card } from 'antd'
import {
  ApiOutlined,
  DatabaseOutlined,
  FolderOpenOutlined,
  SafetyCertificateOutlined,
  TableOutlined,
  TeamOutlined,
  UserSwitchOutlined,
} from '@ant-design/icons'
import type { ConsoleOverviewStats } from '@/types/schema'

interface DashboardStat {
  key: string
  label: string
  value: number
  hint: string
  icon: JSX.Element
}

interface DashboardStatsProps {
  isSuperAdmin: boolean
  stats: ConsoleOverviewStats
}

export function DashboardStats({ isSuperAdmin, stats }: DashboardStatsProps) {
  const items: DashboardStat[] = isSuperAdmin
    ? [
        {
          key: 'models',
          label: '模型总数',
          value: stats.modelCount,
          hint: '当前启用的数据模型',
          icon: <DatabaseOutlined />,
        },
        {
          key: 'visible',
          label: '可访问业务页',
          value: stats.visibleModelCount,
          hint: '按当前角色权限过滤',
          icon: <SafetyCertificateOutlined />,
        },
        {
          key: 'roles',
          label: '角色数量',
          value: stats.roleCount,
          hint: '启用或停用的后台角色',
          icon: <TeamOutlined />,
        },
        {
          key: 'users',
          label: '后台用户',
          value: stats.adminUserCount,
          hint: '启用或停用的后台账号',
          icon: <UserSwitchOutlined />,
        },
        {
          key: 'fields',
          label: '字段总数',
          value: stats.fieldCount,
          hint: '全部可见模型字段合计',
          icon: <TableOutlined />,
        },
        {
          key: 'ungrouped',
          label: '未分组模型',
          value: stats.ungroupedModelCount,
          hint: '直接显示在侧边栏根级',
          icon: <FolderOpenOutlined />,
        },
        {
          key: 'webhooks',
          label: 'Webhook 配置',
          value: stats.webhookCount,
          hint: '已配置的集成出口',
          icon: <ApiOutlined />,
        },
        {
          key: 'webhookFailures',
          label: '失败投递',
          value: stats.failedWebhookDeliveryCount,
          hint: '失败或重试中的投递',
          icon: <ApiOutlined />,
        },
      ]
    : [
        {
          key: 'visible',
          label: '可访问业务页',
          value: stats.visibleModelCount,
          hint: '当前账号可进入的模型',
          icon: <SafetyCertificateOutlined />,
        },
        {
          key: 'fields',
          label: '业务字段',
          value: stats.fieldCount,
          hint: '可访问模型字段合计',
          icon: <TableOutlined />,
        },
      ]

  return (
    <section className={`dashboard-stat-grid dashboard-stat-grid-${Math.min(items.length, 4)}`}>
      {items.map((item) => (
        <Card key={item.key} className="dashboard-stat-card">
          <div className="dashboard-stat-icon">{item.icon}</div>
          <div className="dashboard-stat-content">
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <em>{item.hint}</em>
          </div>
        </Card>
      ))}
    </section>
  )
}
