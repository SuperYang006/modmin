import type { ThemePreset } from '../types'
import {
  sharedRadius,
  sharedShadow,
  sharedFontSize,
  sharedLineHeight,
} from '../sharedScales'

export const tealGreenPreset: ThemePreset = {
  key: 'teal-green',
  label: '青绿',
  mode: 'light',
  brand: {
    primary: '#13a8a8',
    primaryHover: '#36c2c2',
    primaryActive: '#0e8585',
    primaryBg: '#e6f7f7',
    primaryBorder: '#8fd9d9',
  },
  text: {
    primary: '#1f1f1f',
    secondary: 'rgba(0,0,0,0.65)',
    tertiary: 'rgba(0,0,0,0.45)',
    disabled: 'rgba(0,0,0,0.25)',
  },
  background: {
    layout: '#f4f8f7',
    container: '#ffffff',
    elevated: '#ffffff',
    subtle: '#fafafa',
    muted: '#f5f9f8',
    hover: '#effaf8',
  },
  border: {
    default: '#d9d9d9',
    secondary: '#e1e8e6',
    light: '#f0f0f0',
    active: '#8fd9d9',
  },
  semantic: {
    success: '#52c41a',
    successBg: '#f6ffed',
    warning: '#faad14',
    warningBg: '#fffbe6',
    error: '#ff4d4f',
    errorBg: '#fff2f0',
    info: '#13a8a8',
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
