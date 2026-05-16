import { useEffect, useMemo, useRef, useState } from 'react'
import type { DragEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Input,
  List,
  Row,
  Skeleton,
  Space,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  DeleteOutlined,
  EditOutlined,
} from '@ant-design/icons'
import { loadCollectionSchemaDetail } from '@/runtime/loader/loadCollectionSchemaDetail'
import { listCollectionSchemas } from '@/runtime/loader/listCollectionSchemas'
import { saveCollectionSchema } from '@/runtime/loader/saveCollectionSchema'
import { ModelIconPicker } from '@/components/common/ModelIconPicker'
import { modelCreateFieldTypeRegistry } from '@/runtime/fieldTypes/registry'
import { getSharedFieldMeta } from '@/runtime/fieldTypes/meta'
import {
  buildFieldConfigModalState,
  buildFieldDraftFromModalState,
  type FieldConfigModalState,
} from '@/pages/config/modelFieldConfig'
import { getFieldTypeCardCopy } from '@/pages/config/fieldTypeCardCopy'
import { groupFieldTypes } from '@/pages/config/fieldTypeGroup'
import { getFieldTypeIcon } from '@/pages/config/fieldTypeIcon'
import { getFieldTypeTone } from '@/pages/config/fieldTypeTone'
import { getFieldSummaryLines } from '@/pages/config/fieldSummary'
import { FieldConfigModal } from '@/pages/config/components/FieldConfigModal'
import { SystemFieldSettingsCard } from '@/pages/config/components/SystemFieldSettingsCard'
import type { CollectionSchemaSummary, ModelFieldDraft, SystemFieldSettings } from '@/types/schema'
 
const DEFAULT_SYSTEM_FIELD_SETTINGS: SystemFieldSettings = {
  showIdInList: true,
  showCmsCreateTime: true,
  showCmsUpdateTime: true,
  defaultSortField: 'modmin_createTime',
  defaultSortOrder: 'desc',
}

interface ModelCreateFormState {
  modelName: string
  collectionName: string
  description: string
  icon: string
  fields: ModelFieldDraft[]
  systemFieldSettings: SystemFieldSettings
}

function buildInitialState(): ModelCreateFormState {
  return {
    modelName: '',
    collectionName: '',
    description: '',
    icon: '',
    fields: [],
    systemFieldSettings: DEFAULT_SYSTEM_FIELD_SETTINGS,
  }
}

function normalizeFieldOrder(fields: ModelFieldDraft[]) {
  return [...fields]
}

function isBuiltinPrimaryKeyField(fieldKey: string) {
  return fieldKey.trim() === '_id'
}

