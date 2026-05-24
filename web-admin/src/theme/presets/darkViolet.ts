import type { ThemePreset } from '../types'
import { sharedRadius, sharedFontSize, sharedLineHeight } from '../sharedScales'

export const darkVioletPreset: ThemePreset = {
  key: 'dark-violet',
  label: '暗夜紫',
  mode: 'dark',
  brand: {
    primary: '#a47cf3',
    primaryHover: '#b89bf7',
    primaryActive: '#8a5fe0',
    primaryBg: 'rgba(164, 124, 243, 0.14)',
    primaryBorder: 'rgba(164, 124, 243, 0.38)',
  },
  text: {
    primary: 'rgba(240, 235, 250, 0.92)',
    secondary: 'rgba(240, 235, 250, 0.66)',
    tertiary: 'rgba(240, 235, 250, 0.42)',
    disabled: 'rgba(240, 235, 250, 0.24)',
  },
  background: {
    layout: '#15102a',
    container: '#1d1738',
    elevated: '#261e47',
    subtle: '#221a3e',
    muted: '#181230',
    hover: '#261e47',
  },
  border: {
    default: 'rgba(240, 235, 250, 0.14)',
    secondary: 'rgba(240, 235, 250, 0.08)',
    light: 'rgba(240, 235, 250, 0.05)',
    active: 'rgba(164, 124, 243, 0.50)',
  },
  semantic: {
    success: '#49aa19',
    successBg: 'rgba(73, 170, 25, 0.14)',
    warning: '#d89614',
    warningBg: 'rgba(216, 150, 20, 0.14)',
    error: '#dc4446',
    errorBg: 'rgba(220, 68, 70, 0.14)',
    info: '#a47cf3',
  },
  code: {
    blockBg: '#0f0a20',
    blockText: '#e6edf3',
    inlineBg: 'rgba(240, 235, 250, 0.08)',
    inlineText: '#ff9aa2',
  },
  radius: sharedRadius,
  shadow: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.35)',
    md: '0 6px 16px rgba(0, 0, 0, 0.50)',
    lg: '0 12px 28px rgba(0, 0, 0, 0.65)',
  },
  fontSize: sharedFontSize,
  lineHeight: sharedLineHeight,
}
