import type { ThemePreset } from '../types'
import { sharedRadius, sharedFontSize, sharedLineHeight } from '../sharedScales'

export const darkSlatePreset: ThemePreset = {
  key: 'dark-slate',
  label: '深石板',
  mode: 'dark',
  brand: {
    primary: '#7c8df7',
    primaryHover: '#9aa8fa',
    primaryActive: '#5b6fe6',
    primaryBg: 'rgba(124, 141, 247, 0.14)',
    primaryBorder: 'rgba(124, 141, 247, 0.38)',
  },
  text: {
    primary: 'rgba(232, 236, 247, 0.92)',
    secondary: 'rgba(232, 236, 247, 0.68)',
    tertiary: 'rgba(232, 236, 247, 0.42)',
    disabled: 'rgba(232, 236, 247, 0.24)',
  },
  background: {
    layout: '#0e1320',
    container: '#171c2b',
    elevated: '#1f2538',
    subtle: '#1b2030',
    muted: '#13182a',
    hover: '#1f2538',
  },
  border: {
    default: 'rgba(232, 236, 247, 0.14)',
    secondary: 'rgba(232, 236, 247, 0.08)',
    light: 'rgba(232, 236, 247, 0.05)',
    active: 'rgba(124, 141, 247, 0.50)',
  },
  semantic: {
    success: '#49aa19',
    successBg: 'rgba(73, 170, 25, 0.14)',
    warning: '#d89614',
    warningBg: 'rgba(216, 150, 20, 0.14)',
    error: '#dc4446',
    errorBg: 'rgba(220, 68, 70, 0.14)',
    info: '#7c8df7',
  },
  code: {
    blockBg: '#0b1020',
    blockText: '#e6edf3',
    inlineBg: 'rgba(232, 236, 247, 0.08)',
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
