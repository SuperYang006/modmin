import { useEffect, useMemo, useState } from 'react'
import { Button, Cascader, DatePicker, Dropdown, Empty, Image, Input, Popover, Select, Upload } from 'antd'
import { CloudUploadOutlined, DeleteOutlined, EyeOutlined, FileOutlined, PictureOutlined, PlaySquareOutlined, PlusOutlined, SoundOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { RcFile, UploadFile } from 'antd/es/upload/interface'
import type { DictOption, RuntimeField } from '@/types/runtime'
import { getFieldTypeDefinition } from '@/runtime/fieldTypes/registry'
import { RelationDetailTrigger } from '@/components/common/RelationDetailTrigger'
import {
  buildMultiPolyRelationDetailRecords,
  buildRelationManyDetailRecords,
  buildSingleRelationDetailRecord,
  getCurrentRelationOption,
  getRelationDisplayFields,
  parseMultiPolyRelationValues,
  parsePolyRelationValue,
  parseRelationManyIds,
} from '@/runtime/relations/relationRecords'
import {
  buildAddressValueFromPath,
  formatAddressText,
  getChinaAreaOptionsByGranularity,
  getAddressPathFromJson,
  normalizeAddressPathByGranularity,
} from '@/runtime/address/chinaArea'
import { isImageAsset, parseUploadedAssetValue, parseUploadedAssetValues, uploadAsset, useResolvedAssetUrl, useResolvedAssetUrlMap } from '@/services/asset'
import { loadCrudList } from '@/runtime/loader/loadCrudList'

interface SearchRendererProps {
  field: RuntimeField
  value: string | { start?: string; end?: string }
  dictMap: Record<string, DictOption[]>
  onChange: (value: string | { start?: string; end?: string }) => void
}

interface FormRendererProps {
  field: RuntimeField
  value: any
  dictMap: Record<string, DictOption[]>
  collectionName: string
  onChange: (value: any) => void
  readonly?: boolean
}

interface DisplayRendererProps {
  field: RuntimeField
  value: unknown
  dictMap: Record<string, DictOption[]>
  mode?: 'table' | 'detail'
}

interface PolyRelationValue {
  collection: string
  id: string
}

interface MultiPolyRelationValue {
  collection: string
  id: string
}

interface RelationOption {
  value: string
  label: string
  raw: Record<string, unknown>
}

function getDictOptions(field: RuntimeField, dictMap: Record<string, DictOption[]>) {
  if (Array.isArray(field.enumOptions) && field.enumOptions.length > 0) {
    return field.enumOptions
  }

  if (field.fieldKey === 'status') {
    return dictMap.article_status ?? []
  }

  return []
}

function formatRelationRecordLabel(record: Record<string, unknown>, displayFields: string[]) {
  const firstValue = displayFields
    .map((fieldKey) => record[fieldKey])
    .find((value) => value !== null && value !== undefined && value !== '')
  const recordId = typeof record._id === 'string' ? record._id : ''
  return formatRelationValue(firstValue) || recordId || '未命名记录'
}

function formatRelationValue(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return ''
  }

  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      return '[object]'
    }
  }

  return String(value)
}

