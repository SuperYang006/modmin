import { Button, Card, Empty } from 'antd'
import { DatabaseOutlined, RightOutlined } from '@ant-design/icons'
import { getGeneratedPagePath, getModelEditPath } from '@/app/navigation'
import { getModelIconComponent } from '@/components/common/modelIcons'
import type { CollectionSchemaSummary } from '@/types/schema'

interface DashboardModelListProps {
  isSuperAdmin: boolean
  models: CollectionSchemaSummary[]
  onNavigate: (path: string) => void
}

export function DashboardModelList({ isSuperAdmin, models, onNavigate }: DashboardModelListProps) {
  return (
    <Card
      title={isSuperAdmin ? '最近模型' : '我的业务入口'}
      extra={isSuperAdmin ? <Button type="link" onClick={() => onNavigate('/config/models')}>查看全部</Button> : null}
    >
      {models.length > 0 ? (
        <div className="dashboard-model-list">
          {models.map((item) => {
            const Icon = getModelIconComponent(item.icon)
            return (
              <button
                key={item.collectionName}
                className="dashboard-model-item"
                onClick={() => onNavigate(isSuperAdmin ? getModelEditPath(item.collectionName) : getGeneratedPagePath(item.pageCode))}
              >
                <span className="dashboard-model-icon">{Icon ? <Icon /> : <DatabaseOutlined />}</span>
                <span className="dashboard-model-main">
                  <strong>{item.modelName || item.collectionName}</strong>
                  <em>{item.collectionName}</em>
                </span>
                <span className="dashboard-model-meta">
                  <span>{item.fieldCount} 字段</span>
                </span>
                <RightOutlined />
              </button>
            )
          })}
        </div>
      ) : (
        <Empty description={isSuperAdmin ? '暂无模型' : '暂无可访问业务入口'} />
      )}
    </Card>
  )
}
