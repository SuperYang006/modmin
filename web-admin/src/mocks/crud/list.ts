import type { CrudFilterItem, CrudListResult } from '@/types/runtime'
import { listRecords } from '@/mocks/crud/store'

interface ListInput {
  collectionName: string
  filters?: CrudFilterItem[]
  pagination?: {
    pageNo?: number
    pageSize?: number
  }
  sort?: { field: string; order: 'asc' | 'desc' }
}

function compareValues(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0
  if (a == null) return -1
  if (b == null) return 1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b))
}

function matchesFilter(record: Record<string, unknown>, filter: CrudFilterItem): boolean {
  if (filter.value === undefined || filter.value === null || filter.value === '') {
    return true
  }

  const recordValue = record[filter.field]

  switch (filter.operator) {
    case 'like':
      if (typeof recordValue === 'string' && typeof filter.value === 'string') {
        return recordValue.toLowerCase().includes(filter.value.toLowerCase())
      }
      return false
    case 'gte':
      return compareValues(recordValue, filter.value) >= 0
    case 'lte':
      return compareValues(recordValue, filter.value) <= 0
    case 'eq':
    default:
      return recordValue === filter.value
  }
}

export function getCrudListMock(input: ListInput): CrudListResult {
  let rows = listRecords(input.collectionName).slice()

  if (input.filters) {
    rows = rows.filter((item) => (input.filters ?? []).every((filter) => matchesFilter(item, filter)))
  }

  if (input.sort?.field) {
    const { field, order } = input.sort
    rows.sort((a, b) => {
      const result = compareValues(a[field], b[field])
      return order === 'desc' ? -result : result
    })
  }

  const pageNo = input.pagination?.pageNo ?? 1
  const pageSize = input.pagination?.pageSize ?? 20
  const start = (pageNo - 1) * pageSize
  const end = start + pageSize

  return {
    list: rows.slice(start, end),
    pagination: {
      pageNo,
      pageSize,
      total: rows.length,
    },
  }
}
