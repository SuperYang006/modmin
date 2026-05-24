import type { ThemePreset } from '../types'

function buildSidebar(preset: ThemePreset) {
  if (preset.mode === 'dark') {
    return {
      bg: `linear-gradient(180deg, ${preset.background.elevated} 0%, ${preset.background.container} 55%, ${preset.background.layout} 100%)`,
      border: 'rgba(255, 255, 255, 0.08)',
      divider: 'rgba(255, 255, 255, 0.06)',
      text: 'rgba(255, 255, 255, 0.70)',
      textActive: '#ffffff',
      icon: 'rgba(255, 255, 255, 0.72)',
      hoverBg: 'rgba(255, 255, 255, 0.06)',
      selectedBg: `linear-gradient(90deg, ${preset.brand.primaryBg} 0%, transparent 100%)`,
      scrollbar: 'rgba(255, 255, 255, 0.18)',
      scrollbarHover: 'rgba(255, 255, 255, 0.32)',
      brandTitle: '#ffffff',
      brandSubtitle: 'rgba(255, 255, 255, 0.62)',
      shadow: '1px 0 0 rgba(255, 255, 255, 0.04), 4px 0 24px rgba(0, 0, 0, 0.35)',
    }
  }
  return {
    bg: 'linear-gradient(180deg, #ffffff 0%, #f7f9fc 60%, #f1f4f9 100%)',
    border: 'rgba(15, 29, 51, 0.08)',
    divider: 'rgba(15, 29, 51, 0.06)',
    text: 'rgba(34, 47, 71, 0.72)',
    textActive: '#0f1d33',
    icon: 'rgba(34, 47, 71, 0.6)',
    hoverBg: 'rgba(15, 29, 51, 0.04)',
    selectedBg: `linear-gradient(90deg, ${preset.brand.primaryBg} 0%, transparent 100%)`,
    scrollbar: 'rgba(15, 29, 51, 0.18)',
    scrollbarHover: 'rgba(15, 29, 51, 0.32)',
    brandTitle: '#0f1d33',
    brandSubtitle: 'rgba(34, 47, 71, 0.6)',
    shadow: '1px 0 0 rgba(15, 29, 51, 0.04), 4px 0 24px rgba(15, 29, 51, 0.05)',
  }
}

export function buildCssVars(preset: ThemePreset): Record<string, string> {
  const { brand, text, background, border, semantic, code, radius, shadow, fontSize, lineHeight } = preset
  const sidebar = buildSidebar(preset)
  return {
    '--color-primary': brand.primary,
    '--color-primary-hover': brand.primaryHover,
    '--color-primary-active': brand.primaryActive,
    '--color-primary-bg': brand.primaryBg,
    '--color-primary-border': brand.primaryBorder,

    '--color-text': text.primary,
    '--color-text-secondary': text.secondary,
    '--color-text-tertiary': text.tertiary,
    '--color-text-disabled': text.disabled,

    '--bg-layout': background.layout,
    '--bg-container': background.container,
    '--bg-elevated': background.elevated,
    '--bg-subtle': background.subtle,
    '--bg-muted': background.muted,
    '--bg-hover': background.hover,

    '--border-default': border.default,
    '--border-secondary': border.secondary,
    '--border-light': border.light,
    '--border-active': border.active,

    '--color-success': semantic.success,
    '--color-success-bg': semantic.successBg,
    '--color-warning': semantic.warning,
    '--color-warning-bg': semantic.warningBg,
    '--color-error': semantic.error,
    '--color-error-bg': semantic.errorBg,
    '--color-info': semantic.info,

    '--code-bg': code.blockBg,
    '--code-text': code.blockText,
    '--inline-code-bg': code.inlineBg,
    '--inline-code-text': code.inlineText,

    '--radius-xs': `${radius.xs}px`,
    '--radius-sm': `${radius.sm}px`,
    '--radius-md': `${radius.md}px`,
    '--radius-lg': `${radius.lg}px`,
    '--radius-xl': `${radius.xl}px`,

    '--shadow-sm': shadow.sm,
    '--shadow-md': shadow.md,
    '--shadow-lg': shadow.lg,

    '--font-size-xs': `${fontSize.xs}px`,
    '--font-size-sm': `${fontSize.sm}px`,
    '--font-size-base': `${fontSize.base}px`,
    '--font-size-md': `${fontSize.md}px`,
    '--font-size-lg': `${fontSize.lg}px`,
    '--font-size-xl': `${fontSize.xl}px`,
    '--font-size-2xl': `${fontSize.xxl}px`,

    '--line-tight': String(lineHeight.tight),
    '--line-normal': String(lineHeight.normal),
    '--line-relaxed': String(lineHeight.relaxed),

    '--bg-sidebar': sidebar.bg,
    '--sidebar-shadow': sidebar.shadow,
    '--sidebar-border': sidebar.border,
    '--sidebar-divider': sidebar.divider,
    '--color-sidebar-text': sidebar.text,
    '--color-sidebar-text-active': sidebar.textActive,
    '--color-sidebar-icon': sidebar.icon,
    '--bg-sidebar-hover': sidebar.hoverBg,
    '--bg-sidebar-selected': sidebar.selectedBg,
    '--color-sidebar-scrollbar': sidebar.scrollbar,
    '--color-sidebar-scrollbar-hover': sidebar.scrollbarHover,
    '--color-sidebar-brand-title': sidebar.brandTitle,
    '--color-sidebar-brand-subtitle': sidebar.brandSubtitle,
  }
}

export function applyCssVars(preset: ThemePreset, target: HTMLElement = document.documentElement): void {
  const vars = buildCssVars(preset)
  for (const [name, value] of Object.entries(vars)) {
    target.style.setProperty(name, value)
  }
}
