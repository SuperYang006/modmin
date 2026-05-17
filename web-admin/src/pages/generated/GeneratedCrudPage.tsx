import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { message, Modal, Result, Skeleton } from 'antd'
import { RuntimeDataTable } from '@/components/common/RuntimeDataTable'
import { RuntimeRecordDetail } from '@/components/common/RuntimeRecordDetail'
import { RuntimeRecordForm } from '@/components/common/RuntimeRecordForm'
import { RuntimeSearchForm } from '@/components/common/RuntimeSearchForm'
import {
  buildInitialCreateValues,
  buildSubmittedRecord,
  serializeDateFieldValue,
  validateRuntimeForm,
} from '@/pages/generated/formUtils'
import { createCrudRecord } from '@/runtime/loader/createCrudRecord'
import { deleteCrudRecord } from '@/runtime/loader/deleteCrudRecord'
import { loadCrudDetail } from '@/runtime/loader/loadCrudDetail'
import { loadCrudList } from '@/runtime/loader/loadCrudList'
import { loadPageRuntimeSchema } from '@/runtime/loader/loadPageRuntimeSchema'
import { normalizePageRuntimeSchema } from '@/runtime/normalizers/normalizePageRuntimeSchema'
import { resolveActionVisible } from '@/runtime/permissions/resolveActionVisible'
import { updateCrudRecord } from '@/runtime/loader/updateCrudRecord'
import { preloadAssetUrls } from '@/services/asset'
import { useModelPermission } from '@/context/PermissionContext'
import type {
  CrudFilterItem,
  CrudListQuery,
  CrudListResult,
  PageRuntimeSchema,
  RuntimeField,
} from '@/types/runtime'

const SEARCH_FIELD_STORAGE_PREFIX = 'generated_crud_search_fields::'

