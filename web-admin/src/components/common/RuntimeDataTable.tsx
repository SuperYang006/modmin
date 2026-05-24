import { Button, Empty, Pagination, Space, Table } from 'antd'
import { useEffect, useRef, useState } from 'react'
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table'
import type { SortOrder } from 'antd/es/table/interface'
import type { CrudListQuery, CrudListResult, DictOption, RuntimeAction, RuntimeField } from '@/types/runtime'
import { renderDisplayField } from '@/runtime/registry/componentRegistry'

interface RuntimeDataTableProps {
  fields: RuntimeField[]
  dictMap: Record<string, DictOption[]>
  toolbarActions?: RuntimeAction[]
  rowActions: RuntimeAction[]
  visibleRowActions: RuntimeAction[]
  result: CrudListResult | null
  loading: boolean
  pageNo: number
  pageSize: number
  sort?: CrudListQuery['sort']
  detailLoadingId?: string
  editLoadingId?: string
  onViewDetail: (id: string) => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  onPageChange: (pageNo: number) => void
  onPageSizeChange: (pageSize: number) => void
  onToolbarActionClick?: (actionKey: string) => void
  onRefresh: () => void
  onSortChange: (sort?: CrudListQuery['sort']) => void
}

export function RuntimeDataTable(props: RuntimeDataTableProps) {
  const {
    fields,
    dictMap,
    toolbarActions = [],
    visibleRowActions,
    result,
    loading,
    pageNo,
    pageSize,
    sort,
    detailLoadingId,
    editLoadingId,
    onViewDetail,
    onEdit,
    onDelete,
    onPageChange,
    onPageSizeChange,
    onToolbarActionClick,
    onRefresh,
    onSortChange,
  } = props
  const total = result?.pagination.total ?? 0
  const activeSortField = sort?.field || ''
  const activeSortOrder = sort?.order || ''
  const dataSource = (result?.list ?? []) as Array<Record<string, unknown>>

  const shellRef = useRef<HTMLDivElement | null>(null)
  const [tableScrollY, setTableScrollY] = useState<number>(420)

  useEffect(() => {
    const shellElement = shellRef.current
    if (!shellElement) {
      return
    }
    const headerReserve = 56
    const update = () => {
      const next = Math.max(shellElement.clientHeight - headerReserve, 160)
      setTableScrollY(next)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(shellElement)
    return () => ro.disconnect()
  }, [])

  const columns: ColumnsType<Record<string, unknown>> = [
    ...fields.map((field) => ({
      title: field.label,
      dataIndex: field.fieldKey,
      key: field.fieldKey,
      width: field.listConfig?.width,
      ellipsis: true,
      sorter: field.sortable === true,
      sortOrder:
        activeSortField === field.fieldKey
          ? activeSortOrder === 'asc'
            ? ('ascend' as SortOrder)
            : ('descend' as SortOrder)
          : null,
      render: (_: unknown, record: Record<string, unknown>) =>
        renderDisplayField({
          field,
          value: record[field.fieldKey],
          dictMap,
          mode: 'table',
        }),
    })),
    {
      title: '操作',
      key: 'actions',
      width: 240,
      fixed: 'right',
      render: (_: unknown, record: Record<string, unknown>) => {
        const recordId = String(record._id)
        const detailLoading = detailLoadingId === recordId
        const editLoading = editLoadingId === recordId
        const anyLoading = Boolean(detailLoadingId) || Boolean(editLoadingId)
        return (
          <Space size={4} className="runtime-data-table-row-actions">
            <Button
              size="small"
              loading={detailLoading}
              disabled={anyLoading && !detailLoading}
              onClick={() => onViewDetail(recordId)}
            >
              详情
            </Button>
            {visibleRowActions.map((action) => {
              if (action.actionKey === 'edit') {
                return (
                  <Button
                    key={action.actionKey}
                    type="primary"
                    size="small"
                    loading={editLoading}
                    disabled={anyLoading && !editLoading}
                    onClick={() => onEdit(recordId)}
                  >
                    {action.label}
                  </Button>
                )
              }

              if (action.actionKey === 'delete') {
                return (
                  <Button key={action.actionKey} danger size="small" onClick={() => onDelete(recordId)}>
                    {action.label}
                  </Button>
                )
              }

              return (
                <Button key={action.actionKey} size="small">
                  {action.label}
                </Button>
              )
            })}
          </Space>
        )
      },
    },
  ]

  return (
    <section className="generated-section runtime-data-table-section">
      <div className="runtime-data-table-toolbar">
        <Space size={8} wrap>
          {toolbarActions.map((action) => (
            <Button key={action.actionKey} type="primary" size="small" onClick={() => onToolbarActionClick?.(action.actionKey)}>
              {action.label}
            </Button>
          ))}
        </Space>
        <Space size={8} wrap>
          <Button size="small" onClick={onRefresh} disabled={loading}>
            刷新列表
          </Button>
          <Button type="text" size="small">列设置</Button>
        </Space>
      </div>
      <div ref={shellRef} className="runtime-data-table-shell">
        <Table
          rowKey={(record) => String(record._id)}
          loading={loading}
          columns={columns}
          dataSource={dataSource}
          rowSelection={{
            columnWidth: 44,
          }}
          tableLayout="fixed"
          scroll={{ x: Math.max(fields.length * 180, 1080), y: tableScrollY }}
          locale={{
            emptyText: <Empty description="当前没有数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
          }}
          onChange={(_pagination: TablePaginationConfig, _filters, sorter, extra) => {
            if (extra?.action !== 'sort') {
              return
            }

            if (Array.isArray(sorter)) {
              const firstSorter = sorter[0]

              if (!firstSorter?.field || !firstSorter.order) {
                onSortChange(undefined)
                return
              }

              onSortChange({
                field: String(firstSorter.field),
                order: firstSorter.order === 'ascend' ? 'asc' : 'desc',
              })
              return
            }

            if (!sorter?.field || !sorter.order) {
              onSortChange(undefined)
              return
            }

            onSortChange({
              field: String(sorter.field),
              order: sorter.order === 'ascend' ? 'asc' : 'desc',
            })
          }}
          pagination={false}
        />
      </div>
      <div className="runtime-data-table-pagination">
        <Pagination
          current={pageNo}
          pageSize={pageSize}
          total={total}
          showSizeChanger
          pageSizeOptions={[10, 20, 50, 100]}
          showTotal={(nextTotal) => `共 ${nextTotal} 条记录`}
          onChange={(nextPageNo, nextPageSize) => {
            if (nextPageSize !== pageSize) {
              onPageSizeChange(nextPageSize)
            }
            onPageChange(nextPageNo)
          }}
        />
      </div>
    </section>
  )
}
