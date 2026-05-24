import { theme as antdTheme, type ThemeConfig } from 'antd'
import type { ThemePreset } from './types'

export function buildAntdTheme(preset: ThemePreset): ThemeConfig {
  const { brand, text, background, border, semantic, radius, shadow, fontSize, mode } = preset
  return {
    algorithm: mode === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: {
      colorPrimary: brand.primary,
      colorInfo: semantic.info,
      colorLink: brand.primary,
      colorSuccess: semantic.success,
      colorWarning: semantic.warning,
      colorError: semantic.error,

      colorText: text.primary,
      colorTextSecondary: text.secondary,
      colorTextTertiary: text.tertiary,
      colorTextQuaternary: text.disabled,

      colorBgLayout: background.layout,
      colorBgContainer: background.container,
      colorBgElevated: background.elevated,

      colorBorder: border.default,
      colorBorderSecondary: border.secondary,

      borderRadius: radius.md,
      borderRadiusLG: radius.lg,
      borderRadiusSM: radius.sm,
      borderRadiusXS: radius.xs,

      fontSize: fontSize.md,
      fontSizeSM: fontSize.sm,
      fontSizeLG: fontSize.lg,
      fontSizeXL: fontSize.xl,

      boxShadow: shadow.md,
      boxShadowSecondary: shadow.sm,
      boxShadowTertiary: shadow.sm,
    },
    components: {
      Button: {
        borderRadius: radius.md,
      },
      Card: {
        borderRadiusLG: radius.lg,
      },
      Table: {
        borderRadius: radius.md,
        rowHoverBg: background.hover,
        rowSelectedBg: brand.primaryBg,
        rowSelectedHoverBg: brand.primaryBg,
      },
      Drawer: {
        borderRadiusLG: radius.lg,
      },
      Modal: {
        borderRadiusLG: radius.lg,
      },
      Menu: {
        itemSelectedBg: brand.primaryBg,
        itemSelectedColor: brand.primary,
        itemHoverBg: background.hover,
      },
      Select: {
        borderRadius: radius.md,
        optionSelectedBg: brand.primaryBg,
      },
      Input: {
        borderRadius: radius.md,
      },
      DatePicker: {
        borderRadius: radius.md,
      },
      Tooltip: {
        borderRadius: radius.sm,
      },
      Tag: {
        borderRadiusSM: radius.sm,
      },
    },
  }
}
