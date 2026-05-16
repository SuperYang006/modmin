import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Button, Card, Empty, Skeleton, Space, Typography } from 'antd'
import {
  AppstoreAddOutlined,
  DatabaseOutlined,
  FolderOpenOutlined,
  RightOutlined,
  SafetyCertificateOutlined,
  TableOutlined,
} from '@ant-design/icons'
import { getGeneratedPagePath, getModelEditPath } from '@/app/navigation'
import { getModelIconComponent } from '@/components/common/modelIcons'
import { usePermission } from '@/context/PermissionContext'
import { listCollectionSchemas } from '@/runtime/loader/listCollectionSchemas'
import type { CollectionSchemaSummary } from '@/types/schema'

interface DashboardStat {
  key: string
  label: string
  value: number
  hint: string
  icon: JSX.Element
}

export function DashboardPage() {
  const navigate = useNavigate()
  const { isSuperAdmin, permMap } = usePermission()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [collections, setCollections] = useState<CollectionSchemaSummary[]>([])

  useEffect(() => {
    let cancelled = false

    async function loadCollections() {
      setLoading(true)
      setError('')
      const response = await listCollectionSchemas()

      if (cancelled) return

      if (response.code !== 0) {
        setError(response.message || '加载控制台数据失败')
        setLoading(false)
        return
      }

      setCollections(response.data.list)
      setLoading(false)
    }

    void loadCollections()

    return () => {
      cancelled = true
    }
  }, [])

  const visibleCollections = useMemo(
    () => isSuperAdmin ? collections : collections.filter((item) => permMap[item.collectionName]?.canList === true),
    [collections, isSuperAdmin, permMap],
  )
  const ungroupedCollections = collections.filter((item) => !item.menuGroupId)
  const totalFields = collections.reduce((sum, item) => sum + (Number(item.fieldCount) || 0), 0)
  const recentCollections = [...collections]
    .sort((a, b) => Date.parse(b.updatedAt || '') - Date.parse(a.updatedAt || ''))
    .slice(0, 5)
  const visibleRecentCollections = [...visibleCollections]
    .sort((a, b) => Date.parse(b.updatedAt || '') - Date.parse(a.updatedAt || ''))
    .slice(0, 6)

  const stats: DashboardStat[] = isSuperAdmin
    ? [
        {
          key: 'models',
          label: '模型总数',
          value: collections.length,
          hint: '当前启用的数据模型',
          icon: <DatabaseOutlined />,
        },
        {
          key: 'fields',
          label: '字段总数',
          value: totalFields,
          hint: '全部模型字段合计',
          icon: <TableOutlined />,
        },
        {
          key: 'ungrouped',
          label: '未分组模型',
          value: ungroupedCollections.length,
          hint: '直接显示在侧边栏根级',
          icon: <FolderOpenOutlined />,
        },
        {
          key: 'visible',
          label: '可访问业务页',
          value: visibleCollections.length,
          hint: '按当前角色权限过滤',
          icon: <SafetyCertificateOutlined />,
        },
      ]
    : [
        {
          key: 'visible',
          label: '可访问业务页',
          value: visibleCollections.length,
          hint: '当前账号可进入的模型',
          icon: <SafetyCertificateOutlined />,
        },
        {
          key: 'fields',
          label: '业务字段',
          value: visibleCollections.reduce((sum, item) => sum + (Number(item.fieldCount) || 0), 0),
          hint: '可访问模型字段合计',
          icon: <TableOutlined />,
        },
      ]

  return (
    <div className="dashboard-page">
      {error ? <Alert type="error" showIcon message={error} /> : null}

      <section className="dashboard-hero">
        <div className="dashboard-hero-main">
          <Typography.Title level={2}>控制台</Typography.Title>
          <Typography.Paragraph>
            {isSuperAdmin ? '从模型配置、权限和业务入口开始管理当前后台。' : '查看当前账号可访问的业务数据入口。'}
          </Typography.Paragraph>
        </div>
        <Space wrap size={10}>
          {isSuperAdmin ? (
            <>
              <Button type="primary" icon={<AppstoreAddOutlined />} onClick={() => navigate('/config/models/create')}>
                创建模型
              </Button>
              <Button icon={<DatabaseOutlined />} onClick={() => navigate('/config/models')}>
                模型列表
              </Button>
            </>
          ) : null}
        </Space>
      </section>

      {loading ? (
        <Card>
          <Skeleton active paragraph={{ rows: 8 }} />
        </Card>
      ) : (
        <>
          <section className={`dashboard-stat-grid dashboard-stat-grid-${stats.length}`}>
            {stats.map((item) => (
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

          <section className="dashboard-main-grid">
            <Card
              title={isSuperAdmin ? '最近模型' : '我的业务入口'}
              extra={isSuperAdmin ? <Button type="link" onClick={() => navigate('/config/models')}>查看全部</Button> : null}
            >
              {(isSuperAdmin ? recentCollections : visibleRecentCollections).length > 0 ? (
                <div className="dashboard-model-list">
                  {(isSuperAdmin ? recentCollections : visibleRecentCollections).map((item) => {
                    const Icon = getModelIconComponent(item.icon)
                    return (
                      <button
                        key={item.collectionName}
                        className="dashboard-model-item"
                        onClick={() => navigate(isSuperAdmin ? getModelEditPath(item.collectionName) : getGeneratedPagePath(item.pageCode))}
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

            {isSuperAdmin ? (
              <Card title="待处理项">
                <div className="dashboard-task-list">
                  <DashboardTask
                    icon={<FolderOpenOutlined />}
                    title="未分组模型"
                    count={ungroupedCollections.length}
                    description="未归入菜单分组的模型会直接显示在侧边栏根级。"
                    actionText="管理分组"
                    onAction={() => navigate('/config/menu-groups')}
                  />
                  <DashboardTask
                    icon={<SafetyCertificateOutlined />}
                    title="权限配置"
                    count={collections.length}
                    description="新模型创建后需要在角色管理中确认可见和操作权限。"
                    actionText="角色管理"
                    onAction={() => navigate('/config/roles')}
                  />
                </div>
              </Card>
            ) : null}
          </section>
        </>
      )}
    </div>
  )
}

function DashboardTask(props: {
  icon: JSX.Element
  title: string
  count: number
  description: string
  actionText: string
  onAction: () => void
}) {
  return (
    <div className="dashboard-task-item">
      <span className="dashboard-task-icon">{props.icon}</span>
      <span className="dashboard-task-main">
        <strong>{props.title}</strong>
        <em>{props.description}</em>
      </span>
      <span className="dashboard-task-count">{props.count}</span>
      <Button type="link" onClick={props.onAction}>
        {props.actionText}
      </Button>
    </div>
  )
}
