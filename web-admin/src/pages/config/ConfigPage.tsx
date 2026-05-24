import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Button,
  Empty,
  Input,
  Popconfirm,
  Space,
  Table,
  Typography,
} from 'antd'
import { HolderOutlined, PlusOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { getModelEditPath } from '@/app/navigation'
import { deleteCollectionSchema } from '@/runtime/loader/deleteCollectionSchema'
import { listCollectionSchemas } from '@/runtime/loader/listCollectionSchemas'
import { sortCollectionSchemas } from '@/runtime/loader/sortCollectionSchemas'
import { PageShell, PageHeader, PanelCard } from '@/components/ui'
import type { CollectionSchemaSummary } from '@/types/schema'

export function ConfigPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [collections, setCollections] = useState<CollectionSchemaSummary[]>([])
  const [keyword, setKeyword] = useState('')
  const [draggingCollectionName, setDraggingCollectionName] = useState('')
  const [dragOverState, setDragOverState] = useState<{ collectionName: string; position: 'top' | 'bottom' } | null>(null)

  useEffect(() => {
    void reloadCollections()
  }, [])

  async function reloadCollections() {
      setLoading(true)
      setError('')

      const response = await listCollectionSchemas()

      if (response.code !== 0) {
        setError(response.message || '加载模型列表失败')
        setLoading(false)
        return
      }

      setCollections(response.data.list)
      setLoading(false)
  }

  async function handleDeleteModel(collectionName: string) {
    const response = await deleteCollectionSchema({ collectionName })

    if (response.code !== 0) {
      setError(response.message || '删除模型失败')
      return
    }

    setCollections((prev) => prev.filter((item) => item.collectionName !== collectionName))
  }

  async function persistCollectionOrder(nextCollections: CollectionSchemaSummary[]) {
    const items = nextCollections.map((item, index) => ({
      collectionName: item.collectionName,
      sortOrder: (index + 1) * 10,
    }))
    const response = await sortCollectionSchemas({ items })

    if (response.code !== 0) {
      setError(response.message || '更新模型顺序失败')
      return false
    }

    setCollections(response.data.list)
    return true
  }

  async function moveCollectionByTarget(sourceCollectionName: string, targetCollectionName: string, position: 'top' | 'bottom') {
    const nextCollections = [...collections]
    const currentCollectionIndex = nextCollections.findIndex((item) => item.collectionName === sourceCollectionName)
    const targetCollectionIndex = nextCollections.findIndex((item) => item.collectionName === targetCollectionName)

    if (currentCollectionIndex < 0 || targetCollectionIndex < 0) {
      return
    }

    const [currentItem] = nextCollections.splice(currentCollectionIndex, 1)
    const adjustedTargetIndex =
      currentCollectionIndex < targetCollectionIndex
        ? position === 'top'
          ? targetCollectionIndex - 1
          : targetCollectionIndex
        : position === 'top'
          ? targetCollectionIndex
          : targetCollectionIndex + 1

    nextCollections.splice(adjustedTargetIndex, 0, currentItem)
    setCollections(nextCollections)
    const success = await persistCollectionOrder(nextCollections)

    if (!success) {
      await reloadCollections()
    }
  }

  const filteredCollections = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase()

    return collections.filter((item) => {
      if (!normalizedKeyword) {
        return true
      }

      const matchKeyword = [
        item.modelName,
        item.collectionName,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedKeyword))

      return matchKeyword
    })
  }, [collections, keyword])

  const columns: ColumnsType<CollectionSchemaSummary> = [
    {
      title: '',
      key: 'drag',
      width: 48,
      align: 'center',
      render: (_: unknown, record: CollectionSchemaSummary) => (
        <span
          className={`config-model-drag-handle${keyword.trim() ? ' is-disabled' : ''}`}
          draggable={!keyword.trim()}
          onDragStart={(event) => {
            if (keyword.trim()) {
              event.preventDefault()
              return
            }

            setDraggingCollectionName(record.collectionName)
            event.dataTransfer.effectAllowed = 'move'
            event.dataTransfer.setData('text/plain', record.collectionName)
          }}
          onDragEnd={() => setDraggingCollectionName('')}
        >
          <HolderOutlined />
        </span>
      ),
    },
    {
      title: '模型名称',
      dataIndex: 'title',
      key: 'title',
      width: 180,
      ellipsis: true,
      render: (_: unknown, record: CollectionSchemaSummary) => (
        <Typography.Text strong ellipsis title={record.modelName || record.collectionName}>
          {record.modelName || record.collectionName}
        </Typography.Text>
      ),
    },
    {
      title: '模型说明',
      dataIndex: 'description',
      key: 'description',
      width: 260,
      ellipsis: true,
      render: (value: CollectionSchemaSummary['description']) => (
        <Typography.Text type="secondary" title={value || ''}>
          {value || '-'}
        </Typography.Text>
      ),
    },
    {
      title: '集合名称',
      dataIndex: 'collectionName',
      key: 'collectionName',
      width: 220,
      ellipsis: true,
      render: (value: CollectionSchemaSummary['collectionName']) => (
        <Typography.Text code title={value}>
          {value}
        </Typography.Text>
      ),
    },
    {
      title: '字段数',
      dataIndex: 'fieldCount',
      key: 'fieldCount',
      width: 100,
      align: 'center',
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 180,
      ellipsis: true,
    },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      fixed: 'right',
      render: (_: unknown, record: CollectionSchemaSummary) => (
        <Space size={4}>
          <Button type="link" onClick={() => navigate(getModelEditPath(record.collectionName))}>
            编辑模型
          </Button>
          <Popconfirm
            title="删除模型"
            description={`确认删除模型 ${record.modelName || record.collectionName} 吗？删除模型不会删除数据集合。`}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
            onConfirm={() => void handleDeleteModel(record.collectionName)}
          >
            <Button type="link" danger>
              删除模型
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <PageShell>
      <PageHeader
        title="模型列表"
        description="管理业务数据模型，支持拖拽排序。"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/config/models/create')}>
            创建模型
          </Button>
        }
      />
      <PanelCard noPadding className="config-model-page">
        {error ? <Alert type="error" showIcon message={error} style={{ margin: '16px 16px 0' }} /> : null}

        <div className="config-model-table-toolbar" style={{ padding: '16px 16px 0' }}>
          <div className="config-model-table-toolbar-main">
            <Input.Search
              allowClear
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="搜索模型名称、集合名"
              style={{ width: 320 }}
            />
          </div>
        </div>

        {filteredCollections.length > 0 || loading ? (
          <Table
            rowKey="collectionName"
            rowClassName={(record) => {
              const classNames = ['config-model-row']

              if (record.collectionName === draggingCollectionName) {
                classNames.push('is-dragging')
              }

              if (dragOverState?.collectionName === record.collectionName) {
                classNames.push(dragOverState.position === 'top' ? 'is-drag-over-top' : 'is-drag-over-bottom')
              }

              return classNames.join(' ')
            }}
            loading={loading}
            columns={columns}
            dataSource={filteredCollections}
            tableLayout="fixed"
            scroll={{ x: 1160 }}
            onRow={(record) => ({
              onDragOver: (event) => {
                if (!keyword.trim() && draggingCollectionName && draggingCollectionName !== record.collectionName) {
                  event.preventDefault()
                  event.dataTransfer.dropEffect = 'move'
                  const rect = (event.currentTarget as HTMLTableRowElement).getBoundingClientRect()
                  const nextPosition = event.clientY - rect.top < rect.height / 2 ? 'top' : 'bottom'

                  setDragOverState({
                    collectionName: record.collectionName,
                    position: nextPosition,
                  })
                }
              },
              onDragLeave: (event) => {
                const relatedTarget = event.relatedTarget

                if (
                  !(relatedTarget instanceof Node) ||
                  !(event.currentTarget as HTMLTableRowElement).contains(relatedTarget)
                ) {
                  setDragOverState((prev) => (prev?.collectionName === record.collectionName ? null : prev))
                }
              },
              onDrop: (event) => {
                event.preventDefault()

                if (keyword.trim()) {
                  setDragOverState(null)
                  return
                }

                const sourceCollectionName = event.dataTransfer.getData('text/plain') || draggingCollectionName
                const dropPosition = dragOverState?.collectionName === record.collectionName ? dragOverState.position : 'bottom'

                if (!sourceCollectionName || sourceCollectionName === record.collectionName) {
                  setDraggingCollectionName('')
                  setDragOverState(null)
                  return
                }

                void moveCollectionByTarget(sourceCollectionName, record.collectionName, dropPosition)
                setDraggingCollectionName('')
                setDragOverState(null)
              },
            })}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条`,
            }}
          />
        ) : (
          <Empty description="当前还没有模型，请先创建第一个模型。" />
          )}
      </PanelCard>
    </PageShell>
  )
}
