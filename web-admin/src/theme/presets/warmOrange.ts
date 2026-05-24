import type { ThemePreset } from '../types'
import {
  sharedRadius,
  sharedShadow,
  sharedFontSize,
  sharedLineHeight,
} from '../sharedScales'

export const warmOrangePreset: ThemePreset = {
  key: 'warm-orange',
  label: '暖橙',
  mode: 'light',
  brand: {
    primary: '#f97316',
    primaryHover: '#fb923c',
    primaryActive: '#c2570c',
    primaryBg: '#fff3e8',
    primaryBorder: '#fcc89a',
  },
  text: {
    primary: '#1f1f1f',
    secondary: 'rgba(0,0,0,0.65)',
    tertiary: 'rgba(0,0,0,0.45)',
    disabled: 'rgba(0,0,0,0.25)',
  },
  background: {
    layout: '#fbf7f3',
    container: '#ffffff',
    elevated: '#ffffff',
    subtle: '#fafafa',
    muted: '#faf6f1',
    hover: '#fff5ec',
  },
  border: {
    default: '#d9d9d9',
    secondary: '#ede4d9',
    light: '#f0f0f0',
    active: '#fcc89a',
  },
  semantic: {
    success: '#52c41a',
    successBg: '#f6ffed',
    warning: '#faad14',
    warningBg: '#fffbe6',
    error: '#ff4d4f',
    errorBg: '#fff2f0',
    info: '#f97316',
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
