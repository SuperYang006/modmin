import { Empty, Table } from 'antd'
import type { ReactNode } from 'react'
import type { TableProps } from 'antd'

interface PaginationState {
  pageNo: number
  pageSize: number
  total: number
}

interface ConfigDataTableProps<RecordType> extends Omit<TableProps<RecordType>, 'pagination'> {
  toolbar?: ReactNode
  filters?: ReactNode
  serverPagination?: {
    state: PaginationState
    onChange: (pageNo: number, pageSize: number) => void
  }
  pagination?: TableProps<RecordType>['pagination']
  emptyText?: ReactNode
}

export function ConfigDataTable<RecordType extends object>(props: ConfigDataTableProps<RecordType>) {
  const {
    toolbar,
    filters,
    serverPagination,
    pagination,
    locale,
    emptyText,
    ...rest
  } = props

  const resolvedPagination: TableProps<RecordType>['pagination'] =
    serverPagination
      ? {
          current: serverPagination.state.pageNo,
          pageSize: serverPagination.state.pageSize,
          total: serverPagination.state.total,
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50', '100'],
          showTotal: (total) => `共 ${total} 条`,
          onChange: serverPagination.onChange,
        }
      : pagination === false
        ? false
        : {
            defaultPageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            showTotal: (total) => `共 ${total} 条`,
            ...(pagination ?? {}),
          }

  const resolvedLocale = locale ?? {
    emptyText: <Empty description={emptyText ?? '暂无数据'} image={Empty.PRESENTED_IMAGE_SIMPLE} />,
  }

  return (
    <>
      {filters}
      {toolbar}
      <div className="runtime-data-table-shell config-data-table-shell">
        <Table<RecordType>
          {...rest}
          pagination={resolvedPagination}
          locale={resolvedLocale}
        />
      </div>
    </>
  )
}
