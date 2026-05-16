import { buildAddressValueFromPath, getAddressPathFromJson } from '@/runtime/address/chinaArea'

interface LocationValueState {
  locationLng: string
  locationLat: string
  locationAddress: string
  locationName: string
}

interface LocationStoredValueState extends LocationValueState {
  locationCoordinateSystem: 'gcj02' | 'wgs84'
}

interface AddressValueState {
  addressPath: string[]
}

export function parseLocationDefaultValue(value?: string) {
  if (!value || !value.trim()) {
    return {
      lng: '',
      lat: '',
      address: '',
      name: '',
    }
  }

  try {
    const parsed = JSON.parse(value)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {
        lng: '',
        lat: '',
        address: '',
        name: '',
      }
    }

    return {
      lng: parsed.lng === undefined || parsed.lng === null ? '' : String(parsed.lng),
      lat: parsed.lat === undefined || parsed.lat === null ? '' : String(parsed.lat),
      address: typeof parsed.address === 'string' ? parsed.address : '',
      name: typeof parsed.name === 'string' ? parsed.name : '',
    }
  } catch {
    return {
      lng: '',
      lat: '',
      address: '',
      name: '',
    }
  }
}

export function buildLocationValidationValue(state: LocationValueState) {
  if (!state.locationLng.trim() && !state.locationLat.trim() && !state.locationAddress.trim() && !state.locationName.trim()) {
    return ''
  }

  return JSON.stringify({
    lng: Number(state.locationLng),
    lat: Number(state.locationLat),
    address: state.locationAddress.trim(),
    name: state.locationName.trim(),
  })
}

export function buildLocationStoredDefaultValue(state: LocationStoredValueState) {
  if (!state.locationLng.trim() && !state.locationLat.trim() && !state.locationAddress.trim() && !state.locationName.trim()) {
    return ''
  }

  return JSON.stringify({
    lng: Number(state.locationLng),
    lat: Number(state.locationLat),
    address: state.locationAddress.trim(),
    name: state.locationName.trim(),
    coordinateSystem: state.locationCoordinateSystem,
  })
}

export function parseAddressDefaultValue(value?: string) {
  return getAddressPathFromJson(value || '')
}

export function buildAddressDefaultValue(state: AddressValueState) {
  if (!Array.isArray(state.addressPath) || state.addressPath.length === 0) {
    return ''
  }

  return JSON.stringify(buildAddressValueFromPath(state.addressPath))
}
