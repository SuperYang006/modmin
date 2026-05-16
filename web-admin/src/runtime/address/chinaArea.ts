import { regionData, codeToText } from 'element-china-area-data'

export interface ChinaAreaOption {
  value: string
  label: string
  children?: ChinaAreaOption[]
}

export interface AddressSelection {
  province: string
  city: string
  district: string
}

export const chinaAreaOptions = regionData as ChinaAreaOption[]

export function getChinaAreaLabel(code?: string) {
  if (!code) {
    return ''
  }

  return codeToText[code] ?? ''
}

export function getAddressPathFromValue(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return []
  }

  const address = value as Partial<AddressSelection>
  return [address.province, address.city, address.district].filter((item): item is string => Boolean(item))
}

export function getAddressPathFromJson(value: string) {
  if (!value) {
    return []
  }

  try {
    const parsed = JSON.parse(value)
    return getAddressPathFromValue(parsed)
  } catch {
    return []
  }
}

export function buildAddressValueFromPath(path: string[]) {
  const [province = '', city = '', district = ''] = path
  return {
    province,
    city,
    district,
  }
}

export function normalizeAddressPathByGranularity(path: string[], granularity: 'province' | 'city' | 'district') {
  if (!Array.isArray(path)) {
    return []
  }

  if (granularity === 'province') {
    return path.slice(0, 1)
  }

  if (granularity === 'city') {
    return path.slice(0, 2)
  }

  return path.slice(0, 3)
}

export function getChinaAreaOptionsByGranularity(granularity: 'province' | 'city' | 'district') {
  if (granularity === 'district') {
    return chinaAreaOptions
  }

  if (granularity === 'city') {
    return chinaAreaOptions.map((province) => ({
      ...province,
      children: Array.isArray(province.children)
        ? province.children.map((city) => ({
            ...city,
            children: undefined,
          }))
        : undefined,
    }))
  }

  return chinaAreaOptions.map((province) => ({
    ...province,
    children: undefined,
  }))
}

export function stringifyAddressValueFromPath(path: string[]) {
  const value = buildAddressValueFromPath(path)

  if (!value.province && !value.city && !value.district) {
    return ''
  }

  return JSON.stringify(value)
}

export function formatAddressText(value: unknown) {
  if (!value) {
    return '-'
  }

  let parsed = value

  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value)
    } catch {
      return value || '-'
    }
  }

  const path = getAddressPathFromValue(parsed)
  if (!path.length) {
    return '-'
  }

  return path
    .map((code) => getChinaAreaLabel(code) || code)
    .filter(Boolean)
    .join(' / ')
}
