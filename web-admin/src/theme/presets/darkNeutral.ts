import type { ThemePreset } from '../types'
import { sharedRadius, sharedFontSize, sharedLineHeight } from '../sharedScales'

export const darkNeutralPreset: ThemePreset = {
  key: 'dark-neutral',
  label: '暗色',
  mode: 'dark',
  brand: {
    primary: '#4096ff',
    primaryHover: '#69b1ff',
    primaryActive: '#1677ff',
    primaryBg: 'rgba(64, 150, 255, 0.12)',
    primaryBorder: 'rgba(64, 150, 255, 0.35)',
  },
  text: {
    primary: 'rgba(255, 255, 255, 0.88)',
    secondary: 'rgba(255, 255, 255, 0.65)',
    tertiary: 'rgba(255, 255, 255, 0.40)',
    disabled: 'rgba(255, 255, 255, 0.22)',
  },
  background: {
    layout: '#000000',
    container: '#141414',
    elevated: '#1f1f1f',
    subtle: '#1d1d1d',
    muted: '#0f0f0f',
    hover: '#1d1d1d',
  },
  border: {
    default: 'rgba(255, 255, 255, 0.15)',
    secondary: 'rgba(255, 255, 255, 0.09)',
    light: 'rgba(255, 255, 255, 0.06)',
    active: 'rgba(64, 150, 255, 0.50)',
  },
  semantic: {
    success: '#49aa19',
    successBg: 'rgba(73, 170, 25, 0.12)',
    warning: '#d89614',
    warningBg: 'rgba(216, 150, 20, 0.12)',
    error: '#dc4446',
    errorBg: 'rgba(220, 68, 70, 0.12)',
    info: '#4096ff',
  },
  code: {
    blockBg: '#0d1117',
    blockText: '#e6edf3',
    inlineBg: 'rgba(255, 255, 255, 0.08)',
    inlineText: '#ff8080',
  },
  radius: sharedRadius,
  shadow: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.30)',
    md: '0 6px 16px rgba(0, 0, 0, 0.45)',
    lg: '0 12px 28px rgba(0, 0, 0, 0.60)',
  },
  fontSize: sharedFontSize,
  lineHeight: sharedLineHeight,
}
