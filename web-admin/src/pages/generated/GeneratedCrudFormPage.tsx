import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { Button, Card, Result, Row, Skeleton, message } from 'antd'
import { RuntimeReadonlySystemField, RuntimeRecordForm, isSystemReservedField } from '@/components/common/RuntimeRecordForm'
import { createCrudRecord } from '@/runtime/loader/createCrudRecord'
import { loadCrudDetail } from '@/runtime/loader/loadCrudDetail'
import { loadPageRuntimeSchema } from '@/runtime/loader/loadPageRuntimeSchema'
import { normalizePageRuntimeSchema } from '@/runtime/normalizers/normalizePageRuntimeSchema'
import { updateCrudRecord } from '@/runtime/loader/updateCrudRecord'
import { preloadAssetUrls } from '@/services/asset'
import { useModelPermission } from '@/context/PermissionContext'
import type { PageRuntimeSchema } from '@/types/runtime'
import {
  buildInitialCreateValues,
  buildSubmittedRecord,
  validateRuntimeForm,
  type RuntimeFormMode,
} from '@/pages/generated/formUtils'

export function GeneratedCrudFormPage() {
  const { pageCode, recordId } = useParams()
  const navigate = useNavigate()
  const mode: RuntimeFormMode = recordId ? 'edit' : 'create'
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [schema, setSchema] = useState<PageRuntimeSchema | null>(null)
  const [values, setValues] = useState<Record<string, unknown>>({})
  const [initialValues, setInitialValues] = useState<Record<string, unknown>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const schemaCollectionName = String(schema?.collection?.collectionName ?? '')
  const contextPerm = useModelPermission(schemaCollectionName)

  function backToList() {
    navigate(pageCode ? `/generated/${pageCode}` : '/')
  }

  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      if (!pageCode) {
        setError('missing pageCode')
        setLoading(false)
        return
      }

      setLoading(true)
      setError('')

      const schemaResponse = await loadPageRuntimeSchema(pageCode)
      if (cancelled) return

      if (schemaResponse.code !== 0 || !schemaResponse.data?.pageRuntimeSchema) {
        setError(schemaResponse.message || 'failed to load schema')
        setLoading(false)
        return
      }

      const normalized = normalizePageRuntimeSchema(schemaResponse.data.pageRuntimeSchema)
      setSchema(normalized)

      if (mode === 'create') {
        const nextValues = buildInitialCreateValues(normalized.fields)
        setValues(nextValues)
        setInitialValues(nextValues)
        setLoading(false)
        return
      }

      if (!recordId) {
        setError('missing recordId')
        setLoading(false)
        return
      }

      const detailResponse = await loadCrudDetail({
        collectionName: String(normalized.collection.collectionName),
        id: recordId,
      })
      if (cancelled) return

      if (detailResponse.code !== 0 || !detailResponse.data.record) {
        setError(detailResponse.message || '加载记录详情失败')
        setLoading(false)
        return
      }

      setValues(detailResponse.data.record)
      setInitialValues(detailResponse.data.record)
      setLoading(false)
    }

    void bootstrap()

    return () => {
      cancelled = true
    }
  }, [mode, pageCode, recordId])

  useEffect(() => {
    if (!schema) return
    const assetValues = schema.fields
      .filter((field) => field.type === 'image' || field.type === 'file')
      .map((field) => values[field.fieldKey])

    void preloadAssetUrls(assetValues).catch(() => {})
  }, [schema, values])

  async function submitForm() {
    if (!schema || submitting) {
      return
    }

    if ((mode === 'create' && !contextPerm.canCreate) || (mode === 'edit' && !contextPerm.canUpdate)) {
      setSubmitError('无权执行当前操作')
      return
    }

    const activeFields = schema.fields.filter((field) =>
      mode === 'create' ? field.formConfig?.visibleOnCreate : field.formConfig?.visibleOnEdit,
    )
    const nextErrors = validateRuntimeForm(activeFields, values)
    setErrors(nextErrors)
    setSubmitError('')

    if (Object.keys(nextErrors).length > 0) {
      const firstError = Object.values(nextErrors).find(Boolean)
      setSubmitError(firstError ? `请先处理字段错误：${firstError}` : '请先处理字段错误')
      return
    }

    setSubmitting(true)
    try {
      const collectionName = String(schema.collection.collectionName)
      const submittedRecord = buildSubmittedRecord(activeFields, values, initialValues, mode)
      const response =
        mode === 'create'
          ? await createCrudRecord({ collectionName, record: submittedRecord })
          : await updateCrudRecord({ collectionName, id: String(recordId), record: submittedRecord })

      if (response.code !== 0) {
        const fieldKey = (response.data as { fieldKey?: string } | null)?.fieldKey

        if (fieldKey) {
          setErrors((prev) => ({
            ...prev,
            [fieldKey]: response.message || '字段校验失败',
          }))
        } else {
          const errorMsg = response.message || '保存失败'
          setSubmitError(errorMsg)
          void message.error(errorMsg)
        }
        return
      }

      void message.success(mode === 'create' ? '创建成功' : '保存成功')
      backToList()
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="generated-form-page">
        <Card>
          <Skeleton active paragraph={{ rows: 8 }} title />
        </Card>
      </div>
    )
  }

  if (error || !schema) {
    return (
      <div className="page-card">
        <Result
          status="warning"
          title="加载表单失败"
          subTitle={error || '未知错误'}
          extra={<Button onClick={backToList}>返回列表</Button>}
        />
      </div>
    )
  }

  const hasWritePermission = mode === 'create' ? contextPerm.canCreate : contextPerm.canUpdate

  if (!hasWritePermission) {
    return <Navigate to="/no-access" replace />
  }

  const activeFields = schema.fields.filter((field) =>
    mode === 'create' ? field.formConfig?.visibleOnCreate : field.formConfig?.visibleOnEdit,
  )
  const systemFields = activeFields.filter((field) => isSystemReservedField(field.fieldKey))
  const businessFields = activeFields.filter((field) => !isSystemReservedField(field.fieldKey))
  const collectionName = String(schema.collection.collectionName ?? '')

  return (
    <div className="generated-form-page">
      {systemFields.length > 0 ? (
        <Card className="generated-form-system-card">
          <div className="runtime-record-form-system-head">
            <strong>系统字段</strong>
            <span>自动维护，只读显示</span>
          </div>
          <Row gutter={[12, 10]}>
            {systemFields.map((field) => (
              <RuntimeReadonlySystemField key={field.fieldKey} field={field} value={values[field.fieldKey]} />
            ))}
          </Row>
        </Card>
      ) : null}
      <Card className="generated-form-page-card">
        <RuntimeRecordForm
          visible
          variant="page"
          mode={mode}
          fields={businessFields}
          dictMap={schema.dictMap}
          collectionName={collectionName}
          values={values}
          errors={errors}
          submitError={submitError}
          submitting={submitting}
          onClose={backToList}
          onChange={(fieldKey, value) => {
            setValues((prev) => ({
              ...prev,
              [fieldKey]: value,
            }))
            setErrors((prev) => ({
              ...prev,
              [fieldKey]: '',
            }))
            setSubmitError('')
          }}
          onSubmit={() => void submitForm()}
        />
      </Card>
    </div>
  )
}
