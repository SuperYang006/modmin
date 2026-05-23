import { Button, Card, Empty, Tag } from 'antd'
import {
  ApiOutlined,
  ExclamationCircleOutlined,
  FolderOpenOutlined,
  SafetyCertificateOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import type { ConsoleOverviewWarning } from '@/types/schema'

interface DashboardWarningsProps {
  isSuperAdmin: boolean
  warnings: ConsoleOverviewWarning[]
  onNavigate: (path: string) => void
}

function getWarningIcon(type: string, severity: ConsoleOverviewWarning['severity']) {
  if (type === 'ungroupedModels') return <FolderOpenOutlined />
  if (type === 'unauthorizedModels' || type === 'roleDisabled' || type === 'noVisibleModels') return <SafetyCertificateOutlined />
  if (type === 'failedWebhookDeliveries') return <ApiOutlined />
  return severity === 'error' ? <ExclamationCircleOutlined /> : <WarningOutlined />
}

function getSeverityLabel(severity: ConsoleOverviewWarning['severity']) {
  if (severity === 'error') return '需要处理'
  if (severity === 'warning') return '待确认'
  return '提示'
}

export function DashboardWarnings({ isSuperAdmin, warnings, onNavigate }: DashboardWarningsProps) {
  return (
    <Card title={isSuperAdmin ? '待处理项' : '访问状态'}>
      {warnings.length > 0 ? (
        <div className="dashboard-task-list">
          {warnings.map((item) => (
            <div key={item.type} className={`dashboard-task-item dashboard-task-item-${item.severity}`}>
              <span className="dashboard-task-icon">{getWarningIcon(item.type, item.severity)}</span>
              <span className="dashboard-task-main">
                <strong>{item.title}</strong>
                <em>{item.description}</em>
              </span>
              <Tag color={item.severity === 'error' ? 'error' : item.severity === 'warning' ? 'warning' : 'processing'}>
                {item.count > 0 ? item.count : getSeverityLabel(item.severity)}
              </Tag>
              {item.actionPath ? (
                <Button type="link" onClick={() => onNavigate(item.actionPath || '/')}>
                  处理
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <Empty description={isSuperAdmin ? '暂无待处理项' : '当前账号访问状态正常'} image={Empty.PRESENTED_IMAGE_SIMPLE} />
      )}
    </Card>
  )
}
