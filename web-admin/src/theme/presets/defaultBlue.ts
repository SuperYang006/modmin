import type { ThemePreset } from '../types'
import {
  sharedRadius,
  sharedShadow,
  sharedFontSize,
  sharedLineHeight,
} from '../sharedScales'

export const defaultBluePreset: ThemePreset = {
  key: 'default-blue',
  label: '默认蓝',
  mode: 'light',
  brand: {
    primary: '#1677ff',
    primaryHover: '#4096ff',
    primaryActive: '#0958d9',
    primaryBg: '#e6f4ff',
    primaryBorder: '#91caff',
  },
  text: {
    primary: '#1f1f1f',
    secondary: 'rgba(0,0,0,0.65)',
    tertiary: 'rgba(0,0,0,0.45)',
    disabled: 'rgba(0,0,0,0.25)',
  },
  background: {
    layout: '#f5f7fa',
    container: '#ffffff',
    elevated: '#ffffff',
    subtle: '#fafafa',
    muted: '#f7f8fa',
    hover: '#f5faff',
  },
  border: {
    default: '#d9d9d9',
    secondary: '#e6e8eb',
    light: '#f0f0f0',
    active: '#91caff',
  },
  semantic: {
    success: '#52c41a',
    successBg: '#f6ffed',
    warning: '#faad14',
    warningBg: '#fffbe6',
    error: '#ff4d4f',
    errorBg: '#fff2f0',
    info: '#1677ff',
  },
  code: {
    blockBg: '#24292e',
    blockText: '#e6edf3',
    inlineBg: '#f2f4f7',
    inlineText: '#b42318',
  },
  radius: sharedRadius,
  shadow: sharedShadow,
  fontSize: sharedFontSize,
  lineHeight: sharedLineHeight,
}
