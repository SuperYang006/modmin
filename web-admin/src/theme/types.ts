export type ThemeMode = 'light' | 'dark'

export interface BrandColors {
  primary: string
  primaryHover: string
  primaryActive: string
  primaryBg: string
  primaryBorder: string
}

export interface TextColors {
  primary: string
  secondary: string
  tertiary: string
  disabled: string
}

export interface BackgroundColors {
  layout: string
  container: string
  elevated: string
  subtle: string
  muted: string
  hover: string
}

export interface BorderColors {
  default: string
  secondary: string
  light: string
  active: string
}

export interface SemanticColors {
  success: string
  successBg: string
  warning: string
  warningBg: string
  error: string
  errorBg: string
  info: string
}

export interface CodeColors {
  blockBg: string
  blockText: string
  inlineBg: string
  inlineText: string
}

export interface RadiusScale {
  xs: number
  sm: number
  md: number
  lg: number
  xl: number
}

export interface ShadowScale {
  sm: string
  md: string
  lg: string
}

export interface FontSizeScale {
  xs: number
  sm: number
  base: number
  md: number
  lg: number
  xl: number
  xxl: number
}

export interface LineHeightScale {
  tight: number
  normal: number
  relaxed: number
}

export interface ThemePreset {
  key: string
  label: string
  mode: ThemeMode
  brand: BrandColors
  text: TextColors
  background: BackgroundColors
  border: BorderColors
  semantic: SemanticColors
  code: CodeColors
  radius: RadiusScale
  shadow: ShadowScale
  fontSize: FontSizeScale
  lineHeight: LineHeightScale
}
