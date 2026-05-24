import { useSyncExternalStore } from 'react'
import { DEFAULT_PRESET_KEY, getPreset } from '../presets'
import { applyCssVars } from '../css/buildCssVars'
import type { ThemePreset } from '../types'

const STORAGE_KEY = 'web_admin_theme_key'

type Listener = () => void

interface ThemeState {
  themeKey: string
  preset: ThemePreset
}

function readPersistedKey(): string {
  if (typeof localStorage === 'undefined') return DEFAULT_PRESET_KEY
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved && getPreset(saved)) return saved
  return DEFAULT_PRESET_KEY
}

function resolveState(themeKey: string): ThemeState {
  const preset = getPreset(themeKey) ?? getPreset(DEFAULT_PRESET_KEY)!
  return { themeKey: preset.key, preset }
}

let state: ThemeState = resolveState(readPersistedKey())
const listeners = new Set<Listener>()

function emit(): void {
  for (const l of listeners) l()
}

function applySideEffects(preset: ThemePreset): void {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-theme', preset.key)
  document.documentElement.setAttribute('data-theme-mode', preset.mode)
  applyCssVars(preset)
}

applySideEffects(state.preset)

export const themeStore = {
  getState(): ThemeState {
    return state
  },
  setThemeKey(themeKey: string): void {
    const next = resolveState(themeKey)
    if (next.themeKey === state.themeKey) return
    state = next
    try {
      localStorage.setItem(STORAGE_KEY, next.themeKey)
    } catch {
      // localStorage unavailable — silently ignore
    }
    applySideEffects(next.preset)
    emit()
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
}

export function useThemeState(): ThemeState {
  return useSyncExternalStore(
    themeStore.subscribe,
    themeStore.getState,
    themeStore.getState,
  )
}

export function useThemePreset(): ThemePreset {
  return useThemeState().preset
}
