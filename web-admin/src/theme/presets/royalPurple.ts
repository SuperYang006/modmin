import type { ThemePreset } from '../types'
import {
  sharedRadius,
  sharedShadow,
  sharedFontSize,
  sharedLineHeight,
} from '../sharedScales'

export const royalPurplePreset: ThemePreset = {
  key: 'royal-purple',
  label: '酱紫',
  mode: 'light',
  brand: {
    primary: '#722ed1',
    primaryHover: '#9254de',
    primaryActive: '#531dab',
    primaryBg: '#f4ebff',
    primaryBorder: '#d3adf7',
  },
  text: {
    primary: '#1f1f1f',
    secondary: 'rgba(0,0,0,0.65)',
    tertiary: 'rgba(0,0,0,0.45)',
    disabled: 'rgba(0,0,0,0.25)',
  },
  background: {
    layout: '#f7f5fb',
    container: '#ffffff',
    elevated: '#ffffff',
    subtle: '#faf8fd',
    muted: '#f5f2fa',
    hover: '#f9f3ff',
  },
  border: {
    default: '#d9d9d9',
    secondary: '#e8e3f0',
    light: '#f0ebf7',
    active: '#d3adf7',
  },
  semantic: {
    success: '#52c41a',
    successBg: '#f6ffed',
    warning: '#faad14',
    warningBg: '#fffbe6',
    error: '#ff4d4f',
    errorBg: '#fff2f0',
    info: '#722ed1',
  },
  code: {
    blockBg: '#2b1747',
    blockText: '#ede4ff',
    inlineBg: '#f4ebff',
    inlineText: '#531dab',
  },
  radius: sharedRadius,
  shadow: sharedShadow,
  fontSize: sharedFontSize,
  lineHeight: sharedLineHeight,
}
