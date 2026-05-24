import { MoonOutlined, SettingOutlined, SunOutlined } from '@ant-design/icons'
import { useRef, useState } from 'react'
import { Drawer, Segmented, Tooltip } from 'antd'
import { listPresets } from '@/theme/presets'
import type { ThemePreset } from '@/theme/types'
import { themeStore, useThemeState } from '@/theme/runtime/themeStore'

const allPresets = listPresets()
const lightPresets = allPresets.filter((p) => p.mode === 'light')
const darkPresets = allPresets.filter((p) => p.mode === 'dark')

export function AppearanceSettings() {
  const { themeKey, preset } = useThemeState()
  const isDark = preset.mode === 'dark'
  const [open, setOpen] = useState(false)
  const lastLightKeyRef = useRef(isDark ? lightPresets[0]?.key ?? 'default-blue' : themeKey)

  if (!isDark) lastLightKeyRef.current = themeKey

  function handleModeChange(nextMode: string) {
    if (nextMode === 'dark') {
      themeStore.setThemeKey(darkPresets[0]?.key ?? 'dark-neutral')
    } else {
      themeStore.setThemeKey(lastLightKeyRef.current)
    }
  }

  const visiblePresets = isDark ? darkPresets : lightPresets

  return (
    <>
      <Tooltip title="外观设置" placement="bottom">
        <button
          type="button"
          className="appearance-settings-trigger"
          onClick={() => setOpen(true)}
          aria-label="打开外观设置"
        >
          <SettingOutlined />
        </button>
      </Tooltip>
      <Drawer
        title="外观设置"
        placement="right"
        width={360}
        open={open}
        onClose={() => setOpen(false)}
        className="appearance-settings-drawer"
      >
        <div className="appearance-settings-section">
          <div className="appearance-settings-label">显示模式</div>
          <Segmented
            block
            value={isDark ? 'dark' : 'light'}
            onChange={(value) => handleModeChange(String(value))}
            options={[
              { label: (<span><SunOutlined /> 亮色</span>), value: 'light' },
              { label: (<span><MoonOutlined /> 暗色</span>), value: 'dark' },
            ]}
          />
        </div>

        <div className="appearance-settings-section">
          <div className="appearance-settings-label">
            主题色板
            <span className="appearance-settings-hint">{visiblePresets.length} 个可选</span>
          </div>
          <div className="appearance-theme-grid">
            {visiblePresets.map((p) => (
              <ThemeCard
                key={p.key}
                preset={p}
                active={p.key === themeKey}
                onSelect={() => themeStore.setThemeKey(p.key)}
              />
            ))}
          </div>
        </div>
      </Drawer>
    </>
  )
}

interface ThemeCardProps {
  preset: ThemePreset
  active: boolean
  onSelect: () => void
}

function ThemeCard({ preset, active, onSelect }: ThemeCardProps) {
  const sidebarBg = preset.mode === 'dark'
    ? 'linear-gradient(180deg, #0f1d33, #050b18)'
    : 'linear-gradient(180deg, #ffffff, #f1f4f9)'

  return (
    <button
      type="button"
      className={`appearance-theme-card${active ? ' is-active' : ''}`}
      onClick={onSelect}
      aria-pressed={active}
    >
      <div className="appearance-theme-card-preview" style={{ background: preset.background.layout }}>
        <div className="appearance-theme-card-sidebar" style={{ background: sidebarBg }} />
        <div className="appearance-theme-card-content">
          <div className="appearance-theme-card-bar" style={{ background: preset.brand.primary }} />
          <div className="appearance-theme-card-line" style={{ background: preset.background.container }} />
          <div className="appearance-theme-card-line" style={{ background: preset.background.container }} />
        </div>
      </div>
      <div className="appearance-theme-card-meta">
        <span
          className="appearance-theme-card-swatch"
          style={{ background: preset.brand.primary }}
        />
        <span className="appearance-theme-card-label">{preset.label}</span>
      </div>
    </button>
  )
}
