import type { ThemePreset } from '../types'
import {
  sharedRadius,
  sharedShadow,
  sharedFontSize,
  sharedLineHeight,
} from '../sharedScales'

export const rosePinkPreset: ThemePreset = {
  key: 'rose-pink',
  label: '玫瑰红',
  mode: 'light',
  brand: {
    primary: '#eb2f96',
    primaryHover: '#f759ab',
    primaryActive: '#c41d7f',
    primaryBg: '#fff0f6',
    primaryBorder: '#ffadd2',
  },
  text: {
    primary: '#1f1f1f',
    secondary: 'rgba(0,0,0,0.65)',
    tertiary: 'rgba(0,0,0,0.45)',
    disabled: 'rgba(0,0,0,0.25)',
  },
  background: {
    layout: '#fbf5f8',
    container: '#ffffff',
    elevated: '#ffffff',
    subtle: '#fdf8fb',
    muted: '#faf2f6',
    hover: '#fff5f9',
  },
  border: {
    default: '#d9d9d9',
    secondary: '#efe3ea',
    light: '#f7ecf2',
    active: '#ffadd2',
  },
  semantic: {
    success: '#52c41a',
    successBg: '#f6ffed',
    warning: '#faad14',
    warningBg: '#fffbe6',
    error: '#ff4d4f',
    errorBg: '#fff2f0',
    info: '#eb2f96',
  },
  code: {
    blockBg: '#2a1421',
    blockText: '#ffe0ee',
    inlineBg: '#fff0f6',
    inlineText: '#c41d7f',
  },
  radius: sharedRadius,
  shadow: sharedShadow,
  fontSize: sharedFontSize,
  lineHeight: sharedLineHeight,
}
