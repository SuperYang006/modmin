import type { ThemePreset } from '../types'
import {
  sharedRadius,
  sharedShadow,
  sharedFontSize,
  sharedLineHeight,
} from '../sharedScales'

export const indigoPreset: ThemePreset = {
  key: 'indigo',
  label: '靛蓝',
  mode: 'light',
  brand: {
    primary: '#2f54eb',
    primaryHover: '#597ef7',
    primaryActive: '#1d39c4',
    primaryBg: '#f0f5ff',
    primaryBorder: '#adc6ff',
  },
  text: {
    primary: '#1f1f1f',
    secondary: 'rgba(0,0,0,0.65)',
    tertiary: 'rgba(0,0,0,0.45)',
    disabled: 'rgba(0,0,0,0.25)',
  },
  background: {
    layout: '#f5f6fb',
    container: '#ffffff',
    elevated: '#ffffff',
    subtle: '#f8f9fd',
    muted: '#f3f5fb',
    hover: '#f4f7ff',
  },
  border: {
    default: '#d9d9d9',
    secondary: '#e4e7f0',
    light: '#ecf0f7',
    active: '#adc6ff',
  },
  semantic: {
    success: '#52c41a',
    successBg: '#f6ffed',
    warning: '#faad14',
    warningBg: '#fffbe6',
    error: '#ff4d4f',
    errorBg: '#fff2f0',
    info: '#2f54eb',
  },
  code: {
    blockBg: '#1a1f3a',
    blockText: '#e0e6ff',
    inlineBg: '#f0f5ff',
    inlineText: '#1d39c4',
  },
  radius: sharedRadius,
  shadow: sharedShadow,
  fontSize: sharedFontSize,
  lineHeight: sharedLineHeight,
}