export function ModelCreatePage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [collectionNameError, setCollectionNameError] = useState('')
  const [form, setForm] = useState<ModelCreateFormState>(buildInitialState())
  const [existingCollections, setExistingCollections] = useState<CollectionSchemaSummary[]>([])
  const [fieldModalVisible, setFieldModalVisible] = useState(false)
  const [fieldModalState, setFieldModalState] = useState<FieldConfigModalState>(buildFieldConfigModalState())
  const [fieldModalError, setFieldModalError] = useState('')
  const [relationFieldOptionsLoading, setRelationFieldOptionsLoading] = useState(false)
  const [relationFieldOptionsMap, setRelationFieldOptionsMap] = useState<Record<string, Array<{ label: string; value: string }>>>({})
  const [editingFieldIndex, setEditingFieldIndex] = useState<number | null>(null)
  const [draggingFieldIndex, setDraggingFieldIndex] = useState<number | null>(null)
  const [dragOverFieldIndex, setDragOverFieldIndex] = useState<number | null>(null)
  const fieldListBodyRef = useRef<HTMLDivElement | null>(null)
  const autoScrollTargetSpeedRef = useRef(0)
  const autoScrollCurrentSpeedRef = useRef(0)
  const autoScrollFrameRef = useRef<number | null>(null)

  useEffect(() => {
    async function bootstrap() {
      setLoading(true)
      setError('')
      const collectionResponse = await listCollectionSchemas()

      if (collectionResponse.code === 0) {
        setExistingCollections(collectionResponse.data.list)
      }

      setLoading(false)
    }

    void bootstrap()
  }, [])

  useEffect(
    () => () => {
      if (autoScrollFrameRef.current !== null) {
        cancelAnimationFrame(autoScrollFrameRef.current)
      }
    },
    [],
  )

  const fieldTypeOptions = useMemo(
    () =>
      modelCreateFieldTypeRegistry.map((item) => ({
        label: `${item.label} (${item.value})`,
        value: item.value,
      })),
    [],
  )
  const fieldTypeGroups = useMemo(() => groupFieldTypes(modelCreateFieldTypeRegistry), [])
  const fieldTypeCount = fieldTypeGroups.reduce((total, group) => total + group.items.length, 0)
  const relationModelOptions = useMemo(
    () =>
      existingCollections
        .filter((item) => item.collectionName !== form.collectionName)
        .map((item) => ({
          label: `${item.modelName || item.collectionName} (${item.collectionName})`,
          value: item.collectionName,
        })),
    [existingCollections, form.collectionName],
  )
  const relationFieldOptions = relationFieldOptionsMap[fieldModalState.relationModelCollection.trim()] ?? []
  const searchableFieldTypes = new Set(['text', 'textarea', 'richtext', 'markdown', 'number', 'boolean', 'date', 'datetime', 'enum'])
  const searchFieldKeys = Array.isArray(form.systemFieldSettings.searchFieldKeys) ? form.systemFieldSettings.searchFieldKeys : []

  function isFieldSearchable(fieldType: string) {
    return searchableFieldTypes.has(fieldType)
  }

  function toggleSearchField(fieldKey: string, checked: boolean) {
    setForm((prev) => {
      const prevKeys = Array.isArray(prev.systemFieldSettings.searchFieldKeys)
        ? prev.systemFieldSettings.searchFieldKeys
        : []
      const nextKeys = checked
        ? prevKeys.includes(fieldKey)
          ? prevKeys
          : [...prevKeys, fieldKey]
        : prevKeys.filter((key) => key !== fieldKey)

      return {
        ...prev,
        systemFieldSettings: {
          ...prev.systemFieldSettings,
          searchFieldKeys: nextKeys,
        },
      }
    })
  }

  const hasDuplicatedCollectionName = useMemo(
    () =>
      existingCollections.some(
        (item) => item.collectionName.trim().toLowerCase() === form.collectionName.trim().toLowerCase(),
      ),
    [existingCollections, form.collectionName],
  )

  useEffect(() => {
    if (!form.collectionName.trim()) {
      setCollectionNameError('')
      return
    }

    if (hasDuplicatedCollectionName) {
      setCollectionNameError('该集合模型已存在，请更换集合名称')
      return
    }

    setCollectionNameError('')
  }, [form.collectionName, hasDuplicatedCollectionName])

  useEffect(() => {
    const targetCollection = fieldModalState.relationModelCollection.trim()

    if (!fieldModalVisible || !targetCollection || relationFieldOptionsMap[targetCollection]) {
      return
    }

    async function loadRelationFieldOptions() {
      setRelationFieldOptionsLoading(true)
      const response = await loadCollectionSchemaDetail(targetCollection)

      if (response.code === 0) {
        setRelationFieldOptionsMap((prev) => ({
          ...prev,
          [targetCollection]: response.data.detail.fields.map((field) => ({
            label: `${field.label} (${field.fieldKey})`,
            value: field.fieldKey,
          })),
        }))
      }

      setRelationFieldOptionsLoading(false)
    }

    void loadRelationFieldOptions()
  }, [fieldModalVisible, fieldModalState.relationModelCollection, relationFieldOptionsMap])

  useEffect(() => {
    if (!fieldModalVisible || fieldModalState.relationModelCollections.length === 0) {
      return
    }

    const missingCollections = fieldModalState.relationModelCollections.filter((collection) => !relationFieldOptionsMap[collection])

    if (missingCollections.length === 0) {
      return
    }

    async function loadPolyRelationFieldOptions() {
      setRelationFieldOptionsLoading(true)

      for (const collection of missingCollections) {
        const response = await loadCollectionSchemaDetail(collection)

        if (response.code === 0) {
          setRelationFieldOptionsMap((prev) => ({
            ...prev,
            [collection]: response.data.detail.fields.map((field) => ({
              label: `${field.label} (${field.fieldKey})`,
              value: field.fieldKey,
            })),
          }))
        }
      }

      setRelationFieldOptionsLoading(false)
    }

    void loadPolyRelationFieldOptions()
  }, [fieldModalVisible, fieldModalState.relationModelCollections, relationFieldOptionsMap])

  async function handleSubmit() {
    if (!form.modelName.trim() || !form.collectionName.trim()) {
      setError('请填写模型名称和数据源集合')
      return
    }

    if (hasDuplicatedCollectionName) {
      setError('该集合模型已存在，请更换集合名称')
      return
    }

    const fields = form.fields.filter((field) => field.key.trim() && field.title.trim() && !isBuiltinPrimaryKeyField(field.key))

    if (fields.length === 0) {
      setError('请至少配置一个字段')
      return
    }

    setSaving(true)
    setError('')
    const normalizedModelCode = form.collectionName.trim().replace(/[^a-zA-Z0-9_]/g, '_')
    const response = await saveCollectionSchema({
      mode: 'create',
      collectionName: form.collectionName,
      modelCode: normalizedModelCode,
      modelName: form.modelName,
      description: form.description.trim(),
      pageCode: `${normalizedModelCode}_list`,
      icon: form.icon.trim() || undefined,
      fields,
      systemFieldSettings: form.systemFieldSettings,
    })
    setSaving(false)

    if (response.code !== 0) {
      setError(response.message || '创建模型失败')
      return
    }

    window.dispatchEvent(new CustomEvent('modmin:schema-updated'))
    navigate('/config/models')
  }

  function openCreateFieldModal(type: string) {
    setEditingFieldIndex(null)
    setFieldModalState(buildFieldConfigModalState(type))
    setFieldModalError('')
    setFieldModalVisible(true)
  }

  function openEditFieldModal(index: number) {
    const field = form.fields[index]
    if (!field) {
      return
    }

    setEditingFieldIndex(index)
    setFieldModalState(buildFieldConfigModalState(field.type, field))
    setFieldModalError('')
    setFieldModalVisible(true)
  }

  function handleSaveFieldConfig() {
    const result = buildFieldDraftFromModalState(fieldModalState)

    if (!result.ok) {
      setFieldModalError(result.message)
      return
    }

    const nextFieldKey = result.field.key.trim()
    const duplicatedField = form.fields.find(
      (field, index) => field.key.trim() === nextFieldKey && index !== editingFieldIndex,
    )

    if (duplicatedField) {
      setFieldModalError(`字段 Key「${nextFieldKey}」已存在，请更换后再保存`)
      return
    }

    setFieldModalError('')

    if (editingFieldIndex === null) {
      setForm((prev) => ({
        ...prev,
        fields: normalizeFieldOrder([...prev.fields, result.field]),
      }))
    } else {
      setForm((prev) => {
        const prevField = prev.fields[editingFieldIndex]
        const previousKey = prevField?.key
        const prevKeys = Array.isArray(prev.systemFieldSettings.searchFieldKeys)
          ? prev.systemFieldSettings.searchFieldKeys
          : []
        const nextKeys = previousKey && previousKey !== nextFieldKey
          ? prevKeys.map((key) => (key === previousKey ? nextFieldKey : key))
          : prevKeys

        return {
          ...prev,
          fields: normalizeFieldOrder(prev.fields.map((field, index) => (index === editingFieldIndex ? result.field : field))),
          systemFieldSettings: {
            ...prev.systemFieldSettings,
            searchFieldKeys: nextKeys,
          },
        }
      })
    }

    setFieldModalVisible(false)
    setEditingFieldIndex(null)
  }

  function removeField(index: number) {
    setForm((prev) => {
      const removed = prev.fields[index]
      const nextFields = normalizeFieldOrder(prev.fields.filter((_, itemIndex) => itemIndex !== index))
      const prevKeys = Array.isArray(prev.systemFieldSettings.searchFieldKeys)
        ? prev.systemFieldSettings.searchFieldKeys
        : []
      const nextKeys = removed ? prevKeys.filter((key) => key !== removed.key) : prevKeys

      return {
        ...prev,
        fields: nextFields,
        systemFieldSettings: {
          ...prev.systemFieldSettings,
          searchFieldKeys: nextKeys,
        },
      }
    })
  }

  function moveField(index: number, direction: 'up' | 'down') {
    setForm((prev) => {
      const nextFields = [...prev.fields]
      const targetIndex = direction === 'up' ? index - 1 : index + 1

      if (targetIndex < 0 || targetIndex >= nextFields.length) {
        return prev
      }

      const current = nextFields[index]
      const target = nextFields[targetIndex]

      if (!current || !target) {
        return prev
      }

      nextFields[index] = target
      nextFields[targetIndex] = current

      return {
        ...prev,
        fields: normalizeFieldOrder(nextFields),
      }
    })
  }

  function reorderFields(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) {
      return
    }

    setForm((prev) => {
      const nextFields = [...prev.fields]
      const [moved] = nextFields.splice(fromIndex, 1)

      if (!moved) {
        return prev
      }

      nextFields.splice(toIndex, 0, moved)

      return {
        ...prev,
        fields: normalizeFieldOrder(nextFields),
      }
    })
  }

  function handleFieldDragStart(index: number) {
    setDraggingFieldIndex(index)
    setDragOverFieldIndex(index)
  }

  function ensureAutoScroll() {
    if (autoScrollFrameRef.current !== null) {
      return
    }

    const tick = () => {
      const container = fieldListBodyRef.current
      const targetSpeed = autoScrollTargetSpeedRef.current
      const currentSpeed = autoScrollCurrentSpeedRef.current
      const nextSpeed = currentSpeed + (targetSpeed - currentSpeed) * 0.22

      autoScrollCurrentSpeedRef.current = Math.abs(nextSpeed) < 0.35 ? 0 : nextSpeed

      if (container && autoScrollCurrentSpeedRef.current !== 0) {
        const previousScrollTop = container.scrollTop
        container.scrollTop += autoScrollCurrentSpeedRef.current

        if (container.scrollTop === previousScrollTop && autoScrollTargetSpeedRef.current !== 0) {
          autoScrollTargetSpeedRef.current = 0
        }

        autoScrollFrameRef.current = requestAnimationFrame(tick)
        return
      }

      autoScrollFrameRef.current = null
    }

    autoScrollFrameRef.current = requestAnimationFrame(tick)
  }

  function handleFieldDragOver(event: DragEvent<HTMLDivElement>, index: number) {
    event.preventDefault()

    const container = fieldListBodyRef.current
    if (container) {
      const rect = container.getBoundingClientRect()
      const edgeOffset = 168
      const minScrollStep = 7
      const maxScrollStep = 30

      if (event.clientY < rect.top + edgeOffset) {
        const distance = Math.max(0, event.clientY - rect.top)
        const ratio = 1 - Math.min(distance / edgeOffset, 1)
        const easedRatio = Math.pow(ratio, 1.35)
        autoScrollTargetSpeedRef.current = -(minScrollStep + (maxScrollStep - minScrollStep) * easedRatio)
      } else if (event.clientY > rect.bottom - edgeOffset) {
        const distance = Math.max(0, rect.bottom - event.clientY)
        const ratio = 1 - Math.min(distance / edgeOffset, 1)
        const easedRatio = Math.pow(ratio, 1.35)
        autoScrollTargetSpeedRef.current = minScrollStep + (maxScrollStep - minScrollStep) * easedRatio
      } else {
        autoScrollTargetSpeedRef.current = 0
      }

      ensureAutoScroll()
    }

    if (dragOverFieldIndex !== index) {
      setDragOverFieldIndex(index)
    }
  }

  function handleFieldDrop(index: number) {
    if (draggingFieldIndex === null) {
      return
    }

    reorderFields(draggingFieldIndex, index)
    setDraggingFieldIndex(null)
    setDragOverFieldIndex(null)
  }

  function resetFieldDragState() {
    autoScrollTargetSpeedRef.current = 0
    autoScrollCurrentSpeedRef.current = 0
    if (autoScrollFrameRef.current !== null) {
      cancelAnimationFrame(autoScrollFrameRef.current)
      autoScrollFrameRef.current = null
    }
    setDraggingFieldIndex(null)
    setDragOverFieldIndex(null)
  }

  if (loading) {
    return (
      <div className="model-editor-page">
        <Card className="model-editor-card model-editor-meta-card" title="创建数据模型">
          <Skeleton active paragraph={{ rows: 3 }} />
        </Card>
        <Card className="model-editor-card model-editor-card-fill" title="字段设计">
          <Skeleton active paragraph={{ rows: 8 }} />
        </Card>
      </div>
    )
  }

  return (
    <div className="model-editor-page">
      <Card
        className="model-editor-card model-editor-meta-card"
        title="创建数据模型"
        extra={
          <Space>
            <Button onClick={() => navigate('/config/models')}>返回模型工作台</Button>
            <Button type="primary" loading={saving} onClick={() => void handleSubmit()}>
              保存模型
            </Button>
          </Space>
        }
      >
        {error ? <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} /> : null}

        <div className="model-editor-meta-grid">
          <span className="model-editor-meta-field">
            <label className="model-editor-meta-label">模型名称</label>
            <Input
              value={form.modelName}
              onChange={(event) => setForm((prev) => ({ ...prev, modelName: event.target.value }))}
              placeholder="例如：文章"
            />
          </span>
          <span className="model-editor-meta-field">
            <label className="model-editor-meta-label">
              数据源集合
              {collectionNameError ? <span className="model-editor-meta-error">{collectionNameError}</span> : null}
            </label>
            <Input
              value={form.collectionName}
              onChange={(event) => {
                setError('')
                setForm((prev) => ({ ...prev, collectionName: event.target.value }))
              }}
              placeholder="例如：article"
              status={collectionNameError ? 'error' : undefined}
            />
          </span>
          <span className="model-editor-meta-field">
            <label className="model-editor-meta-label">模型说明</label>
            <Input
              value={form.description}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              placeholder="例如：订单数据"
            />
          </span>
          <span className="model-editor-meta-field">
            <label className="model-editor-meta-label">模型图标</label>
            <ModelIconPicker
              value={form.icon}
              onChange={(value) => setForm((prev) => ({ ...prev, icon: value }))}
            />
          </span>
        </div>

      </Card>

      <Card
        className="model-editor-card model-editor-card-fill"
        title="字段设计"
      >
        <Row gutter={24} align="top">
          <Col xs={24} xl={15}>
            <div className="model-field-workspace">
              <div className="model-field-workspace-head">
                <Typography.Text strong>字段列表</Typography.Text>
                <Typography.Text type="secondary">共 {form.fields.length} 个字段</Typography.Text>
              </div>
              <div ref={fieldListBodyRef} className="model-field-workspace-body">
                {form.fields.length > 0 ? (
                  <List
                    itemLayout="horizontal"
                    dataSource={form.fields}
                    renderItem={(field, index) => (
                      <List.Item
                        className={[
                          draggingFieldIndex === index ? 'is-dragging' : '',
                          dragOverFieldIndex === index && draggingFieldIndex !== index ? 'is-drag-over' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        draggable
                        onDragStart={() => handleFieldDragStart(index)}
                        onDragOver={(event) => handleFieldDragOver(event, index)}
                        onDrop={() => handleFieldDrop(index)}
                        onDragEnd={resetFieldDragState}
                        actions={[
                          <Space key="sort" size={4} className="model-field-sort-actions">
                            <Button key="up" type="text" size="small" disabled={index === 0} icon={<ArrowUpOutlined />} onClick={() => moveField(index, 'up')} />
                            <Button
                              key="down"
                              type="text"
                              size="small"
                              disabled={index === form.fields.length - 1}
                              icon={<ArrowDownOutlined />}
                              onClick={() => moveField(index, 'down')}
                            />
                          </Space>,
                          <Button key="edit" type="link" icon={<EditOutlined />} onClick={() => openEditFieldModal(index)}>
                            编辑
                          </Button>,
                          <Button key="delete" type="link" danger icon={<DeleteOutlined />} onClick={() => removeField(index)}>
                            删除
                          </Button>,
                        ]}
                      >
                        <List.Item.Meta
                          avatar={
                            <div className="model-field-item-avatar">
                              <span className="model-field-item-index">{index + 1}</span>
                              <span className="model-field-item-icon">{getFieldTypeIcon(field.type)}</span>
                            </div>
                          }
                          title={
                            <Space wrap className="model-field-item-title">
                              <span className="model-field-item-name">{field.title}</span>
                              <Tag color={getFieldTypeTone(field.type)} className="model-field-type-tag">
                                {getSharedFieldMeta(field.type).label}
                              </Tag>
                              <Tag color={field.required ? 'error' : 'default'}>{field.required ? '必填' : '非必填'}</Tag>
                              {field.hidden ? <Tag>隐藏</Tag> : null}
                              {field.allowMultiple && ['image', 'file', 'video', 'audio'].includes(field.type) ? <Tag color="processing">多值</Tag> : null}
                              {isFieldSearchable(field.type) ? (
                                <Tooltip title="启用后，该字段将出现在列表页的搜索栏中">
                                  <Tag
                                    color={searchFieldKeys.includes(field.key) ? 'blue' : 'default'}
                                    className="model-field-search-tag"
                                    onClick={() => toggleSearchField(field.key, !searchFieldKeys.includes(field.key))}
                                  >
                                    {searchFieldKeys.includes(field.key) ? '已加入搜索' : '加入搜索'}
                                  </Tag>
                                </Tooltip>
                              ) : null}
                            </Space>
                          }
                          description={
                            <Space direction="vertical" size={6} className="model-field-item-summary">
                              {getFieldSummaryLines(field).map((line) => (
                                <Typography.Text key={line} type="secondary" className="model-field-item-summary-line">
                                  {line}
                                </Typography.Text>
                              ))}
                            </Space>
                          }
                        />
                      </List.Item>
                    )}
                  />
                ) : (
                  <div className="model-field-workspace-empty">
                    <Empty description="请先从右侧选择字段类型并添加第一个字段" />
                  </div>
                )}
              </div>
            </div>
          </Col>

          <Col xs={24} xl={9}>
            <div className="model-field-side-panel">
              <SystemFieldSettingsCard
                value={form.systemFieldSettings}
                onChange={(updater) =>
                  setForm((prev) => ({
                    ...prev,
                    systemFieldSettings: updater(prev.systemFieldSettings),
                  }))
                }
              />

              <div className="model-field-workspace model-field-type-panel">
                <div className="model-field-workspace-head">
                  <Typography.Text strong>字段类型</Typography.Text>
                  <Typography.Text type="secondary">当前可支持 {fieldTypeCount} 种字段类型</Typography.Text>
                </div>
                <div className="model-field-type-panel-body">
                  <div className="model-field-type-groups">
                    {fieldTypeGroups.map((group) => (
                      <div key={group.key} className={`model-field-type-group model-field-type-group-${group.key}`}>
                        <div className="model-field-type-group-head">
                          <Typography.Text strong>{group.title}</Typography.Text>
                          <Typography.Text type="secondary">{group.description}</Typography.Text>
                        </div>
                        <div className="model-field-type-grid">
                          {group.items.map((type) => (
                            <Button
                              key={type.value}
                              className={`model-field-type-button model-field-type-button-${getFieldTypeTone(type.value)}`}
                              onClick={() => openCreateFieldModal(type.value)}
                            >
                              <span className="model-field-type-button-icon">{getFieldTypeIcon(type.value)}</span>
                              <span className="model-field-type-button-title">{type.label}</span>
                              <span className="model-field-type-button-copy">{getFieldTypeCardCopy(type.value)}</span>
                            </Button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </Col>
        </Row>
      </Card>

      <FieldConfigModal
        open={fieldModalVisible}
        title={editingFieldIndex === null ? '新增字段' : '编辑字段'}
        state={fieldModalState}
        error={fieldModalError}
        isEdit={editingFieldIndex !== null}
        relationModelOptions={relationModelOptions}
        relationFieldOptions={relationFieldOptions}
        relationFieldOptionsMap={relationFieldOptionsMap}
        relationFieldOptionsLoading={relationFieldOptionsLoading}
        onCancel={() => {
          setFieldModalError('')
          setFieldModalVisible(false)
        }}
        onSave={handleSaveFieldConfig}
        onChange={(updater) => setFieldModalState((prev) => updater(prev))}
      />
    </div>
  )
}
