import { useEffect, useMemo, useState } from 'react'
import { loadCollectionSchemaDetail } from '@/runtime/loader/loadCollectionSchemaDetail'
import { listTransferCollections } from '@/runtime/loader/importExport'
import { loadPageRuntimeSchema } from '@/runtime/loader/loadPageRuntimeSchema'
import type { TransferCollectionOption } from '@/types/import-export'
import type { DictOption, RuntimeField } from '@/types/runtime'

const SYSTEM_FIELDS: RuntimeField[] = [
  { fieldKey: '_id', fieldName: '_id', label: '记录 ID', type: 'text' },
  { fieldKey: 'modmin_createTime', fieldName: 'modmin_createTime', label: '创建时间', type: 'datetime' },
  { fieldKey: 'modmin_createBy', fieldName: 'modmin_createBy', label: '创建人', type: 'text' },
  { fieldKey: 'modmin_updateTime', fieldName: 'modmin_updateTime', label: '更新时间', type: 'datetime' },
  { fieldKey: 'modmin_updateBy', fieldName: 'modmin_updateBy', label: '更新人', type: 'text' },
]

interface ExportCollectionContext {
  fields: RuntimeField[]
  searchFields: RuntimeField[]
  dictMap: Record<string, DictOption[]>
}

export function useImportExportCollections() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [collections, setCollections] = useState<TransferCollectionOption[]>([])
  const [fieldMap, setFieldMap] = useState<Record<string, RuntimeField[]>>({})
  const [exportContextMap, setExportContextMap] = useState<Record<string, ExportCollectionContext>>({})

  useEffect(() => {
    void reloadCollections()
  }, [])

  async function reloadCollections() {
    setLoading(true)
    setError('')
    const response = await listTransferCollections()
    setLoading(false)

    if (response.code !== 0) {
      setError(response.message || '加载可导入导出模型失败')
      return
    }

    setCollections(response.data.list)
  }

  async function ensureFields(collectionName: string) {
    if (fieldMap[collectionName]) {
      return fieldMap[collectionName]
    }

    const response = await loadCollectionSchemaDetail(collectionName)
    if (response.code !== 0) {
      throw new Error(response.message || '加载模型字段失败')
    }

    const fields = [...response.data.detail.fields, ...SYSTEM_FIELDS]
    setFieldMap((prev) => ({ ...prev, [collectionName]: fields }))
    return fields
  }

  async function ensureExportContext(collectionName: string) {
    if (exportContextMap[collectionName]) {
      return exportContextMap[collectionName]
    }

    const collection = collections.find((item) => item.collectionName === collectionName)
    if (!collection?.pageCode) {
      const fields = await ensureFields(collectionName)
      const fallback = { fields, searchFields: [], dictMap: {} }
      setExportContextMap((prev) => ({ ...prev, [collectionName]: fallback }))
      return fallback
    }

    const [detailResponse, runtimeResponse] = await Promise.all([
      loadCollectionSchemaDetail(collectionName),
      loadPageRuntimeSchema(collection.pageCode),
    ])

    if (detailResponse.code !== 0) {
      throw new Error(detailResponse.message || '加载模型字段失败')
    }

    if (runtimeResponse.code !== 0) {
      throw new Error(runtimeResponse.message || '加载导出筛选配置失败')
    }

    const fields = [...detailResponse.data.detail.fields, ...SYSTEM_FIELDS]
    const searchFields = runtimeResponse.data.pageRuntimeSchema.fields.filter((field) => field.searchConfig?.visible)
    const nextContext = {
      fields,
      searchFields,
      dictMap: runtimeResponse.data.pageRuntimeSchema.dictMap || {},
    }

    setFieldMap((prev) => ({ ...prev, [collectionName]: fields }))
    setExportContextMap((prev) => ({ ...prev, [collectionName]: nextContext }))
    return nextContext
  }

  const collectionOptions = useMemo(
    () => collections.map((item) => ({ label: `${item.modelName} (${item.collectionName})`, value: item.collectionName })),
    [collections],
  )

  return {
    loading,
    error,
    collections,
    collectionOptions,
    fieldMap,
    exportContextMap,
    reloadCollections,
    ensureFields,
    ensureExportContext,
  }
}
