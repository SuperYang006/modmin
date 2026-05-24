import type { ThemePreset } from '../types'
import { defaultBluePreset } from './defaultBlue'
import { tealGreenPreset } from './tealGreen'
import { warmOrangePreset } from './warmOrange'
import { royalPurplePreset } from './royalPurple'
import { rosePinkPreset } from './rosePink'
import { indigoPreset } from './indigo'
import { darkNeutralPreset } from './darkNeutral'
import { darkSlatePreset } from './darkSlate'
import { darkVioletPreset } from './darkViolet'

const registry: Record<string, ThemePreset> = {}

export function registerPreset(preset: ThemePreset): void {
  registry[preset.key] = preset
}

export function getPreset(key: string): ThemePreset | undefined {
  return registry[key]
}

export function listPresets(): ThemePreset[] {
  return Object.values(registry)
}

registerPreset(defaultBluePreset)
registerPreset(indigoPreset)
registerPreset(tealGreenPreset)
registerPreset(warmOrangePreset)
registerPreset(royalPurplePreset)
registerPreset(rosePinkPreset)
registerPreset(darkNeutralPreset)
registerPreset(darkSlatePreset)
registerPreset(darkVioletPreset)

export const DEFAULT_PRESET_KEY = defaultBluePreset.key
