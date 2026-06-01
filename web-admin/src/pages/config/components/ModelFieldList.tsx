import type { DragEvent } from 'react'
import { Button, Tag, Tooltip, Typography } from 'antd'
import { ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined, EditOutlined, HolderOutlined } from '@ant-design/icons'
import { getSharedFieldMeta } from '@/runtime/fieldTypes/meta'
import { getFieldTypeIcon } from '@/pages/config/fieldTypeIcon'
import { getFieldTypeTone } from '@/pages/config/fieldTypeTone'
import type { ModelFieldDraft } from '@/types/schema'

interface ModelFieldListProps {
  fields: ModelFieldDraft[]
  draggingFieldIndex: number | null
  dragOverFieldIndex: number | null
  searchFieldKeys: string[]
  isFieldSearchable: (fieldType: string) => boolean
  onToggleSearchField: (fieldKey: string, checked: boolean) => void
  onMoveField: (index: number, direction: 'up' | 'down') => void
  onEditField: (index: number) => void
  onRemoveField: (index: number) => void
  onFieldDragStart: (index: number) => void
  onFieldDragOver: (event: DragEvent<HTMLElement>, index: number) => void
  onFieldDrop: (index: number) => void
  onFieldDragEnd: () => void
}

export function ModelFieldList(props: ModelFieldListProps) {
  const {
    fields,
    draggingFieldIndex,
    dragOverFieldIndex,
    searchFieldKeys,
    isFieldSearchable,
    onToggleSearchField,
    onMoveField,
    onEditField,
    onRemoveField,
    onFieldDragStart,
    onFieldDragOver,
    onFieldDrop,
    onFieldDragEnd,
  } = props

  return (
    <div className="model-field-list">
      {fields.map((field, index) => {
        const isSearchEnabled = searchFieldKeys.includes(field.key)
        const summaryItems = getBasicSummaryItems(field)

        return (
          <div
            key={`${field.key}-${index}`}
            className={[
              'model-field-list-item',
              draggingFieldIndex === index ? 'is-dragging' : '',
              dragOverFieldIndex === index && draggingFieldIndex !== index ? 'is-drag-over' : '',
            ].filter(Boolean).join(' ')}
            draggable
            onDragStart={() => onFieldDragStart(index)}
            onDragOver={(event) => onFieldDragOver(event, index)}
            onDrop={() => onFieldDrop(index)}
            onDragEnd={onFieldDragEnd}
          >
            <div className="model-field-list-item-main">
              <div className="model-field-item-leading">
                <button type="button" className="model-field-item-dragger" aria-label={`拖拽排序 ${field.title}`}>
                  <HolderOutlined />
                </button>
                <div className="model-field-item-avatar">
                  <span className="model-field-item-index">{index + 1}</span>
                  <span className="model-field-item-icon">{getFieldTypeIcon(field.type)}</span>
                </div>
              </div>

              <div className="model-field-item-content">
                <div className="model-field-item-head">
                  <div className="model-field-item-title-row">
                    <span className="model-field-item-name">{field.title}</span>
                    <span className="model-field-item-key">{field.key}</span>
                  </div>
                  <div className="model-field-item-tags">
                    <Tag color={getFieldTypeTone(field.type)} className="model-field-type-tag">
                      {getSharedFieldMeta(field.type).label}
                    </Tag>
                    <Tag color={field.required ? 'error' : 'default'}>{field.required ? '必填' : '非必填'}</Tag>
                    {field.hidden ? <Tag>隐藏</Tag> : null}
                    {field.allowMultiple && ['image', 'file', 'video', 'audio'].includes(field.type) ? <Tag color="processing">多值</Tag> : null}
                    {isFieldSearchable(field.type) ? (
                      <Tooltip title="启用后，该字段将出现在列表页的搜索栏中">
                        <Tag
                          color={isSearchEnabled ? undefined : 'default'}
                          className={isSearchEnabled ? 'model-field-search-tag model-field-search-tag--active' : 'model-field-search-tag'}
                          onClick={() => onToggleSearchField(field.key, !isSearchEnabled)}
                        >
                          {isSearchEnabled ? '已加入搜索' : '加入搜索'}
                        </Tag>
                      </Tooltip>
                    ) : null}
                  </div>
                </div>

                <div className="model-field-item-summary">
                  {summaryItems.map((item) => (
                    item.type === 'pair' ? (
                      <div key={item.key} className="model-field-item-fact">
                        <span className="model-field-item-fact-label">{item.label}</span>
                        <Typography.Text type="secondary" className="model-field-item-fact-value">
                          {item.value}
                        </Typography.Text>
                      </div>
                    ) : (
                      <Typography.Text key={item.key} type="secondary" className="model-field-item-summary-line">
                        {item.text}
                      </Typography.Text>
                    )
                  ))}
                </div>
              </div>
            </div>

            <div className="model-field-item-actions">
              <div className="model-field-sort-actions">
                <Button type="text" size="small" disabled={index === 0} icon={<ArrowUpOutlined />} onClick={() => onMoveField(index, 'up')} />
                <Button
                  type="text"
                  size="small"
                  disabled={index === fields.length - 1}
                  icon={<ArrowDownOutlined />}
                  onClick={() => onMoveField(index, 'down')}
                />
              </div>
              <Button type="text" size="small" icon={<EditOutlined />} onClick={() => onEditField(index)}>
                编辑
              </Button>
              <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => onRemoveField(index)}>
                删除
              </Button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function getBasicSummaryItems(field: ModelFieldDraft) {
  const items: Array<
    | { type: 'pair'; key: string; label: string; value: string }
    | { type: 'text'; key: string; text: string }
  > = []

  if (field.description?.trim()) {
    items.push({
      type: 'text',
      key: `${field.key}-description`,
      text: field.description.trim(),
    })
  }

  if (field.type === 'address') {
    items.push({
      type: 'pair',
      key: `${field.key}-granularity`,
      label: '粒度',
      value: field.addressGranularity || 'district',
    })
    items.push({
      type: 'pair',
      key: `${field.key}-storage`,
      label: '存储',
      value: field.addressStorageMode || 'object',
    })
  }

  if (field.type === 'location') {
    items.push({
      type: 'pair',
      key: `${field.key}-coord`,
      label: '坐标系',
      value: field.locationCoordinateSystem || 'gcj02',
    })
    items.push({
      type: 'pair',
      key: `${field.key}-storage`,
      label: '存储',
      value: field.locationStorageMode || 'object',
    })
  }

  if (field.type === 'array' && field.itemType) {
    items.push({
      type: 'pair',
      key: `${field.key}-item-type`,
      label: '元素类型',
      value: field.itemType,
    })
  }

  if (field.type === 'relation' || field.type === 'multiRelation') {
    if (field.relationModelCollection) {
      items.push({
        type: 'pair',
        key: `${field.key}-relation-collection`,
        label: '关联模型',
        value: field.relationModelCollection,
      })
    }
    if (Array.isArray(field.relationDisplayFields) && field.relationDisplayFields.length > 0) {
      items.push({
        type: 'pair',
        key: `${field.key}-relation-display`,
        label: '展示字段',
        value: field.relationDisplayFields.join('、'),
      })
    }
  }

  if (field.type === 'polyRelation' || field.type === 'multiPolyRelation') {
    if (Array.isArray(field.relationModelCollections) && field.relationModelCollections.length > 0) {
      items.push({
        type: 'pair',
        key: `${field.key}-poly-collections`,
        label: '关联模型',
        value: field.relationModelCollections.join('、'),
      })
    }
  }

  if (field.type === 'enum' && field.enumOptions?.length) {
    items.push({
      type: 'pair',
      key: `${field.key}-enum-count`,
      label: '选项数',
      value: String(field.enumOptions.length),
    })
  }

  if (field.type === 'json') {
    const jsonTypeLabel =
      field.jsonValueType === 'object'
        ? '仅对象'
        : field.jsonValueType === 'array'
          ? '仅数组'
          : '任意 JSON'

    items.push({
      type: 'pair',
      key: `${field.key}-json-type`,
      label: '值类型',
      value: jsonTypeLabel,
    })
  }

  if (['image', 'file', 'video', 'audio'].includes(field.type)) {
    items.push({
      type: 'pair',
      key: `${field.key}-asset-storage`,
      label: '存储',
      value: field.assetStorageMode === 'url' ? 'URL' : '对象',
    })
    if (typeof field.maxFileSizeMB === 'number') {
      items.push({
        type: 'pair',
        key: `${field.key}-asset-size`,
        label: '大小上限',
        value: `${field.maxFileSizeMB}MB`,
      })
    }
  }

  return items.slice(0, 4)
}
