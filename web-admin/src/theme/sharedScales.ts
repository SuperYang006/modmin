import type {
  RadiusScale,
  ShadowScale,
  FontSizeScale,
  LineHeightScale,
} from './types'

export const sharedRadius: RadiusScale = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
}

export const sharedShadow: ShadowScale = {
  sm: '0 1px 2px rgba(0,0,0,0.04)',
  md: '0 6px 16px rgba(0,0,0,0.08)',
  lg: '0 12px 28px rgba(0,0,0,0.12)',
}

export const sharedFontSize: FontSizeScale = {
  xs: 11,
  sm: 12,
  base: 13,
  md: 14,
  lg: 16,
  xl: 20,
  xxl: 24,
}

export const sharedLineHeight: LineHeightScale = {
  tight: 1.2,
  normal: 1.5,
  relaxed: 1.75,
}
