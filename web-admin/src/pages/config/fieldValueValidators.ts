import { buildAddressDefaultValue, buildLocationValidationValue } from '@/pages/config/fieldValueBuilders'

const ARRAY_TYPES = ['array']
const LOCATION_TYPES = ['location']
const ADDRESS_TYPES = ['address']
const POLY_RELATION_TYPES = ['polyRelation', 'multiPolyRelation']

interface FieldConfigModalStateLike {
  type: string
  defaultValue: string
  jsonValueType?: 'any' | 'object' | 'array'
  addressGranularity: 'province' | 'city' | 'district'
  locationRequireAddress: boolean
  locationRequireName: boolean
  locationLng: string
  locationLat: string
  locationAddress: string
  locationName: string
  addressPath: string[]
}

export function validateStructuredDefaultValue(state: FieldConfigModalStateLike) {
  if (!state.defaultValue.trim() && !LOCATION_TYPES.includes(state.type) && !ADDRESS_TYPES.includes(state.type)) {
    return null
  }

  if (ARRAY_TYPES.includes(state.type)) {
    try {
      const parsed = JSON.parse(state.defaultValue)
      if (!Array.isArray(parsed)) {
        return '数组字段默认值必须是合法 JSON 数组'
      }
    } catch {
      return '数组字段默认值必须是合法 JSON 数组'
    }
  }

  if (state.type === 'json') {
    try {
      const parsed = JSON.parse(state.defaultValue)

      if (state.jsonValueType === 'object' && (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))) {
        return 'JSON 字段默认值必须是合法 JSON 对象'
      }

      if (state.jsonValueType === 'array' && !Array.isArray(parsed)) {
        return 'JSON 字段默认值必须是合法 JSON 数组'
      }
    } catch {
      return 'JSON 字段默认值必须是合法 JSON'
    }
  }

  if (POLY_RELATION_TYPES.includes(state.type)) {
    if (state.type === 'multiPolyRelation') {
      try {
        const parsed = JSON.parse(state.defaultValue)

        if (!Array.isArray(parsed)) {
          return '多模型多关联默认值必须是合法 JSON 数组'
        }

        for (const item of parsed) {
          if (!item || typeof item !== 'object' || Array.isArray(item)) {
            return '多模型多关联默认值中的每一项都必须是对象'
          }

          if (typeof item.collection !== 'string' || !item.collection.trim()) {
            return '多模型多关联默认值中的每一项都必须包含 collection'
          }

          if (typeof item.id !== 'string' || !item.id.trim()) {
            return '多模型多关联默认值中的每一项都必须包含 id'
          }
        }
      } catch {
        return '多模型多关联默认值必须是合法 JSON 数组'
      }

      return null
    }

    try {
      const parsed = JSON.parse(state.defaultValue)

      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return '多模型关联默认值必须是合法 JSON 对象'
      }

      if (typeof parsed.collection !== 'string' || !parsed.collection.trim()) {
        return '多模型关联默认值必须包含 collection'
      }

      if (typeof parsed.id !== 'string' || !parsed.id.trim()) {
        return '多模型关联默认值必须包含 id'
      }
    } catch {
      return '多模型关联默认值必须是合法 JSON 对象'
    }
  }

  if (LOCATION_TYPES.includes(state.type)) {
    const hasLocationDefaultValue =
      !!state.locationLng.trim() || !!state.locationLat.trim() || !!state.locationAddress.trim() || !!state.locationName.trim()

    if (!hasLocationDefaultValue) {
      return null
    }

    if (!state.locationLng.trim() || !state.locationLat.trim()) {
      return '位置字段默认值必须填写 lng 和 lat'
    }

    if (state.locationRequireAddress && !state.locationAddress.trim()) {
      return '当前位置配置要求默认值必须填写 address'
    }

    if (state.locationRequireName && !state.locationName.trim()) {
      return '当前位置配置要求默认值必须填写 name'
    }

    try {
      const parsed = JSON.parse(buildLocationValidationValue(state))

      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return '位置字段默认值必须是合法 JSON 对象'
      }

      if (typeof parsed.lng !== 'number' || Number.isNaN(parsed.lng)) {
        return '位置字段默认值必须包含数字类型的 lng'
      }

      if (typeof parsed.lat !== 'number' || Number.isNaN(parsed.lat)) {
        return '位置字段默认值必须包含数字类型的 lat'
      }
    } catch {
      return '位置字段默认值必须是合法 JSON 对象'
    }
  }

  if (ADDRESS_TYPES.includes(state.type)) {
    const hasAddressDefaultValue = Array.isArray(state.addressPath) && state.addressPath.length > 0

    if (!hasAddressDefaultValue) {
      return null
    }

    const granularityOrder = {
      province: 1,
      city: 2,
      district: 3,
    }

    if (!Array.isArray(state.addressPath) || state.addressPath.length < 1) {
      return '地址字段默认值至少需要填写省'
    }

    if (granularityOrder[state.addressGranularity] >= 2 && state.addressPath.length < 2) {
      return '当前地址粒度要求填写市'
    }

    if (granularityOrder[state.addressGranularity] >= 3 && state.addressPath.length < 3) {
      return '当前地址粒度要求填写区'
    }

    try {
      const parsed = JSON.parse(buildAddressDefaultValue(state))
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return '地址字段默认值必须是合法 JSON 对象'
      }
    } catch {
      return '地址字段默认值必须是合法 JSON 对象'
    }
  }

  return null
}
