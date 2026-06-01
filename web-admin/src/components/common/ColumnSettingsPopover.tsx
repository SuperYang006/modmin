import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Checkbox, Popover, Button } from 'antd'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { HolderOutlined, ReloadOutlined } from '@ant-design/icons'
import type { ColumnPref } from '@/hooks/useColumnPreferences'
import type { RuntimeField } from '@/types/runtime'

interface ColumnSettingsPopoverProps {
  /** 全部可列表展示的字段（含隐藏的） */
  allListFields: RuntimeField[]
  /** 当前列配置状态 */
  columnState: ColumnPref[]
  /** 切换某列的显隐 */
  onToggleColumn: (key: string) => void
  /** 拖拽排序回调 */
  onReorderColumns: (from: number, to: number) => void
  /** 重置为默认 */
  onReset: () => void
  /** 触发按钮 */
  children: React.ReactNode
}

/** 单个可排序的列配置行 */
function SortableColumnItem({
  pref,
  label,
  onToggle,
}: {
  pref: ColumnPref
  label: string
  onToggle: (key: string) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: pref.key })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="runtime-col-settings-item"
    >
      <span
        className="runtime-col-settings-drag-handle"
        {...attributes}
        {...listeners}
      >
        <HolderOutlined />
      </span>
      <Checkbox
        checked={pref.visible}
        onChange={() => onToggle(pref.key)}
        className="runtime-col-settings-checkbox"
      >
        {label}
      </Checkbox>
    </div>
  )
}

export function ColumnSettingsPopover({
  allListFields,
  columnState,
  onToggleColumn,
  onReorderColumns,
  onReset,
  children,
}: ColumnSettingsPopoverProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  // 按 columnState 顺序排列，只包含 allListFields 中存在的字段
  const orderedPrefs = columnState.filter((pref) =>
    allListFields.some((f) => f.fieldKey === pref.key),
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = orderedPrefs.findIndex((p) => p.key === active.id)
    const newIndex = orderedPrefs.findIndex((p) => p.key === over.id)

    if (oldIndex !== -1 && newIndex !== -1) {
      onReorderColumns(oldIndex, newIndex)
    }
  }

  const content = (
    <div className="runtime-col-settings-panel">
      <div className="runtime-col-settings-header">
        <span className="runtime-col-settings-title">列设置</span>
        <Button
          type="link"
          size="small"
          icon={<ReloadOutlined />}
          onClick={onReset}
          className="runtime-col-settings-reset"
        >
          重置
        </Button>
      </div>
      <div className="runtime-col-settings-list">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={orderedPrefs.map((p) => p.key)}
            strategy={verticalListSortingStrategy}
          >
            {orderedPrefs.map((pref) => {
              const field = allListFields.find((f) => f.fieldKey === pref.key)
              return (
                <SortableColumnItem
                  key={pref.key}
                  pref={pref}
                  label={field?.label ?? pref.key}
                  onToggle={onToggleColumn}
                />
              )
            })}
          </SortableContext>
        </DndContext>
      </div>
    </div>
  )

  return (
    <Popover
      content={content}
      trigger="click"
      placement="bottomRight"
      classNames={{ root: 'runtime-col-settings-popover' }}
    >
      {children}
    </Popover>
  )
}
