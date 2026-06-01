import { useMemo, useState } from 'react'
import { Button, Input, Popover, Tooltip } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { DEFAULT_MODEL_ICON, MODEL_ICON_OPTIONS, getModelIconComponent } from '@/components/common/modelIcons'

interface ModelIconPickerProps {
  value?: string
  onChange?: (value: string) => void
  disabled?: boolean
}

export function ModelIconPicker({ value, onChange, disabled }: ModelIconPickerProps) {
  const [open, setOpen] = useState(false)
  const [keyword, setKeyword] = useState('')
  const currentValue = value || DEFAULT_MODEL_ICON
  const CurrentIcon = getModelIconComponent(currentValue)

  const filteredOptions = useMemo(() => {
    const trimmed = keyword.trim().toLowerCase()
    if (!trimmed) {
      return MODEL_ICON_OPTIONS
    }
    return MODEL_ICON_OPTIONS.filter(
      (item) => item.label.includes(trimmed) || item.value.toLowerCase().includes(trimmed),
    )
  }, [keyword])

  const popoverContent = (
    <div className="model-icon-picker-pop">
      <Input
        size="small"
        prefix={<SearchOutlined />}
        placeholder="搜索图标"
        value={keyword}
        onChange={(event) => setKeyword(event.target.value)}
        allowClear
      />
      <div className="model-icon-picker-grid">
        {filteredOptions.length === 0 ? (
          <div className="model-icon-picker-empty">没有找到匹配的图标</div>
        ) : (
          filteredOptions.map((item) => {
            const ItemIcon = item.component
            const isActive = item.value === currentValue
            return (
              <Tooltip key={item.value} title={item.label} mouseEnterDelay={0.3}>
                <button
                  type="button"
                  className={`model-icon-picker-item${isActive ? ' model-icon-picker-item-active' : ''}`}
                  onClick={() => {
                    onChange?.(item.value)
                    setOpen(false)
                  }}
                >
                  <ItemIcon />
                </button>
              </Tooltip>
            )
          })
        )}
      </div>
    </div>
  )

  return (
    <Popover
      open={disabled ? false : open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) {
          setKeyword('')
        }
      }}
      trigger="click"
      placement="bottomLeft"
      content={popoverContent}
      classNames={{ root: 'model-icon-picker-overlay' }}
    >
      <Button
        disabled={disabled}
        className="model-icon-picker-trigger"
        icon={<CurrentIcon />}
      >
        {MODEL_ICON_OPTIONS.find((item) => item.value === currentValue)?.label || '选择图标'}
      </Button>
    </Popover>
  )
}