export function GeneratedCrudPage() {
  const { pageCode } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [tableLoading, setTableLoading] = useState(false)
  const [error, setError] = useState('')
  const [schema, setSchema] = useState<PageRuntimeSchema | null>(null)
  const schemaCollectionName = String(schema?.collection?.collectionName ?? '')
  const contextPerm = useModelPermission(schemaCollectionName)
  const [listResult, setListResult] = useState<CrudListResult | null>(null)
  const [formVisible, setFormVisible] = useState(false)
  const [detailVisible, setDetailVisible] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [currentRecordId, setCurrentRecordId] = useState('')
  const [formValues, setFormValues] = useState<Record<string, unknown>>({})
  const [initialFormValues, setInitialFormValues] = useState<Record<string, unknown>>({})
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [formSubmitError, setFormSubmitError] = useState('')
  const [formSubmitting, setFormSubmitting] = useState(false)
  const [detailRecord, setDetailRecord] = useState<Record<string, unknown> | null>(null)
  const [detailLoadingId, setDetailLoadingId] = useState('')
  const [editLoadingId, setEditLoadingId] = useState('')
  const [queryValues, setQueryValues] = useState<Record<string, string | { start?: string; end?: string }>>({})
  const [draftQueryValues, setDraftQueryValues] = useState<Record<string, string | { start?: string; end?: string }>>({})
  const [activeSearchFieldKeys, setActiveSearchFieldKeys] = useState<string[]>([])
  const [searchFieldStorageReady, setSearchFieldStorageReady] = useState(false)
  const [searchFieldStorageKey, setSearchFieldStorageKey] = useState('')
  const [pageNo, setPageNo] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [sort, setSort] = useState<CrudListQuery['sort'] | undefined>(undefined)
  const listRequestSeqRef = useRef(0)

  function buildSearchFieldStorageKey(key: string) {
    return `${SEARCH_FIELD_STORAGE_PREFIX}${key}`
  }

  function readStoredSearchFieldKeys(storageKey: string) {
    if (typeof window === 'undefined' || !storageKey) {
      return []
    }

    try {
      const raw = window.localStorage.getItem(buildSearchFieldStorageKey(storageKey))

      if (!raw) {
        return []
      }

      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed.map((item) => String(item)).filter(Boolean) : []
    } catch {
      return []
    }
  }

  function writeStoredSearchFieldKeys(storageKey: string, fieldKeys: string[]) {
    if (typeof window === 'undefined' || !storageKey) {
      return
    }

    try {
      window.localStorage.setItem(buildSearchFieldStorageKey(storageKey), JSON.stringify(fieldKeys))
    } catch {
      // ignore storage failures
    }
  }

  useEffect(() => {
    setSearchFieldStorageReady(false)
    setSearchFieldStorageKey('')
  }, [pageCode])

  function getFilterOperator(field: RuntimeField): CrudFilterItem['operator'] {
    const operator = field.searchConfig?.operator

    if (operator === 'like' || operator === 'gte' || operator === 'lte') {
      return operator
    }

    return 'eq'
  }

  function getDefaultSort(fields: RuntimeField[]): CrudListQuery['sort'] | undefined {
    const defaultSortField = fields.find((field) => field.sortable === true && (field.sortDirection === 'asc' || field.sortDirection === 'desc'))

    if (defaultSortField) {
      return {
        field: defaultSortField.fieldKey,
        order: defaultSortField.sortDirection,
      }
    }

    return {
      field: 'modmin_createTime',
      order: 'desc',
    }
  }

  function getSystemFallbackSort(schema: PageRuntimeSchema): CrudListQuery['sort'] {
    return {
      field: schema.systemFieldSettings?.defaultSortField === 'modmin_updateTime' ? 'modmin_updateTime' : 'modmin_createTime',
      order: schema.systemFieldSettings?.defaultSortOrder === 'asc' ? 'asc' : 'desc',
    }
  }

  function toSearchBoundaryValue(field: RuntimeField, rawValue: string, boundary: 'start' | 'end') {
    if (!rawValue) {
      return rawValue
    }

    return serializeDateFieldValue(field, rawValue, boundary)
  }

  async function refreshList(
    currentSchema: PageRuntimeSchema,
    nextQueryValues = queryValues,
    nextPageNo = pageNo,
    nextPageSize = pageSize,
    nextSort = sort,
    nextSearchFieldKeys = activeSearchFieldKeys,
  ) {
    const requestSeq = ++listRequestSeqRef.current
    setTableLoading(true)

    try {
      const availableSearchFields = currentSchema.fields.filter((field) => field.searchConfig?.visible)
      const searchableFields = availableSearchFields.filter((field) => nextSearchFieldKeys.includes(field.fieldKey))
      const listFieldKeys = currentSchema.fields
        .filter((field) => field.listConfig?.visible)
        .map((field) => field.fieldKey)
      const filters = searchableFields
        .reduce<CrudFilterItem[]>((acc, field) => {
          const value = nextQueryValues[field.fieldKey]
          if (field.type === 'date' || field.type === 'datetime') {
            const rangeValue = value && typeof value === 'object' ? value : {}

            if (rangeValue.start) {
              acc.push({
                field: field.fieldKey,
                operator: 'gte',
                value: toSearchBoundaryValue(field, rangeValue.start, 'start'),
              })
            }

            if (rangeValue.end) {
              acc.push({
                field: field.fieldKey,
                operator: 'lte',
                value: toSearchBoundaryValue(field, rangeValue.end, 'end'),
              })
            }

            return acc
          }

          if (value) {
            acc.push({
              field: field.fieldKey,
              operator: getFilterOperator(field),
              value,
            })
          }
          return acc
        }, [])

      const response = await loadCrudList({
        collectionName: String(currentSchema.collection.collectionName),
        fieldKeys: listFieldKeys,
        filters,
        sort: nextSort,
        pagination: {
          pageNo: nextPageNo,
          pageSize: nextPageSize,
        },
      })

      if (requestSeq !== listRequestSeqRef.current) {
        return
      }

      if (response.code === 0) {
        setListResult(response.data)
      } else {
        setListResult({ list: [], pagination: { pageNo: nextPageNo, pageSize: nextPageSize, total: 0 } })
        void message.error(response.message || '加载业务数据失败')
      }
    } catch (error) {
      if (requestSeq === listRequestSeqRef.current) {
        setListResult({ list: [], pagination: { pageNo: nextPageNo, pageSize: nextPageSize, total: 0 } })
        void message.error(error instanceof Error ? error.message : '加载业务数据失败')
      }
    } finally {
      if (requestSeq === listRequestSeqRef.current) {
        setTableLoading(false)
      }
    }
  }

  useEffect(() => {
    async function bootstrap() {
      if (!pageCode) {
        setError('missing pageCode')
        setLoading(false)
        return
      }

      setLoading(true)
      setError('')
      setListResult(null)

      const response = await loadPageRuntimeSchema(pageCode)

      if (response.code !== 0 || !response.data?.pageRuntimeSchema) {
        setError(response.message || 'failed to load schema')
        setLoading(false)
        return
      }

      const normalized = normalizePageRuntimeSchema(response.data.pageRuntimeSchema)
      const collectionName = String(normalized.collection?.collectionName || '').trim()
      const resolvedStorageKey = collectionName ? `collection::${collectionName}` : pageCode
      const initialSort = getDefaultSort(normalized.fields) || getSystemFallbackSort(normalized)
      const defaultSearchFields = normalized.searchFields ?? []
      const storedSearchFieldKeysByCollection = resolvedStorageKey ? readStoredSearchFieldKeys(resolvedStorageKey) : []
      const storedSearchFieldKeysByPageCode = pageCode ? readStoredSearchFieldKeys(pageCode) : []
      const storedSearchFieldKeys =
        storedSearchFieldKeysByCollection.length > 0
          ? storedSearchFieldKeysByCollection
          : storedSearchFieldKeysByPageCode
      const availableSearchFieldMap = new Map(
        normalized.fields
          .filter((field) => field.searchConfig?.visible)
          .map((field) => [field.fieldKey, field]),
      )
      const defaultSearchFieldKeys = defaultSearchFields
        .map((field) => field.fieldKey)
        .filter((fieldKey) => availableSearchFieldMap.has(fieldKey))
      const storedVisibleSearchFieldKeys = storedSearchFieldKeys.filter((fieldKey) => availableSearchFieldMap.has(fieldKey))
      const initialSearchFieldKeys = Array.from(new Set([...defaultSearchFieldKeys, ...storedVisibleSearchFieldKeys]))
      const initialQueryValues = normalized.fields
        .filter((field) => field.searchConfig?.visible)
        .reduce<Record<string, string | { start?: string; end?: string }>>((acc, field) => {
          acc[field.fieldKey] = field.type === 'date' || field.type === 'datetime' ? { start: '', end: '' } : ''
          return acc
        }, {})

      setSchema(normalized)
      setQueryValues(initialQueryValues)
      setDraftQueryValues(initialQueryValues)
      setActiveSearchFieldKeys(initialSearchFieldKeys)
      setSearchFieldStorageKey(resolvedStorageKey || '')
      setSearchFieldStorageReady(true)
      setSort(initialSort)
      setLoading(false)
      writeStoredSearchFieldKeys(resolvedStorageKey || '', initialSearchFieldKeys)
      await refreshList(normalized, initialQueryValues, 1, pageSize, initialSort, initialSearchFieldKeys)
    }

    void bootstrap()
  }, [pageCode])

  useEffect(() => {
    if (!searchFieldStorageKey || !searchFieldStorageReady) {
      return
    }

    writeStoredSearchFieldKeys(searchFieldStorageKey, activeSearchFieldKeys)
  }, [searchFieldStorageKey, activeSearchFieldKeys, searchFieldStorageReady])

  useEffect(() => {
    async function fetchList() {
      if (!schema?.collection.collectionName || loading) {
        return
      }

      await refreshList(schema, queryValues, pageNo, pageSize, sort)
    }

    void fetchList()
  }, [schema, queryValues, pageNo, pageSize, sort, loading])

  function submitSearch() {
    setPageNo(1)
    setQueryValues({ ...draftQueryValues })
  }

  function refreshWithCurrentQuery() {
    if (!schema) {
      return
    }

    setPageNo(1)
    setQueryValues({ ...draftQueryValues })
    void refreshList(schema, draftQueryValues, 1, pageSize, sort)
  }

  function clearSearch() {
    if (!schema) {
      return
    }

    const emptyQueryValues = Object.keys(draftQueryValues).reduce<Record<string, string | { start?: string; end?: string }>>((acc, key) => {
      const field = searchFields.find((item) => item.fieldKey === key)
      acc[key] = field?.type === 'date' || field?.type === 'datetime' ? { start: '', end: '' } : ''
      return acc
    }, {})

    setPageNo(1)
    setDraftQueryValues(emptyQueryValues)
    setQueryValues(emptyQueryValues)
    void refreshList(schema, emptyQueryValues, 1, pageSize, sort)
  }

  useEffect(() => {
    if (!schema || !listResult?.list?.length) {
      return
    }

    const assetFieldKeys = schema.fields
      .filter((field) => field.type === 'image' || field.type === 'file')
      .map((field) => field.fieldKey)

    if (!assetFieldKeys.length) {
      return
    }

    const values = listResult.list.flatMap((record) => assetFieldKeys.map((fieldKey) => record[fieldKey]))
    void preloadAssetUrls(values).catch(() => {})
  }, [schema, listResult])

  useEffect(() => {
    if (!schema || !detailRecord) {
      return
    }

    const values = schema.fields
      .filter((field) => field.type === 'image' || field.type === 'file')
      .map((field) => detailRecord[field.fieldKey])

    void preloadAssetUrls(values).catch(() => {})
  }, [schema, detailRecord])

  useEffect(() => {
    if (!schema || !formVisible) {
      return
    }

    const values = schema.fields
      .filter((field) => field.type === 'image' || field.type === 'file')
      .map((field) => formValues[field.fieldKey])

    void preloadAssetUrls(values).catch(() => {})
  }, [schema, formVisible, formValues])

  function openCreateForm(fields: RuntimeField[]) {
    if (pageCode) {
      navigate(`/generated/${pageCode}/create`)
      return
    }

    setFormMode('create')
    setCurrentRecordId('')
    const initialValues = buildInitialCreateValues(fields)
    setFormValues(initialValues)
    setInitialFormValues(initialValues)
    setFormErrors({})
    setFormSubmitError('')
    setFormVisible(true)
  }

  async function openEditForm(id: string) {
    if (pageCode) {
      navigate(`/generated/${pageCode}/${id}/edit`)
      return
    }

    if (!schema) {
      return
    }
    if (detailLoadingId || editLoadingId) {
      return
    }

    setEditLoadingId(id)
    try {
      const response = await loadCrudDetail({
        collectionName: String(schema.collection.collectionName),
        id,
      })

      if (response.code !== 0 || !response.data.record) {
        void message.error(response.message || '加载记录详情失败')
        return
      }

      setFormMode('edit')
      setCurrentRecordId(id)
      setFormValues(response.data.record)
      setInitialFormValues(response.data.record)
      setFormErrors({})
      setFormSubmitError('')
      setFormVisible(true)
    } finally {
      setEditLoadingId('')
    }
  }

  async function openDetail(id: string) {
    if (!schema) {
      return
    }
    if (detailLoadingId || editLoadingId) {
      return
    }

    setDetailLoadingId(id)
    try {
      const response = await loadCrudDetail({
        collectionName: String(schema.collection.collectionName),
        id,
      })

      if (response.code !== 0) {
        void message.error(response.message || '加载记录详情失败')
        return
      }

      setCurrentRecordId(id)
      setDetailRecord(response.data.record)
      setDetailVisible(true)
    } finally {
      setDetailLoadingId('')
    }
  }

  async function openEditFromDetail() {
    if (!currentRecordId) {
      return
    }

    setDetailVisible(false)
    await openEditForm(currentRecordId)
  }

  async function submitForm() {
    if (!schema || formSubmitting) {
      return
    }

    const activeFields = schema.fields.filter((field) =>
      formMode === 'create' ? field.formConfig?.visibleOnCreate : field.formConfig?.visibleOnEdit,
    )
    const nextErrors = validateRuntimeForm(activeFields, formValues)

    setFormErrors(nextErrors)
    setFormSubmitError('')

    if (Object.keys(nextErrors).length > 0) {
      const firstError = Object.values(nextErrors).find(Boolean)
      setFormSubmitError(firstError ? `请先处理字段错误：${firstError}` : '请先处理字段错误')
      return
    }

    const collectionName = String(schema.collection.collectionName)
    const submittedRecord = buildSubmittedRecord(activeFields, formValues, initialFormValues, formMode)
    setFormSubmitting(true)

    try {
      const response =
        formMode === 'create'
          ? await createCrudRecord({
              collectionName,
              record: submittedRecord,
            })
          : await updateCrudRecord({
              collectionName,
              id: currentRecordId,
              record: submittedRecord,
            })

      if (response.code !== 0) {
        const fieldKey = (response.data as { fieldKey?: string } | null)?.fieldKey

        if (fieldKey) {
          setFormErrors((prev) => ({
            ...prev,
            [fieldKey]: response.message || '字段校验失败',
          }))
        } else {
          const errorMsg = response.message || '保存失败'
          setFormSubmitError(errorMsg)
          void message.error(errorMsg)
        }
        return
      }

      setFormVisible(false)
      await refreshList(schema)
    } finally {
      setFormSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    if (!schema) {
      return
    }

    Modal.confirm({
      title: '确认删除该记录吗？',
      okText: '删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      async onOk() {
        const response = await deleteCrudRecord({
          collectionName: String(schema.collection.collectionName),
          id,
        })

        if (response.code !== 0) {
          void message.error(response.message || '删除失败')
          return Promise.reject(new Error(response.message || '删除失败'))
        }

        await refreshList(schema)
      },
    })
  }

  if (loading) {
    return (
      <div className="generated-page-shell">
        <div className="generated-search-card generated-page-skeleton-search">
          <Skeleton.Input active size="small" block style={{ height: 32 }} />
        </div>
        <div className="page-card generated-table-card">
          <Skeleton active paragraph={{ rows: 8 }} title={false} />
        </div>
      </div>
    )
  }

  if (error || !schema) {
    return (
      <div className="page-card">
        <Result status="warning" title="加载运行时配置失败" subTitle={error || '未知错误'} />
      </div>
    )
  }

  const availableSearchFields = schema.fields.filter((field) => field.searchConfig?.visible)
  const searchFields = availableSearchFields.filter((field) => activeSearchFieldKeys.includes(field.fieldKey))
  const listFields = schema.fields.filter((field) => field.listConfig?.visible)
  const collectionName = String(schema.collection.collectionName || '')
  // 用 PermissionContext 覆盖 schema 中的权限（超管时 contextPerm 全为 true）
  const permissions = {
    ...schema.permissions,
    canList: contextPerm.canList,
    canCreate: contextPerm.canCreate,
    canUpdate: contextPerm.canUpdate,
    canDelete: contextPerm.canDelete,
  }
  const permissionKeys = [
    permissions.canList ? `${collectionName}:list` : '',
    permissions.canCreate ? `${collectionName}:create` : '',
    permissions.canUpdate ? `${collectionName}:update` : '',
    permissions.canDelete ? `${collectionName}:delete` : '',
  ].filter(Boolean)
  const visibleToolbarActions = schema.actions.toolbar.filter((action) =>
    resolveActionVisible(action, permissionKeys),
  )
  const visibleRowActions = schema.actions.row.filter((action) =>
    resolveActionVisible(action, permissionKeys),
  )

  return (
    <div className="generated-page-shell">
      <div className="generated-search-card">
        <RuntimeSearchForm
          allFields={availableSearchFields}
          fields={searchFields}
          dictMap={schema.dictMap}
          values={draftQueryValues}
          loading={tableLoading}
          onAddField={(fieldKey) => {
            setActiveSearchFieldKeys((prev) => (prev.includes(fieldKey) ? prev : [...prev, fieldKey]))
          }}
          onRemoveField={(fieldKey) => {
            const field = availableSearchFields.find((item) => item.fieldKey === fieldKey)
            const isRangeField = field?.type === 'date' || field?.type === 'datetime'
            const emptyValue = isRangeField ? { start: '', end: '' } : ''
            const previousValue = queryValues[fieldKey]
            const hadActiveFilter = isRangeField
              ? Boolean(previousValue && typeof previousValue === 'object' && (previousValue.start || previousValue.end))
              : Boolean(typeof previousValue === 'string' ? previousValue.trim() : previousValue)

            setDraftQueryValues((prev) => ({
              ...prev,
              [fieldKey]: emptyValue,
            }))
            if (hadActiveFilter) {
              setQueryValues((prev) => ({
                ...prev,
                [fieldKey]: emptyValue,
              }))
            }
            setActiveSearchFieldKeys((prev) => prev.filter((key) => key !== fieldKey))
          }}
          onClear={clearSearch}
          onSearch={submitSearch}
          onRefresh={refreshWithCurrentQuery}
          onValueChange={(fieldKey, value) => {
            setDraftQueryValues((prev) => ({
              ...prev,
              [fieldKey]: value,
            }))
          }}
        />
      </div>

      <div className="page-card generated-table-card">
        <RuntimeDataTable
          fields={listFields}
          dictMap={schema.dictMap}
          toolbarActions={visibleToolbarActions}
          rowActions={schema.actions.row}
          visibleRowActions={visibleRowActions}
          result={listResult}
          loading={tableLoading}
          pageNo={pageNo}
          pageSize={pageSize}
          sort={sort}
          detailLoadingId={detailLoadingId}
          editLoadingId={editLoadingId}
          onViewDetail={openDetail}
          onEdit={openEditForm}
          onDelete={handleDelete}
          onPageChange={setPageNo}
          onPageSizeChange={(nextPageSize) => {
            setPageNo(1)
            setPageSize(nextPageSize)
          }}
          onToolbarActionClick={(actionKey) => {
            if (actionKey === 'create') {
              openCreateForm(schema.fields)
            }
          }}
          onRefresh={() => {
            void refreshList(schema)
          }}
          onSortChange={(nextSort) => {
            setPageNo(1)
            setSort(nextSort)
          }}
        />
      </div>

      <RuntimeRecordForm
        visible={formVisible}
        mode={formMode}
        fields={schema.fields.filter((field) =>
          formMode === 'create' ? field.formConfig?.visibleOnCreate : field.formConfig?.visibleOnEdit,
        )}
        dictMap={schema.dictMap}
        collectionName={String(schema.collection.collectionName ?? '')}
        values={formValues}
        errors={formErrors}
        submitError={formSubmitError}
        submitting={formSubmitting}
        onClose={() => {
          if (!formSubmitting) {
            setFormVisible(false)
          }
        }}
        onChange={(fieldKey, value) => {
          setFormValues((prev) => ({
            ...prev,
            [fieldKey]: value,
          }))
          setFormErrors((prev) => ({
            ...prev,
            [fieldKey]: '',
          }))
          setFormSubmitError('')
        }}
        onSubmit={() => void submitForm()}
      />

      <RuntimeRecordDetail
        visible={detailVisible}
        fields={schema.fields.filter((field) => field.detailConfig?.visible)}
        dictMap={schema.dictMap}
        record={detailRecord}
        collectionName={String(schema.collection.collectionName ?? '')}
        onClose={() => setDetailVisible(false)}
        onEdit={permissions.canUpdate ? () => void openEditFromDetail() : undefined}
      />
    </div>
  )
}