function useRelationOptions(collectionName: string, displayFields: string[]) {
  const [options, setOptions] = useState<RelationOption[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function fetchOptions() {
      if (!collectionName) {
        setOptions([])
        setError('')
        return
      }

      setLoading(true)
      setError('')

      try {
        const response = await loadCrudList({
          collectionName,
          pagination: {
            pageNo: 1,
            pageSize: 100,
          },
        })

        if (cancelled) {
          return
        }

        if (response.code !== 0 || !response.data?.list) {
          setOptions([])
          setError(response.message || '关联记录加载失败')
          return
        }

        const nextOptions = response.data.list
          .filter((item) => item && typeof item === 'object' && typeof item._id === 'string')
          .map((item) => ({
            value: String(item._id),
            label: formatRelationRecordLabel(item, displayFields),
            raw: item,
          }))

        setOptions(nextOptions)
      } catch (nextError) {
        if (!cancelled) {
          setOptions([])
          setError(nextError instanceof Error ? nextError.message : '关联记录加载失败')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void fetchOptions()

    return () => {
      cancelled = true
    }
  }, [collectionName, displayFields])

  return {
    options,
    loading,
    error,
  }
}

function useRelationOptionMap(collectionName: string, displayFieldsMap: Record<string, string[]>, collections: string[]) {
  const [optionsMap, setOptionsMap] = useState<Record<string, RelationOption[]>>({})
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({})
  const [errorMap, setErrorMap] = useState<Record<string, string>>({})

  const stableCollections = useMemo(() => collections.filter(Boolean), [collections])

  useEffect(() => {
    let cancelled = false

    async function fetchAll() {
      const missingCollections = stableCollections.filter((item) => !optionsMap[item])

      if (!collectionName || missingCollections.length === 0) {
        return
      }

      setLoadingMap((prev) =>
        missingCollections.reduce<Record<string, boolean>>(
          (acc, item) => ({
            ...acc,
            [item]: true,
          }),
          { ...prev },
        ),
      )

      await Promise.all(
        missingCollections.map(async (targetCollection) => {
          try {
            const response = await loadCrudList({
              collectionName: targetCollection,
              pagination: {
                pageNo: 1,
                pageSize: 100,
              },
            })

            if (cancelled) {
              return
            }

            if (response.code !== 0 || !response.data?.list) {
              setErrorMap((prev) => ({
                ...prev,
                [targetCollection]: response.message || '关联记录加载失败',
              }))
              setOptionsMap((prev) => ({
                ...prev,
                [targetCollection]: [],
              }))
              return
            }

            const displayFields = displayFieldsMap[targetCollection] ?? []
            const nextOptions = response.data.list
              .filter((item) => item && typeof item === 'object' && typeof item._id === 'string')
              .map((item) => ({
                value: String(item._id),
                label: formatRelationRecordLabel(item, displayFields),
                raw: item,
              }))

            setOptionsMap((prev) => ({
              ...prev,
              [targetCollection]: nextOptions,
            }))
            setErrorMap((prev) => ({
              ...prev,
              [targetCollection]: '',
            }))
          } catch (nextError) {
            if (!cancelled) {
              setOptionsMap((prev) => ({
                ...prev,
                [targetCollection]: [],
              }))
              setErrorMap((prev) => ({
                ...prev,
                [targetCollection]: nextError instanceof Error ? nextError.message : '关联记录加载失败',
              }))
            }
          } finally {
            if (!cancelled) {
              setLoadingMap((prev) => ({
                ...prev,
                [targetCollection]: false,
              }))
            }
          }
        }),
      )
    }

    void fetchAll()

    return () => {
      cancelled = true
    }
  }, [collectionName, displayFieldsMap, stableCollections, optionsMap])

  return {
    optionsMap,
    loadingMap,
    errorMap,
  }
}

function renderRelationOptionHint(
  collectionName: string,
  displayFields: string[],
  loading: boolean,
  error: string,
  optionCount: number,
) {
  if (loading) {
    return <em className="field-help-text">正在加载候选记录...</em>
  }

  if (error) {
    return <em className="field-help-text runtime-relation-error">候选记录加载失败：{error}</em>
  }

  return <em className="field-help-text">{`已加载 ${optionCount} 条候选记录`}</em>
}

function getSelectPopupContainer(triggerNode: HTMLElement) {
  const container =
    triggerNode.closest('.runtime-record-form-body') ||
    triggerNode.closest('.ant-drawer-body') ||
    triggerNode.parentElement ||
    triggerNode

  return container instanceof HTMLElement ? container : document.body
}

function getSearchPickerPopupContainer() {
  return document.body
}

function formatRelationCollectionLabel(collection: string) {
  if (!collection) {
    return ''
  }

  return '关联项'
}

function buildLengthHelpText(field: RuntimeField) {
  const minRule = field.validationRules?.find((rule) => rule.ruleType === 'minLength' && typeof rule.value === 'number')
  const maxRule = field.validationRules?.find((rule) => rule.ruleType === 'maxLength' && typeof rule.value === 'number')
  const minLength = typeof field.minLength === 'number' ? field.minLength : typeof minRule?.value === 'number' ? minRule.value : null
  const maxLength = typeof field.maxLength === 'number' ? field.maxLength : typeof maxRule?.value === 'number' ? maxRule.value : null

  if (minLength === null && maxLength === null) {
    return ''
  }

  if (minLength !== null && maxLength !== null) {
    return minLength === maxLength ? `长度需为 ${minLength} 个字符` : `长度范围：${minLength}-${maxLength} 个字符`
  }

  if (minLength !== null) {
    return `至少 ${minLength} 个字符`
  }

  return `最多 ${maxLength} 个字符`
}

function buildNumberRangeHelpText(field: RuntimeField) {
  const minRule = field.validationRules?.find((rule) => rule.ruleType === 'minValue' && typeof rule.value === 'number')
  const maxRule = field.validationRules?.find((rule) => rule.ruleType === 'maxValue' && typeof rule.value === 'number')
  const minValue = typeof field.minValue === 'number' ? field.minValue : typeof minRule?.value === 'number' ? minRule.value : null
  const maxValue = typeof field.maxValue === 'number' ? field.maxValue : typeof maxRule?.value === 'number' ? maxRule.value : null

  if (minValue === null && maxValue === null) {
    return ''
  }

  if (minValue !== null && maxValue !== null) {
    return minValue === maxValue ? `数值需为 ${minValue}` : `数值范围：${minValue}-${maxValue}`
  }

  if (minValue !== null) {
    return `不能小于 ${minValue}`
  }

  return `不能大于 ${maxValue}`
}

function renderFieldHelpText(field: RuntimeField, extraText = '') {
  const texts = [field.description || '', extraText].map((item) => item.trim()).filter(Boolean)

  if (texts.length === 0) {
    return null
  }

  return <em className="field-help-text">{texts.join('；')}</em>
}

function FormRelationDetailAction(props: { field: RuntimeField; value: unknown }) {
  const { field, value } = props

  if (field.type === 'relationOne' || field.type === 'relation') {
    const collectionName = typeof field.relationModelCollection === 'string' ? field.relationModelCollection : ''
    const displayFields = getRelationDisplayFields(field)
    const relationId = typeof value === 'string' ? value : ''
    const { options } = useRelationOptions(collectionName, displayFields)
    const option = getCurrentRelationOption(relationId, options)

    return <RelationDetailTrigger title={field.label} records={buildSingleRelationDetailRecord(option, displayFields)} />
  }

  if (field.type === 'relationMany' || field.type === 'multiRelation') {
    const collectionName = typeof field.relationModelCollection === 'string' ? field.relationModelCollection : ''
    const displayFields = getRelationDisplayFields(field)
    const { options } = useRelationOptions(collectionName, displayFields)
    const values = parseRelationManyIds(value)
    const records = buildRelationManyDetailRecords(values, options, displayFields)

    return <RelationDetailTrigger title={field.label} records={records} />
  }

  if (field.type === 'polyRelation') {
    const relation = parsePolyRelationValue(value)
    const displayFields = getRelationDisplayFields(field, relation.collection)
    const { options } = useRelationOptions(relation.collection, displayFields)
    const option = getCurrentRelationOption(relation.id, options)

    return <RelationDetailTrigger title={field.label} records={buildSingleRelationDetailRecord(option, displayFields)} />
  }

  if (field.type === 'multiPolyRelation') {
    const relations = parseMultiPolyRelationValues(value)
    const collections = relations.map((item) => item.collection).filter(Boolean)
    const displayMap =
      field.polyRelationDisplayMap && typeof field.polyRelationDisplayMap === 'object'
        ? field.polyRelationDisplayMap
        : {}
    const { optionsMap } = useRelationOptionMap('multiPolyRelationFormDetail', displayMap, collections)
    const records = buildMultiPolyRelationDetailRecords(relations, displayMap, optionsMap)

    return <RelationDetailTrigger title={field.label} records={records} />
  }

  return null
}

function renderInputField(field: RuntimeField, value: unknown, onChange: (value: string) => void, type = 'text') {
  const normalizedValue =
    typeof value === 'string'
      ? value
      : typeof value === 'number' && Number.isFinite(value)
        ? String(value)
        : ''

  return (
    <label key={field.fieldKey} className="field-stack">
      <span>{field.label}</span>
      <input
        type={type}
        value={normalizedValue}
        min={type === 'number' && typeof field.minValue === 'number' ? field.minValue : undefined}
        max={type === 'number' && typeof field.maxValue === 'number' ? field.maxValue : undefined}
        disabled={field.readonly === true}
        onChange={(event) => onChange(event.target.value)}
      />
      {renderFieldHelpText(field, field.type === 'number' ? buildNumberRangeHelpText(field) : buildLengthHelpText(field))}
    </label>
  )
}

function formatDateInputValue(
  value: unknown,
  type: 'date' | 'datetime',
  storageFormat: RuntimeField['dateStorageFormat'] = 'string',
) {
  if (value === null || value === undefined || value === '') {
    return ''
  }

  let nextDate: Date | null = null

  if (value instanceof Date) {
    nextDate = value
  } else if (typeof value === 'number') {
    const resolvedTime =
      storageFormat === 'timestamp'
        ? value * 1000
        : storageFormat === 'timestampMs'
          ? value
          : value < 1e11
            ? value * 1000
            : value
    nextDate = new Date(resolvedTime)
  } else if (typeof value === 'string') {
    if (value.trim() === '') {
      return ''
    }

    if (/^\d+$/.test(value.trim())) {
      const numericValue = Number(value)
      const resolvedTime =
        storageFormat === 'timestamp'
          ? numericValue * 1000
          : storageFormat === 'timestampMs'
            ? numericValue
            : value.trim().length <= 10 || numericValue < 1e11
              ? numericValue * 1000
              : numericValue
      nextDate = new Date(resolvedTime)
    } else {
      nextDate = new Date(value)
    }
  }

  if (!nextDate || Number.isNaN(nextDate.getTime())) {
    return typeof value === 'string' ? value : ''
  }

  if (type === 'date') {
    return nextDate.toISOString().slice(0, 10)
  }

  const year = nextDate.getFullYear()
  const month = String(nextDate.getMonth() + 1).padStart(2, '0')
  const day = String(nextDate.getDate()).padStart(2, '0')
  const hours = String(nextDate.getHours()).padStart(2, '0')
  const minutes = String(nextDate.getMinutes()).padStart(2, '0')
  const seconds = String(nextDate.getSeconds()).padStart(2, '0')

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`
}

function getSinglePickerValue(
  value: unknown,
  type: 'date' | 'datetime',
  storageFormat: RuntimeField['dateStorageFormat'] = 'string',
) {
  const formattedValue = formatDateInputValue(value, type, storageFormat)

  if (!formattedValue) {
    return null
  }

  const parsed = dayjs(formattedValue)
  return parsed.isValid() ? parsed : null
}

function serializeSinglePickerValue(
  value: dayjs.Dayjs | null,
  type: 'date' | 'datetime',
  storageFormat: RuntimeField['dateStorageFormat'] = 'string',
) {
  if (!value) {
    return ''
  }

  const resolved = type === 'date' ? value.startOf('day') : value

  if (storageFormat === 'timestamp') {
    return resolved.unix()
  }

  if (storageFormat === 'timestampMs') {
    return resolved.valueOf()
  }

  if (type === 'date') {
    return resolved.format('YYYY-MM-DD')
  }

  return resolved.format('YYYY-MM-DD HH:mm:ss')
}

function formatDisplayText(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return '-'
  }

  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      return '[object]'
    }
  }

  return String(value)
}

function truncateDisplayText(text: string, maxLength = 48) {
  if (text.length <= maxLength) {
    return text
  }

  return `${text.slice(0, maxLength)}...`
}

function textSearchRenderer(props: SearchRendererProps) {
  const value = typeof props.value === 'string' ? props.value : ''
  return renderInputField(props.field, value, props.onChange)
}

function textareaSearchRenderer(props: SearchRendererProps) {
  return textSearchRenderer(props)
}

function dateSearchRenderer(props: SearchRendererProps) {
  const value = props.value && typeof props.value === 'object' ? props.value : {}
  const rangeValue: [dayjs.Dayjs | null, dayjs.Dayjs | null] = [
    typeof value.start === 'string' && value.start ? dayjs(value.start) : null,
    typeof value.end === 'string' && value.end ? dayjs(value.end) : null,
  ]

  return (
    <label key={props.field.fieldKey} className="field-stack runtime-search-range-field">
      <span>{props.field.label}</span>
      <DatePicker.RangePicker
        className="runtime-search-picker"
        value={rangeValue}
        format="YYYY-MM-DD"
        allowClear
        placement="bottomLeft"
        getPopupContainer={getSearchPickerPopupContainer}
        onChange={(dates) =>
          props.onChange({
            start: dates?.[0] ? dates[0].format('YYYY-MM-DD') : '',
            end: dates?.[1] ? dates[1].format('YYYY-MM-DD') : '',
          })
        }
      />
    </label>
  )
}

function datetimeSearchRenderer(props: SearchRendererProps) {
  const value = props.value && typeof props.value === 'object' ? props.value : {}
  const rangeValue: [dayjs.Dayjs | null, dayjs.Dayjs | null] = [
    typeof value.start === 'string' && value.start ? dayjs(value.start) : null,
    typeof value.end === 'string' && value.end ? dayjs(value.end) : null,
  ]

  return (
    <label key={props.field.fieldKey} className="field-stack runtime-search-range-field runtime-search-range-field-datetime">
      <span>{props.field.label}</span>
      <DatePicker.RangePicker
        className="runtime-search-picker"
        value={rangeValue}
        format="YYYY-MM-DD HH:mm:ss"
        showTime={{ format: 'HH:mm:ss' }}
        allowClear
        placement="bottomLeft"
        getPopupContainer={getSearchPickerPopupContainer}
        onChange={(dates) =>
          props.onChange({
            start: dates?.[0] ? dates[0].format('YYYY-MM-DD HH:mm:ss') : '',
            end: dates?.[1] ? dates[1].format('YYYY-MM-DD HH:mm:ss') : '',
          })
        }
      />
    </label>
  )
}

function selectSearchRenderer(props: SearchRendererProps) {
  const options = getDictOptions(props.field, props.dictMap)
  const value = typeof props.value === 'string' ? props.value : ''
  const currentOption = options.find((option) => option.value === value)
  const menuItems = [
    {
      key: '__all__',
      label: '全部',
    },
    ...options.map((option) => ({
      key: option.value,
      label: option.label,
    })),
  ]

  return (
    <label key={props.field.fieldKey} className="field-stack">
      <span>{props.field.label}</span>
      <Dropdown
        trigger={['click']}
        placement="bottomLeft"
        getPopupContainer={getSearchPickerPopupContainer}
        menu={{
          items: menuItems,
          selectedKeys: value ? [value] : ['__all__'],
          onClick: ({ key }) => props.onChange(key === '__all__' ? '' : String(key)),
        }}
      >
        <button type="button" className="runtime-search-dropdown-button">
          <span className={`runtime-search-dropdown-label${currentOption ? '' : ' is-placeholder'}`}>
            {currentOption?.label || '全部'}
          </span>
          <span className="runtime-search-dropdown-icon">▾</span>
        </button>
      </Dropdown>
    </label>
  )
}

function switchSearchRenderer(props: SearchRendererProps) {
  const value = typeof props.value === 'string' ? props.value : ''
  const options = [
    { label: '是', value: 'true' },
    { label: '否', value: 'false' },
  ]
  const currentOption = options.find((option) => option.value === value)
  const menuItems = [
    {
      key: '__all__',
      label: '全部',
    },
    ...options.map((option) => ({
      key: option.value,
      label: option.label,
    })),
  ]

  return (
    <label key={props.field.fieldKey} className="field-stack">
      <span>{props.field.label}</span>
      <Dropdown
        trigger={['click']}
        placement="bottomLeft"
        getPopupContainer={getSearchPickerPopupContainer}
        menu={{
          items: menuItems,
          selectedKeys: value ? [value] : ['__all__'],
          onClick: ({ key }) => props.onChange(key === '__all__' ? '' : String(key)),
        }}
      >
        <button type="button" className="runtime-search-dropdown-button">
          <span className={`runtime-search-dropdown-label${currentOption ? '' : ' is-placeholder'}`}>
            {currentOption?.label || '全部'}
          </span>
          <span className="runtime-search-dropdown-icon">▾</span>
        </button>
      </Dropdown>
    </label>
  )
}

function renderFormDropdownField(
  field: RuntimeField,
  value: string,
  options: Array<{ label: string; value: string }>,
  onChange: (value: string) => void,
  placeholder = '请选择',
) {
  const currentOption = options.find((option) => option.value === value)
  const menuItems = [
    {
      key: '__empty__',
      label: placeholder,
    },
    ...options.map((option) => ({
      key: option.value,
      label: option.label,
    })),
  ]

  return (
    <label key={field.fieldKey} className="field-stack">
      <span>{field.label}</span>
      <Dropdown
        trigger={['click']}
        placement="bottomLeft"
        getPopupContainer={getSelectPopupContainer}
        menu={{
          items: menuItems,
          selectedKeys: value ? [value] : ['__empty__'],
          onClick: ({ key }) => onChange(key === '__empty__' ? '' : String(key)),
        }}
        disabled={field.readonly === true}
      >
        <button type="button" className="runtime-search-dropdown-button" disabled={field.readonly === true}>
          <span className={`runtime-search-dropdown-label${currentOption ? '' : ' is-placeholder'}`}>
            {currentOption?.label || placeholder}
          </span>
          <span className="runtime-search-dropdown-icon">▾</span>
        </button>
      </Dropdown>
      {field.description ? <em className="field-help-text">{field.description}</em> : null}
    </label>
  )
}

function textFormRenderer(props: FormRendererProps) {
  return renderInputField(props.field, props.value, props.onChange)
}

function numberFormRenderer(props: FormRendererProps) {
  return renderInputField(props.field, props.value, props.onChange, 'number')
}

function textareaFormRenderer(props: FormRendererProps) {
  return (
    <label key={props.field.fieldKey} className="field-stack">
      <span>{props.field.label}</span>
      <textarea
        className="runtime-textarea"
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
      />
      {renderFieldHelpText(props.field, buildLengthHelpText(props.field))}
    </label>
  )
}

function jsonFormRenderer(props: FormRendererProps) {
  const valueText =
    typeof props.value === 'string'
      ? props.value
      : props.value === null || props.value === undefined || props.value === ''
        ? ''
        : JSON.stringify(props.value, null, 2)

  return (
    <label key={props.field.fieldKey} className="field-stack">
      <span>{props.field.label}</span>
      <textarea
        className="runtime-textarea"
        value={valueText}
        disabled={props.field.readonly === true}
        onChange={(event) => props.onChange(event.target.value)}
      />
      {props.field.description ? <em className="field-help-text">{props.field.description}</em> : null}
    </label>
  )
}

function dateFormRenderer(props: FormRendererProps) {
  return (
    <label key={props.field.fieldKey} className="field-stack">
      <span>{props.field.label}</span>
      <DatePicker
        className="runtime-search-picker"
        value={getSinglePickerValue(props.value, 'date', props.field.dateStorageFormat)}
        format="YYYY-MM-DD"
        allowClear
        disabled={props.field.readonly === true}
        placement="bottomLeft"
        getPopupContainer={getSelectPopupContainer}
        onChange={(date) => props.onChange(serializeSinglePickerValue(date, 'date', props.field.dateStorageFormat))}
      />
      {props.field.description ? <em className="field-help-text">{props.field.description}</em> : null}
    </label>
  )
}

function datetimeFormRenderer(props: FormRendererProps) {
  return (
    <label key={props.field.fieldKey} className="field-stack">
      <span>{props.field.label}</span>
      <DatePicker
        className="runtime-search-picker"
        value={getSinglePickerValue(props.value, 'datetime', props.field.dateStorageFormat)}
        format="YYYY-MM-DD HH:mm:ss"
        showTime={{ format: 'HH:mm:ss' }}
        allowClear
        disabled={props.field.readonly === true}
        placement="bottomLeft"
        getPopupContainer={getSelectPopupContainer}
        onChange={(date) => props.onChange(serializeSinglePickerValue(date, 'datetime', props.field.dateStorageFormat))}
      />
      {props.field.description ? <em className="field-help-text">{props.field.description}</em> : null}
    </label>
  )
}

function selectFormRenderer(props: FormRendererProps) {
  const options = getDictOptions(props.field, props.dictMap)
  const value = typeof props.value === 'string' ? props.value : ''

  return renderFormDropdownField(props.field, value, options, props.onChange, '请选择')
}

function switchFormRenderer(props: FormRendererProps) {
  const value =
    props.value === true
      ? 'true'
      : props.value === false
      ? 'false'
        : typeof props.value === 'string'
          ? props.value
          : ''
  const options = [
    { label: '是', value: 'true' },
    { label: '否', value: 'false' },
  ]

  return renderFormDropdownField(props.field, value, options, props.onChange, '请选择')
}

function multiSelectFormRenderer(props: FormRendererProps) {
  const options = getDictOptions(props.field, props.dictMap)
  const currentValue = Array.isArray(props.value)
    ? props.value.map((item) => String(item))
    : typeof props.value === 'string' && props.value
      ? props.value.split(',')
      : []

  return (
    <label key={props.field.fieldKey} className="field-stack">
      <span>{props.field.label}</span>
      <select
        multiple
        className="runtime-multiselect"
        value={currentValue}
        disabled={props.field.readonly === true}
        onChange={(event) => {
          const nextValue = Array.from(event.target.selectedOptions)
            .map((option) => option.value)
            .join(',')
          props.onChange(nextValue)
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {props.field.description ? <em className="field-help-text">{props.field.description}</em> : null}
    </label>
  )
}

function arrayFormRenderer(props: FormRendererProps) {
  function parseItems() {
    if (Array.isArray(props.value)) {
      return props.value
    }

    if (typeof props.value !== 'string' || !props.value.trim()) {
      return []
    }

    try {
      const parsed = JSON.parse(props.value)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  function normalizeItemValue(value: string) {
    if (props.field.itemType === 'number') {
      const nextNumber = Number(value)
      return Number.isNaN(nextNumber) ? value : nextNumber
    }

    if (props.field.itemType === 'boolean') {
      return value === 'true'
    }

    return value
  }

  function emit(items: unknown[]) {
    props.onChange(JSON.stringify(items))
  }

  const items = parseItems()
  const itemType = props.field.itemType || 'text'

  function updateItem(index: number, value: string) {
    emit(items.map((item, itemIndex) => (itemIndex === index ? normalizeItemValue(value) : item)))
  }

  function removeItem(index: number) {
    emit(items.filter((_, itemIndex) => itemIndex !== index))
  }

  function addItem() {
    emit([...items, itemType === 'boolean' ? false : itemType === 'number' ? 0 : ''])
  }

  return (
    <div key={props.field.fieldKey} className="field-stack">
      <span>{props.field.label}</span>
      <div className="runtime-array-editor">
        {items.length > 0 ? (
          <div className="runtime-array-list">
            {items.map((item, index) => (
              <div key={`array-item-${index}`} className="runtime-array-item">
                {itemType === 'boolean' ? (
                  <Select
                    value={item === true ? 'true' : 'false'}
                    disabled={props.field.readonly === true}
                    options={[
                      { label: '是', value: 'true' },
                      { label: '否', value: 'false' },
                    ]}
                    onChange={(value) => updateItem(index, value)}
                  />
                ) : (
                  <Input
                    type={itemType === 'number' ? 'number' : 'text'}
                    value={typeof item === 'object' ? JSON.stringify(item) : String(item ?? '')}
                    disabled={props.field.readonly === true}
                    onChange={(event) => updateItem(index, event.target.value)}
                    placeholder={`第 ${index + 1} 项`}
                  />
                )}
                {props.field.readonly ? null : (
                  <Button
                    danger
                    type="text"
                    icon={<DeleteOutlined />}
                    className="runtime-array-remove"
                    onClick={() => removeItem(index)}
                  >
                    删除
                  </Button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数组项" className="runtime-array-empty" />
        )}
        {props.field.readonly ? null : (
          <Button type="dashed" icon={<PlusOutlined />} className="runtime-array-add" onClick={addItem}>
            新增一项
          </Button>
        )}
      </div>
      {props.field.description ? <em className="field-help-text">{props.field.description}</em> : null}
    </div>
  )
}

function buildPolyRelationValue(value: PolyRelationValue) {
  if (!value.collection.trim() && !value.id.trim()) {
    return ''
  }

  return JSON.stringify({
    collection: value.collection.trim(),
    id: value.id.trim(),
  })
}

function polyRelationFormRenderer(props: FormRendererProps) {
  const relation = parsePolyRelationValue(props.value)
  const collectionOptions = Array.isArray(props.field.relationModelCollections) ? props.field.relationModelCollections : []
  const displayFields = getRelationDisplayFields(props.field, relation.collection)
  const { options, loading, error } = useRelationOptions(relation.collection, displayFields)
  const currentOption = relation.id ? options.find((item) => item.value === relation.id) : undefined

  function updateRelation(nextPatch: Partial<PolyRelationValue>) {
    const nextValue = {
      ...relation,
      ...nextPatch,
    }
    props.onChange(buildPolyRelationValue(nextValue))
  }

  return (
    <label key={props.field.fieldKey} className="field-stack">
      <span>{props.field.label}</span>
      <div className="field-stack" style={{ gap: 12 }}>
        <select
          value={relation.collection}
          disabled={props.field.readonly === true}
          onChange={(event) =>
            updateRelation({
              collection: event.target.value,
              id: '',
            })}
        >
          <option value="">请选择关联项</option>
          {collectionOptions.map((collection) => (
            <option key={collection} value={collection}>
              {formatRelationCollectionLabel(collection)}
            </option>
          ))}
        </select>
        <Select
          showSearch
          allowClear
          getPopupContainer={getSelectPopupContainer}
          value={relation.id || undefined}
          disabled={!relation.collection || props.field.readonly === true}
          placeholder={relation.collection ? '请选择关联项' : '请先选择类型'}
          options={[
            ...(relation.id && !currentOption ? [{ value: relation.id, label: '当前值' }] : []),
            ...options.map((option) => ({ value: option.value, label: option.label })),
          ]}
          filterOption={(input, option) => String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
          onChange={(nextValue) => updateRelation({ id: typeof nextValue === 'string' ? nextValue : '' })}
        />
        {renderRelationOptionHint(relation.collection, displayFields, loading, error, options.length)}
      </div>
      {props.field.description ? <em className="field-help-text">{props.field.description}</em> : null}
    </label>
  )
}

function relationOneFormRenderer(props: FormRendererProps) {
  const relationModelCollection = typeof props.field.relationModelCollection === 'string' ? props.field.relationModelCollection : ''
  const displayFields = getRelationDisplayFields(props.field)
  const { options, loading, error } = useRelationOptions(relationModelCollection, displayFields)
  const currentOption = props.value ? options.find((item) => item.value === props.value) : undefined

  return (
    <label key={props.field.fieldKey} className="field-stack">
      <span>{props.field.label}</span>
      <div className="field-stack" style={{ gap: 12 }}>
        <Select
          showSearch
          allowClear
          getPopupContainer={getSelectPopupContainer}
          value={props.value || undefined}
          disabled={!relationModelCollection || props.field.readonly === true}
          placeholder={relationModelCollection ? '请选择关联项' : '请先选择类型'}
          options={[
            ...(props.value && !currentOption ? [{ value: props.value, label: '当前值' }] : []),
            ...options.map((option) => ({ value: option.value, label: option.label })),
          ]}
          filterOption={(input, option) => String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
          onChange={(nextValue) => props.onChange(typeof nextValue === 'string' ? nextValue : '')}
        />
        {renderRelationOptionHint(relationModelCollection, displayFields, loading, error, options.length)}
      </div>
      {props.field.description ? <em className="field-help-text">{props.field.description}</em> : null}
    </label>
  )
}

function relationManyFormRenderer(props: FormRendererProps) {
  const relationModelCollection = typeof props.field.relationModelCollection === 'string' ? props.field.relationModelCollection : ''
  const displayFields = getRelationDisplayFields(props.field)
  const { options, loading, error } = useRelationOptions(relationModelCollection, displayFields)
  const selectedValues = useMemo(() => parseRelationManyIds(props.value), [props.value])
  const currentOptions = selectedValues.map((value) => options.find((item) => item.value === value)).filter(Boolean) as RelationOption[]

  function emit(nextValues: string[]) {
    const normalized = nextValues.map((item) => item.trim()).filter(Boolean)

    if (normalized.length === 0) {
      props.onChange('')
      return
    }

    props.onChange(JSON.stringify(normalized))
  }

  return (
    <label key={props.field.fieldKey} className="field-stack">
      <span>{props.field.label}</span>
      <div className="runtime-multi-poly-relation">
        <Select
          mode="multiple"
          showSearch
          allowClear
          getPopupContainer={getSelectPopupContainer}
          value={selectedValues}
          disabled={!relationModelCollection || props.field.readonly === true}
          placeholder={relationModelCollection ? '请选择关联项' : '请先选择类型'}
          options={[
            ...selectedValues
              .filter((value) => !options.some((option) => option.value === value))
              .map((value) => ({ value, label: '当前值' })),
            ...options.map((option) => ({ value: option.value, label: option.label })),
          ]}
          filterOption={(input, option) => String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
          onChange={(nextValue) => emit(Array.isArray(nextValue) ? nextValue.map((item) => String(item)) : [])}
        />
        {renderRelationOptionHint(relationModelCollection, displayFields, loading, error, options.length)}
      </div>
      {props.field.description ? <em className="field-help-text">{props.field.description}</em> : null}
    </label>
  )
}

function multiPolyRelationFormRenderer(props: FormRendererProps) {
  const collectionOptions = Array.isArray(props.field.relationModelCollections) ? props.field.relationModelCollections : []
  const displayMap =
    props.field.polyRelationDisplayMap && typeof props.field.polyRelationDisplayMap === 'object'
      ? props.field.polyRelationDisplayMap
      : {}
  const limitMap =
    props.field.polyRelationLimitMap && typeof props.field.polyRelationLimitMap === 'object'
      ? props.field.polyRelationLimitMap
      : {}
  const { optionsMap, loadingMap, errorMap } = useRelationOptionMap(
    'multiPolyRelation',
    displayMap,
    collectionOptions,
  )

  const relations = parseMultiPolyRelationValues(props.value)

  function emit(nextRelations: MultiPolyRelationValue[]) {
    const normalized = nextRelations.filter((item) => item.collection.trim() || item.id.trim())

    if (normalized.length === 0) {
      props.onChange('')
      return
    }

    props.onChange(
      JSON.stringify(
        normalized.map((item) => ({
          collection: item.collection.trim(),
          id: item.id.trim(),
        })),
      ),
    )
  }

  function updateRelation(index: number, nextPatch: Partial<MultiPolyRelationValue>) {
    const nextRelations = relations.map((item, relationIndex) =>
      relationIndex === index
        ? {
            ...item,
            ...nextPatch,
          }
        : item,
    )
    emit(nextRelations)
  }

  function removeRelation(index: number) {
    emit(relations.filter((_, relationIndex) => relationIndex !== index))
  }

  function addRelation() {
    emit([
      ...relations,
      {
        collection: '',
        id: '',
      },
    ])
  }

  return (
    <label key={props.field.fieldKey} className="field-stack">
      <span>{props.field.label}</span>
      <div className="runtime-multi-poly-relation">
        {collectionOptions.length > 0 ? <div className="runtime-multi-poly-relation-summary" /> : null}
        <div className="runtime-multi-poly-relation-list">
          {relations.map((relation, index) => {
            const displayFields = relation.collection ? displayMap[relation.collection] ?? [] : []
            const relationOptions = relation.collection ? optionsMap[relation.collection] ?? [] : []
            const relationLoading = relation.collection ? loadingMap[relation.collection] === true : false
            const relationError = relation.collection ? errorMap[relation.collection] ?? '' : ''
            const currentOption = relation.id ? relationOptions.find((item) => item.value === relation.id) : undefined

            return (
              <div key={`multi-poly-relation-${index}`} className="runtime-multi-poly-relation-item">
                <div className="runtime-multi-poly-relation-grid">
                  <select
                    value={relation.collection}
                    disabled={props.field.readonly === true}
                    onChange={(event) =>
                      updateRelation(index, {
                        collection: event.target.value,
                        id: '',
                      })}
                  >
                    <option value="">请选择类型</option>
                    {collectionOptions.map((collection) => (
                      <option key={collection} value={collection}>
                        {formatRelationCollectionLabel(collection)}
                      </option>
                    ))}
                  </select>
                  <Select
                    showSearch
                    allowClear
                    getPopupContainer={getSelectPopupContainer}
                    value={relation.id || undefined}
                    disabled={!relation.collection || props.field.readonly === true}
                    placeholder={relation.collection ? '请选择关联项' : '请先选择类型'}
                    options={[
                      ...(relation.id && !relationOptions.some((item) => item.value === relation.id)
                        ? [{ value: relation.id, label: '当前值' }]
                        : []),
                      ...relationOptions.map((option) => ({ value: option.value, label: option.label })),
                    ]}
                    filterOption={(input, option) => String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                    onChange={(nextValue) => updateRelation(index, { id: typeof nextValue === 'string' ? nextValue : '' })}
                  />
                  <button
                    type="button"
                    className="ghost-button runtime-multi-poly-relation-remove"
                    onClick={() => removeRelation(index)}
                  >
                    删除
                  </button>
                </div>
                {relation.collection ? (
                  renderRelationOptionHint(
                    relation.collection,
                    displayFields,
                    relationLoading,
                    relationError,
                    relationOptions.length,
                  )
                ) : null}
              </div>
            )
          })}
        </div>
        <button type="button" className="primary-button runtime-multi-poly-relation-add" onClick={addRelation}>
          新增关联
        </button>
      </div>
      {props.field.description ? <em className="field-help-text">{props.field.description}</em> : null}
    </label>
  )
}

function addressFormRenderer(props: FormRendererProps) {
  const path = getAddressPathFromJson(props.value)
  const granularity = props.field.addressGranularity || 'district'

  return (
    <label key={props.field.fieldKey} className="field-stack">
      <span>{props.field.label}</span>
      <Cascader
        options={getChinaAreaOptionsByGranularity(granularity)}
        value={path}
        placeholder="请选择中国行政区"
        changeOnSelect={granularity !== 'district'}
        disabled={props.field.readonly === true}
        onChange={(nextPath) => {
          const pathValue = normalizeAddressPathByGranularity(
            Array.isArray(nextPath) ? nextPath.map((item) => String(item)) : [],
            granularity,
          )
          props.onChange(JSON.stringify(buildAddressValueFromPath(pathValue)))
        }}
      />
      {props.field.description ? <em className="field-help-text">{props.field.description}</em> : null}
    </label>
  )
}

function parseLocationJson(value: string) {
  if (!value) {
    return {
      lng: '',
      lat: '',
      address: '',
      name: '',
    }
  }

  try {
    const parsed = JSON.parse(value)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {
        lng: '',
        lat: '',
        address: '',
        name: '',
      }
    }

    return {
      lng: parsed.lng === undefined || parsed.lng === null ? '' : String(parsed.lng),
      lat: parsed.lat === undefined || parsed.lat === null ? '' : String(parsed.lat),
      address: typeof parsed.address === 'string' ? parsed.address : '',
      name: typeof parsed.name === 'string' ? parsed.name : '',
    }
  } catch {
    return {
      lng: '',
      lat: '',
      address: '',
      name: '',
    }
  }
}

function buildLocationJson(value: { lng: string; lat: string; address: string; name: string }) {
  if (!value.lng.trim() && !value.lat.trim() && !value.address.trim() && !value.name.trim()) {
    return ''
  }

  return JSON.stringify({
    lng: Number(value.lng),
    lat: Number(value.lat),
    address: value.address.trim(),
    name: value.name.trim(),
  })
}

function locationFormRenderer(props: FormRendererProps) {
  const location = parseLocationJson(props.value)
  const requireAddress = props.field.locationRequireAddress === true
  const requireName = props.field.locationRequireName === true

  function updateLocation(nextPatch: Partial<typeof location>) {
    const nextValue = {
      ...location,
      ...nextPatch,
    }
    props.onChange(buildLocationJson(nextValue))
  }

  return (
    <label key={props.field.fieldKey} className="field-stack">
      <span>{props.field.label}</span>
      <div className="field-stack" style={{ gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <input
            type="number"
            value={location.lng}
            placeholder="经度，例如 121.4737"
            disabled={props.field.readonly === true}
            onChange={(event) => updateLocation({ lng: event.target.value })}
          />
          <input
            type="number"
            value={location.lat}
            placeholder="纬度，例如 31.2304"
            disabled={props.field.readonly === true}
            onChange={(event) => updateLocation({ lat: event.target.value })}
          />
        </div>
        <input
          type="text"
          value={location.address}
          placeholder={requireAddress ? '地址（必填）' : '地址（可选）'}
          disabled={props.field.readonly === true}
          onChange={(event) => updateLocation({ address: event.target.value })}
        />
        <input
          type="text"
          value={location.name}
          placeholder={requireName ? '地点名称（必填）' : '地点名称（可选）'}
          disabled={props.field.readonly === true}
          onChange={(event) => updateLocation({ name: event.target.value })}
        />
      </div>
      {props.field.description ? <em className="field-help-text">{props.field.description}</em> : null}
    </label>
  )
}

function uploadFormRenderer(props: FormRendererProps, accept: string) {
  return <UploadField {...props} accept={accept} />
}

function UploadField(props: FormRendererProps & { accept: string }) {
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [previewVisible, setPreviewVisible] = useState(false)
  const [previewImageUrl, setPreviewImageUrl] = useState('')
  const { asset, url } = useResolvedAssetUrl(props.value)
  const assets = parseUploadedAssetValues(props.value)
  const assetUrlMap = useResolvedAssetUrlMap(assets)

  const fileList: UploadFile[] = assets.map((item, index) => ({
    uid: item.fileID || item.fullPath || item.path || `${props.field.fieldKey}-${index}`,
    name: item.name || `file-${index + 1}`,
    status: 'done',
    type: item.contentType || undefined,
    url: item.fileID === asset?.fileID ? url || undefined : undefined,
  }))

  const existingAssetNameSet = new Set(
    assets.map((item) => item.name).filter(Boolean),
  )

  function validateFiles(files: File[]) {
    const acceptList =
      Array.isArray(props.field.accept) && props.field.accept.length > 0
        ? props.field.accept
        : ((props.accept && props.accept.split(',').map((item) => item.trim()).filter(Boolean)) || [])

    if (props.field.type === 'image' && files.some((file) => !file.type.startsWith('image/'))) {
      return '请上传图片文件'
    }

    if (props.field.type === 'video' && files.some((file) => file.type && !file.type.startsWith('video/'))) {
      return '请上传视频文件'
    }

    if (props.field.type === 'audio' && files.some((file) => file.type && !file.type.startsWith('audio/'))) {
      return '请上传音频文件'
    }

    if (props.field.type === 'file' && files.some((file) => (file.type || '').toLowerCase().startsWith('image/'))) {
      return '文件字段不支持上传图片'
    }

    if (acceptList.length > 0) {
      const invalid = files.some((file) => {
        const lowerName = file.name.toLowerCase()
        const lowerType = (file.type || '').toLowerCase()
        return !acceptList.some((accept) => {
          const rule = accept.toLowerCase()
          if (rule.startsWith('.')) return lowerName.endsWith(rule)
          if (rule.endsWith('/*')) return lowerType.startsWith(rule.slice(0, -1))
          return lowerType === rule
        })
      })
      if (invalid) return '当前文件类型不在允许范围内'
    }

    if (
      typeof props.field.maxFileSizeMB === 'number' &&
      files.some((file) => file.size > (props.field.maxFileSizeMB as number) * 1024 * 1024)
    ) {
      return `文件大小不能超过 ${props.field.maxFileSizeMB} MB`
    }

    return ''
  }

  function serializeAsset(asset: ReturnType<typeof parseUploadedAssetValue>) {
    if (!asset) return null
    const obj: Record<string, unknown> = {
      fileID: asset.fileID,
      path: asset.path,
      fullPath: asset.fullPath,
      name: asset.name,
      contentType: asset.contentType,
    }
    if (typeof asset.size === 'number') obj.size = asset.size
    return obj
  }

  async function uploadFiles(files: File[]) {
    const dedupedFiles = files.filter((file) => !existingAssetNameSet.has(file.name))

    if (dedupedFiles.length === 0) {
      setUploadError('已存在同名文件，无需重复上传')
      return
    }

    if (props.field.allowMultiple && typeof props.field.maxItems === 'number') {
      const afterCount = assets.length + dedupedFiles.length
      if (afterCount > props.field.maxItems) {
        setUploadError(`最多上传 ${props.field.maxItems} 个文件，当前已有 ${assets.length} 个`)
        return
      }
    }

    const validationError = validateFiles(dedupedFiles)

    if (validationError) {
      setUploadError(validationError)
      return
    }

    setUploadError('')
    setUploading(true)

    try {
      const uploadedList = await Promise.all(dedupedFiles.map((file) => uploadAsset(file, props.collectionName, props.field.fieldKey)))
      const nextAssets = props.field.allowMultiple ? [...assets, ...uploadedList] : uploadedList
      const nextValue =
        props.field.assetStorageMode === 'url'
          ? props.field.allowMultiple
            ? JSON.stringify(nextAssets.map((asset) => asset.fileID || asset.fullPath || asset.path).filter(Boolean))
            : (nextAssets[0]?.fileID || nextAssets[0]?.fullPath || nextAssets[0]?.path || '')
          : props.field.allowMultiple
            ? JSON.stringify(nextAssets.map(serializeAsset).filter(Boolean))
            : JSON.stringify(serializeAsset(nextAssets[0] ?? null))
      props.onChange(nextValue)
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : '上传失败')
    } finally {
      setUploading(false)
    }
  }

  function handleImagePreview(file: UploadFile) {
    const nextUrl = typeof file.url === 'string' && file.url ? file.url : url || ''

    if (!nextUrl) {
      setUploadError('图片预览地址不可用')
      return
    }

    setUploadError('')
    setPreviewImageUrl(nextUrl)
    setPreviewVisible(true)
  }

  function handleBeforeUpload(file: RcFile, fileList: RcFile[]) {
    if (file.uid !== fileList[0]?.uid) {
      return Upload.LIST_IGNORE
    }

    void uploadFiles(fileList)
    return Upload.LIST_IGNORE
  }

  function removeAssetByUid(uid: string) {
    const nextAssets = assets.filter(
      (item) => (item.fileID || item.fullPath || item.path) !== uid,
    )

    if (nextAssets.length === 0) {
      props.onChange('')
      return
    }

    props.onChange(
      props.field.assetStorageMode === 'url'
        ? props.field.allowMultiple
          ? JSON.stringify(nextAssets.map((asset) => asset.fileID || asset.fullPath || asset.path).filter(Boolean))
          : (nextAssets[0]?.fileID || nextAssets[0]?.fullPath || nextAssets[0]?.path || '')
        : props.field.allowMultiple ? JSON.stringify(nextAssets.map(serializeAsset).filter(Boolean)) : JSON.stringify(serializeAsset(nextAssets[0] ?? null)),
    )
  }

  const usePanelUploadLayout = props.field.type === 'file' || props.field.type === 'video' || props.field.type === 'audio' || props.field.type === 'image'

  if (usePanelUploadLayout) {
    const currentFile = fileList[0]
    const isImageField = props.field.type === 'image'
    const isVideoField = props.field.type === 'video'
    const isAudioField = props.field.type === 'audio'
    const panelFiles = props.field.allowMultiple ? fileList : currentFile ? [currentFile] : []

    function getPanelLabel() {
      if (isImageField) return '图片'
      if (isVideoField) return '视频'
      if (isAudioField) return '音频'
      return '文件'
    }

    return (
      <div key={props.field.fieldKey} className="field-stack">
        <span>{props.field.label}</span>
        <div className="runtime-upload-panel">
          {props.field.readonly !== true && (
            <Upload.Dragger
              accept={(props.field.accept && props.field.accept.length > 0 ? props.field.accept.join(',') : props.accept) || undefined}
              multiple={props.field.allowMultiple}
              disabled={uploading}
              showUploadList={false}
              beforeUpload={(file, fileList) => handleBeforeUpload(file, fileList)}
              customRequest={() => {}}
              className="runtime-upload-dragger"
            >
              <div className="runtime-upload-dragger-icon">
                <CloudUploadOutlined />
              </div>
              <div className="runtime-upload-dragger-title">
                {uploading ? '上传中...' : `点击或拖拽${getPanelLabel()}上传`}
              </div>
            </Upload.Dragger>
          )}

          {panelFiles.length === 0 && props.field.readonly === true ? (
            <span className="runtime-upload-empty">-</span>
          ) : null}

          {panelFiles.length > 0 ? (
            <div className="runtime-upload-selected-list">
              {panelFiles.map((file) => {
                const fileUrl = assetUrlMap[file.uid] || file.url || ''

                return (
                  <div key={file.uid} className="runtime-upload-selected-item">
                    <div className="runtime-upload-selected-main">
                      {isImageField && fileUrl ? (
                        <button
                          type="button"
                          className="runtime-upload-selected-thumb"
                          onClick={() => handleImagePreview({ ...file, url: fileUrl })}
                        >
                          <img src={fileUrl} alt={file.name} />
                        </button>
                      ) : (
                        <div className="runtime-upload-selected-fallback">
                          {isImageField ? <PictureOutlined /> : <FileOutlined />}
                        </div>
                      )}
                      {isImageField ? (
                        <button
                          type="button"
                          className="runtime-upload-selected-name"
                          onClick={() => handleImagePreview({ ...file, url: fileUrl })}
                        >
                          {file.name}
                        </button>
                      ) : fileUrl ? (
                        <a className="runtime-upload-selected-name" href={fileUrl} target="_blank" rel="noreferrer">
                          {file.name}
                        </a>
                      ) : (
                        <span className="runtime-upload-selected-name runtime-upload-selected-name-static">
                          {file.name}
                        </span>
                      )}
                    </div>
                    {(isVideoField || isAudioField) && fileUrl ? (
                      <div className="runtime-upload-media-preview">
                        {isVideoField ? (
                          <video src={fileUrl} controls preload="metadata" className="runtime-upload-media-video" />
                        ) : (
                          <audio src={fileUrl} controls preload="metadata" className="runtime-upload-media-audio" />
                        )}
                      </div>
                    ) : null}
                    <div className="runtime-upload-selected-actions">
                      {isImageField ? (
                        <button
                          type="button"
                          className="runtime-upload-selected-action"
                          onClick={() => handleImagePreview({ ...file, url: fileUrl })}
                        >
                          <EyeOutlined />
                        </button>
                      ) : fileUrl && !isVideoField && !isAudioField ? (
                        <a className="runtime-upload-selected-action" href={fileUrl} target="_blank" rel="noreferrer">
                          <EyeOutlined />
                        </a>
                      ) : null}
                      {props.field.readonly ? null : (
                        <button
                          type="button"
                          className="runtime-upload-selected-action"
                          onClick={() => removeAssetByUid(file.uid)}
                        >
                          <DeleteOutlined />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : null}

          {previewImageUrl ? (
            <Image
              preview={{
                visible: previewVisible,
                src: previewImageUrl,
                onVisibleChange: (visible) => {
                  setPreviewVisible(visible)
                  if (!visible) {
                    setPreviewImageUrl('')
                  }
                },
              }}
              src={previewImageUrl}
              style={{ display: 'none' }}
            />
          ) : null}
        </div>
        {props.field.allowMultiple && assets.length > 1 && props.field.readonly !== true ? (
          <em className="field-help-text">已上传 {assets.length} 个文件</em>
        ) : null}
        {uploading ? <em className="field-help-text">上传中...</em> : null}
        {isImageField && props.field.assetStorageMode !== 'url' && asset && !isImageAsset(asset) ? (
          <p className="field-error">当前值不是图片资源</p>
        ) : null}
        {uploadError ? <p className="field-error">{uploadError}</p> : null}
        {props.field.description ? <em className="field-help-text">{props.field.description}</em> : null}
      </div>
    )
  }

}

function defaultDisplayRenderer(props: DisplayRendererProps) {
  const text = formatDisplayText(props.value)
  return <span title={text === '-' ? undefined : text}>{truncateDisplayText(text)}</span>
}

function formatDateDisplayValue(value: unknown, type: 'date' | 'datetime', storageFormat?: RuntimeField['dateStorageFormat']) {
  if (value === null || value === undefined || value === '') {
    return '-'
  }

  const nextStorageFormat = storageFormat || 'string'
  let date: Date | null = null

  if (nextStorageFormat === 'timestamp' || nextStorageFormat === 'timestampMs') {
    const rawNumber = typeof value === 'number' ? value : Number(String(value).trim())

    if (!Number.isNaN(rawNumber)) {
      date = new Date(nextStorageFormat === 'timestamp' ? rawNumber * 1000 : rawNumber)
    }
  } else if (typeof value === 'string') {
    const trimmed = value.trim()

    if (/^\d+$/.test(trimmed)) {
      const rawNumber = Number(trimmed)
      date = new Date(trimmed.length <= 10 ? rawNumber * 1000 : rawNumber)
    } else {
      const normalized = trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T')
      date = new Date(normalized)
    }
  } else if (value instanceof Date) {
    date = value
  }

  if (!date || Number.isNaN(date.getTime())) {
    return String(value)
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  if (type === 'date') {
    return `${year}-${month}-${day}`
  }

  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

function dateDisplayRenderer(props: DisplayRendererProps) {
  const text = formatDateDisplayValue(props.value, 'date', props.field.dateStorageFormat)
  return <span title={text === '-' ? undefined : text}>{text}</span>
}

function datetimeDisplayRenderer(props: DisplayRendererProps) {
  const text = formatDateDisplayValue(props.value, 'datetime', props.field.dateStorageFormat)
  return <span title={text === '-' ? undefined : text}>{text}</span>
}

function booleanDisplayRenderer(props: DisplayRendererProps) {
  if (props.value === true || props.value === 'true') {
    return <>是</>
  }

  if (props.value === false || props.value === 'false') {
    return <>否</>
  }

  return <>-</>
}

function selectDisplayRenderer(props: DisplayRendererProps) {
  const options = getDictOptions(props.field, props.dictMap)
  const option = options.find((item) => item.value === props.value)
  const text = option?.label ?? String(props.value ?? '-')
  return <span title={text === '-' ? undefined : text}>{truncateDisplayText(text)}</span>
}

function imageDisplayRenderer(props: DisplayRendererProps) {
  return <ResolvedImageDisplay {...props} />
}

function fileDisplayRenderer(props: DisplayRendererProps) {
  return <ResolvedFileDisplay {...props} />
}

function AssetListPopover(props: { assets: ReturnType<typeof parseUploadedAssetValues>; icon: React.ReactNode; defaultName: string }) {
  const { assets, icon, defaultName } = props
  const first = assets[0]
  const firstName = first.name || defaultName
  const extra = assets.length - 1

  const tag = (
    <span className="runtime-media-file-tag" title={firstName}>
      <span>{firstName}</span>
      {extra > 0 && <span className="runtime-file-extra-count">+{extra}</span>}
    </span>
  )

  if (extra === 0) return tag

  return (
    <Popover
      content={
        <div className="runtime-file-popover-list">
          {assets.map((asset, index) => (
            <div key={asset.fileID || asset.fullPath || asset.path || index} className="runtime-file-popover-item">
              {icon}
              <span title={asset.name || defaultName}>{truncateDisplayText(asset.name || defaultName, 32)}</span>
            </div>
          ))}
        </div>
      }
      title={`共 ${assets.length} 项`}
      trigger="hover"
      placement="right"
    >
      {tag}
    </Popover>
  )
}

function mediaDisplayRenderer(props: DisplayRendererProps, kind: 'video' | 'audio') {
  const assets = parseUploadedAssetValues(props.value)

  if (assets.length === 0) return <>-</>

  const icon = kind === 'video' ? <PlaySquareOutlined /> : <SoundOutlined />
  const defaultName = kind === 'video' ? '视频文件' : '音频文件'

  return <AssetListPopover assets={assets} icon={icon} defaultName={defaultName} />
}

function arrayDisplayRenderer(props: DisplayRendererProps) {
  let items: unknown[] = []

  if (typeof props.value === 'string') {
    try {
      const parsed = JSON.parse(props.value)

      if (Array.isArray(parsed)) {
        items = parsed
      }
    } catch {
      return <span title={props.value}>{truncateDisplayText(props.value)}</span>
    }
  } else if (Array.isArray(props.value)) {
    items = props.value
  }

  if (!items.length) {
    return <>-</>
  }

  if (props.mode !== 'detail') {
    const previewItems = items.slice(0, 3).map((item) => (typeof item === 'object' ? JSON.stringify(item) : String(item ?? '')))
    const text = previewItems.join('、')
    const suffix = items.length > previewItems.length ? ` 等 ${items.length} 项` : `${items.length} 项`

    return (
      <span className="runtime-table-array-summary" title={JSON.stringify(items)}>
        {text ? `${text} (${suffix})` : suffix}
      </span>
    )
  }

  return (
    <div className="runtime-detail-array-list">
      {items.map((item, index) => {
        const text = typeof item === 'object' ? JSON.stringify(item) : String(item ?? '')
        return (
          <span key={`detail-array-${index}`} className="runtime-detail-array-item" title={text}>
            {text}
          </span>
        )
      })}
    </div>
  )
}

function jsonDisplayRenderer(props: DisplayRendererProps) {
  if (!props.value) {
    return <>-</>
  }

  const text = typeof props.value === 'string' ? props.value : JSON.stringify(props.value)
  return <span title={text}>{truncateDisplayText(text)}</span>
}

function polyRelationDisplayRenderer(props: DisplayRendererProps) {
  if (!props.value) {
    return <>-</>
  }

  let parsed = props.value

  if (typeof props.value === 'string') {
    try {
      parsed = JSON.parse(props.value)
    } catch {
      return <>{props.value}</>
    }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return <>-</>
  }

  const relation = parsed as {
    collection?: string
    id?: string
  }

  const relationId = relation.id ? String(relation.id) : ''
  const displayFields = getRelationDisplayFields(props.field, relation.collection)
  const { options } = useRelationOptions(relation.collection ? String(relation.collection) : '', displayFields)
  const currentOption = getCurrentRelationOption(relationId, options)
  const text = currentOption?.label || relationId || '-'
  return (
    <div className="runtime-relation-inline">
      <span title={text === '-' ? undefined : text}>{truncateDisplayText(text)}</span>
      {currentOption ? (
        <RelationDetailTrigger title="关联详情" records={[{ id: currentOption.value, record: currentOption.raw, displayFields }]} />
      ) : null}
    </div>
  )
}

function multiPolyRelationDisplayRenderer(props: DisplayRendererProps) {
  if (!props.value) {
    return <>-</>
  }

  let parsed = props.value

  if (typeof props.value === 'string') {
    try {
      parsed = JSON.parse(props.value)
    } catch {
      return <>{props.value}</>
    }
  }

  if (!Array.isArray(parsed)) {
    return <>-</>
  }

  const collections = parsed
    .map((item) => (item && typeof item === 'object' && !Array.isArray(item) && typeof item.collection === 'string' ? item.collection : ''))
    .filter(Boolean)
  const displayMap =
    props.field.polyRelationDisplayMap && typeof props.field.polyRelationDisplayMap === 'object'
      ? props.field.polyRelationDisplayMap
      : {}
  const { optionsMap } = useRelationOptionMap('multiPolyRelationDisplay', displayMap, collections)

  const text = parsed
    .map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        return ''
      }

      const collection = typeof item.collection === 'string' ? item.collection : ''
      const id = typeof item.id === 'string' ? item.id : ''
      const option = collection ? getCurrentRelationOption(id, optionsMap[collection] ?? []) : undefined
      return option?.label || id
    })
    .filter(Boolean)
    .join('；')

  const firstValidItem = parsed.find((item) => item && typeof item === 'object' && !Array.isArray(item)) as Record<string, unknown> | undefined
  const firstCollection = firstValidItem && typeof firstValidItem.collection === 'string' ? firstValidItem.collection : ''
  const firstId = firstValidItem && typeof firstValidItem.id === 'string' ? firstValidItem.id : ''
  const firstOption = firstCollection ? getCurrentRelationOption(firstId, optionsMap[firstCollection] ?? []) : undefined

  return (
    <div className="runtime-relation-inline">
      <span title={text || undefined}>{truncateDisplayText(text || '-')}</span>
      {firstOption ? (
        <RelationDetailTrigger
          title="关联详情"
          records={[
            {
              id: firstOption.value,
              record: firstOption.raw,
              displayFields: firstCollection ? displayMap[firstCollection] ?? [] : [],
            },
          ]}
        />
      ) : null}
    </div>
  )
}

function relationManyDisplayRenderer(props: DisplayRendererProps) {
  const collectionName = typeof props.field.relationModelCollection === 'string' ? props.field.relationModelCollection : ''
  const displayFields = Array.isArray(props.field.relationDisplayFields) ? props.field.relationDisplayFields : []
  const { options } = useRelationOptions(collectionName, displayFields)
  const values = Array.isArray(props.value)
    ? props.value.map((item) => String(item)).filter(Boolean)
    : typeof props.value === 'string'
      ? (() => {
          try {
            const parsed = JSON.parse(props.value)
            return Array.isArray(parsed) ? parsed.map((item) => String(item)).filter(Boolean) : [props.value]
          } catch {
            return [props.value]
          }
        })()
      : []

  const optionsByValue = new Map(options.map((item) => [item.value, item]))
  const records = buildRelationManyDetailRecords(values, options, displayFields)

  const summary = records.map((item) => item.label).filter(Boolean).join('；')

  return (
    <div className="runtime-relation-inline">
      <span title={summary || undefined}>{truncateDisplayText(summary || '-')}</span>
      <RelationDetailTrigger title="关联详情" records={records} />
    </div>
  )
}

function relationOneDisplayRenderer(props: DisplayRendererProps) {
  const collectionName = typeof props.field.relationModelCollection === 'string' ? props.field.relationModelCollection : ''
  const displayFields = getRelationDisplayFields(props.field)
  const relationId = typeof props.value === 'string' ? props.value : ''
  const { options } = useRelationOptions(collectionName, displayFields)
  const option = getCurrentRelationOption(relationId, options)

  const text = option?.label || relationId || '-'
  return (
    <div className="runtime-relation-inline">
      <span title={text === '-' ? undefined : text}>{truncateDisplayText(text)}</span>
      {option ? <RelationDetailTrigger title="关联详情" records={[{ id: option.value, record: option.raw, displayFields }]} /> : null}
    </div>
  )
}

function addressDisplayRenderer(props: DisplayRendererProps) {
  const text = formatAddressText(props.value)
  return <span title={text === '-' ? undefined : text}>{truncateDisplayText(text)}</span>
}

function locationDisplayRenderer(props: DisplayRendererProps) {
  if (!props.value) {
    return <>-</>
  }

  let parsed = props.value

  if (typeof props.value === 'string') {
    try {
      parsed = JSON.parse(props.value)
    } catch {
      return <span title={props.value}>{truncateDisplayText(props.value)}</span>
    }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return <>-</>
  }

  const location = parsed as {
    lng?: number | string
    lat?: number | string
    address?: string
    name?: string
    coordinateSystem?: string
  }

  const parts = [
    location.name ? String(location.name) : '',
    location.address ? String(location.address) : '',
    location.lng !== undefined && location.lat !== undefined ? `${location.lng}, ${location.lat}` : '',
    location.coordinateSystem ? String(location.coordinateSystem).toUpperCase() : '',
  ].filter(Boolean)

  const text = parts.length > 0 ? parts.join(' / ') : '-'
  return <span title={text === '-' ? undefined : text}>{truncateDisplayText(text)}</span>
}

function ResolvedImageDisplay(props: DisplayRendererProps) {
  const assets = parseUploadedAssetValues(props.value)
  const assetUrlMap = useResolvedAssetUrlMap(assets)
  const [loadFailed, setLoadFailed] = useState(false)

  if (assets.length === 0) {
    return <>{props.value ? '图片加载中...' : '-'}</>
  }

  if (loadFailed) {
    return <span className="runtime-asset-error">图片地址不可访问</span>
  }

  if (props.mode !== 'detail') {
    const stackAssets = assets.slice(0, 3)

    const popoverContent = (
      <div className="runtime-image-popover-grid">
        {assets.map((asset, index) => {
          const assetKey = asset.fileID || asset.fullPath || asset.path || `${props.field.fieldKey}-${index}`
          const url = assetUrlMap[assetKey]
          return (
            <div key={assetKey} className="runtime-image-popover-cell">
              {url ? (
                <Image
                  src={url}
                  alt={asset.name || props.field.label}
                  width={72}
                  height={72}
                  style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 6, display: 'block' }}
                  preview={{ mask: '预览' }}
                  onError={() => setLoadFailed(true)}
                />
              ) : (
                <div className="runtime-image-popover-placeholder">
                  <PictureOutlined />
                </div>
              )}
            </div>
          )
        })}
      </div>
    )

    const stack = (
      <span className="runtime-image-stack">
        {stackAssets.map((asset, index) => {
          const assetKey = asset.fileID || asset.fullPath || asset.path || `${props.field.fieldKey}-${index}`
          const url = assetUrlMap[assetKey]
          return (
            <span key={assetKey} className="runtime-image-stack-item" style={{ zIndex: stackAssets.length - index }}>
              {url ? (
                <Image
                  src={url}
                  alt={asset.name || props.field.label}
                  width={36}
                  height={36}
                  style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 4, display: 'block' }}
                  preview={assets.length === 1 ? { mask: '预览' } : { mask: false }}
                  onError={() => setLoadFailed(true)}
                />
              ) : (
                <span className="runtime-image-stack-placeholder"><PictureOutlined /></span>
              )}
            </span>
          )
        })}
        {assets.length > 1 && (
          <span className="runtime-image-stack-badge">{assets.length}</span>
        )}
      </span>
    )

    if (assets.length <= 1) return stack

    return (
      <Popover
        content={popoverContent}
        title={`共 ${assets.length} 张图片`}
        trigger="hover"
        placement="right"
      >
        {stack}
      </Popover>
    )
  }

  return (
    <div className="runtime-detail-image-list">
      {assets.map((asset, index) => {
        const assetKey = asset.fileID || asset.fullPath || asset.path || `${props.field.fieldKey}-${index}`
        const url = assetUrlMap[assetKey]

        if (!url) {
          return (
            <div key={assetKey} className="runtime-detail-asset-loading">
              {asset.name || '图片加载中...'}
            </div>
          )
        }

        return (
          <Image
            key={assetKey}
            className="runtime-table-image"
            src={url}
            alt={asset.name || props.field.label}
            width={60}
            height={60}
            style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 10 }}
            preview={{ mask: '预览' }}
            onError={() => setLoadFailed(true)}
          />
        )
      })}
    </div>
  )
}

function ResolvedFileDisplay(props: DisplayRendererProps) {
  const assets = parseUploadedAssetValues(props.value)
  const assetUrlMap = useResolvedAssetUrlMap(assets)

  if (assets.length === 0) {
    return <>{props.value ? '文件加载中...' : '-'}</>
  }

  if (props.mode !== 'detail') {
    const first = assets[0]
    const firstName = first.name || '文件'
    const extra = assets.length - 1

    const content = (
      <span className="runtime-media-file-tag" title={firstName}>
        <span>{firstName}</span>
        {extra > 0 && <span className="runtime-file-extra-count">+{extra}</span>}
      </span>
    )

    if (extra === 0) {
      return content
    }

    const popoverContent = (
      <div className="runtime-file-popover-list">
        {assets.map((asset, index) => (
          <div key={asset.fileID || asset.fullPath || asset.path || index} className="runtime-file-popover-item">
            <FileOutlined />
            <span title={asset.name || '文件'}>{truncateDisplayText(asset.name || '文件', 32)}</span>
          </div>
        ))}
      </div>
    )

    return (
      <Popover content={popoverContent} title={`共 ${assets.length} 个文件`} trigger="hover" placement="right">
        {content}
      </Popover>
    )
  }

  return (
    <div className="runtime-detail-file-list">
      {assets.map((asset, index) => {
        const assetKey = asset.fileID || asset.fullPath || asset.path || `${props.field.fieldKey}-${index}`
        const url = assetUrlMap[assetKey]
        const name = asset.name || '查看文件'

        return (
          <div key={assetKey} className="runtime-detail-file-item">
            <FileOutlined />
            {url ? (
              <a className="runtime-file-link runtime-file-link-truncate" href={url} target="_blank" rel="noreferrer" title={name}>
                {name}
              </a>
            ) : (
              <span className="runtime-file-name-truncate" title={name}>{name}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

export const componentRegistry = {
  search: {
    text: textSearchRenderer,
    textarea: textareaSearchRenderer,
    richtext: textareaSearchRenderer,
    markdown: textareaSearchRenderer,
    number: textSearchRenderer,
    amount: textSearchRenderer,
    boolean: switchSearchRenderer,
    switch: switchSearchRenderer,
    select: selectSearchRenderer,
    multiSelect: selectSearchRenderer,
    date: dateSearchRenderer,
    datetime: datetimeSearchRenderer,
    image: textSearchRenderer,
    file: textSearchRenderer,
    video: textSearchRenderer,
    audio: textSearchRenderer,
    array: textSearchRenderer,
    relationOne: textSearchRenderer,
    relationMany: textSearchRenderer,
    json: textSearchRenderer,
    location: textSearchRenderer,
    address: textSearchRenderer,
    custom: textSearchRenderer,
  },
  form: {
    text: textFormRenderer,
    textarea: textareaFormRenderer,
    richtext: textareaFormRenderer,
    markdown: textareaFormRenderer,
    number: numberFormRenderer,
    numberInput: numberFormRenderer,
    amount: textFormRenderer,
    boolean: switchFormRenderer,
    switch: switchFormRenderer,
    select: selectFormRenderer,
    multiSelect: multiSelectFormRenderer,
    date: dateFormRenderer,
    datetime: datetimeFormRenderer,
    image: (props: FormRendererProps) => uploadFormRenderer(props, 'image/*'),
    file: (props: FormRendererProps) => uploadFormRenderer(props, '*/*'),
    video: (props: FormRendererProps) => uploadFormRenderer(props, 'video/*'),
    audio: (props: FormRendererProps) => uploadFormRenderer(props, 'audio/*'),
    array: arrayFormRenderer,
    relationOne: relationOneFormRenderer,
    relationMany: relationManyFormRenderer,
    polyRelation: polyRelationFormRenderer,
    multiPolyRelation: multiPolyRelationFormRenderer,
    json: jsonFormRenderer,
    location: locationFormRenderer,
    address: addressFormRenderer,
    custom: textFormRenderer,
  },
  display: {
    text: defaultDisplayRenderer,
    textarea: defaultDisplayRenderer,
    richtext: defaultDisplayRenderer,
    markdown: defaultDisplayRenderer,
    number: defaultDisplayRenderer,
    amount: defaultDisplayRenderer,
    boolean: booleanDisplayRenderer,
    switch: booleanDisplayRenderer,
    select: selectDisplayRenderer,
    multiSelect: defaultDisplayRenderer,
    date: dateDisplayRenderer,
    datetime: datetimeDisplayRenderer,
    image: imageDisplayRenderer,
    file: fileDisplayRenderer,
    video: (props: DisplayRendererProps) => mediaDisplayRenderer(props, 'video'),
    audio: (props: DisplayRendererProps) => mediaDisplayRenderer(props, 'audio'),
    array: arrayDisplayRenderer,
    relationOne: relationOneDisplayRenderer,
    relationMany: relationManyDisplayRenderer,
    json: jsonDisplayRenderer,
    polyRelation: polyRelationDisplayRenderer,
    multiPolyRelation: multiPolyRelationDisplayRenderer,
    location: locationDisplayRenderer,
    address: addressDisplayRenderer,
    custom: defaultDisplayRenderer,
  },
}

export function renderSearchField(props: SearchRendererProps) {
  const definition = getFieldTypeDefinition(props.field.type)
  const renderer =
    componentRegistry.search[definition.searchRenderer as keyof typeof componentRegistry.search] ??
    componentRegistry.search.text

  const Renderer = renderer
  return <Renderer {...props} />
}

export function renderFormField(props: FormRendererProps) {
  const definition = getFieldTypeDefinition(props.field.type)
  const renderer =
    componentRegistry.form[definition.formRenderer as keyof typeof componentRegistry.form] ??
    componentRegistry.form.text

  const Renderer = renderer
  return <Renderer {...props} />
}

export function renderFormFieldTitleAction(field: RuntimeField, value: unknown) {
  return <FormRelationDetailAction field={field} value={value} />
}

export function renderDisplayField(props: DisplayRendererProps) {
  const definition = getFieldTypeDefinition(props.field.type)
  const renderer =
    componentRegistry.display[definition.displayRenderer as keyof typeof componentRegistry.display] ??
    componentRegistry.display.text

  const Renderer = renderer
  return <Renderer {...props} />
}
