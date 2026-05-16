import { ADDRESS_TYPES, ARRAY_TYPES, DATE_TYPES, ENUM_TYPES, LOCATION_TYPES, MEDIA_TYPES, NUMBER_TYPES, TEXT_LIKE_TYPES } from '@/pages/config/modelFieldConfig'

export function getFieldTypeTone(type: string) {
  if (['relation', 'multiRelation', 'polyRelation', 'multiPolyRelation'].includes(type)) {
    return 'cyan'
  }

  if (type === 'boolean') {
    return 'lime'
  }

  if (TEXT_LIKE_TYPES.includes(type)) {
    return 'cyan'
  }

  if (NUMBER_TYPES.includes(type)) {
    return 'blue'
  }

  if (DATE_TYPES.includes(type)) {
    return 'purple'
  }

  if (ENUM_TYPES.includes(type)) {
    return 'gold'
  }

  if (ARRAY_TYPES.includes(type)) {
    return 'geekblue'
  }

  if (MEDIA_TYPES.includes(type)) {
    return 'magenta'
  }

  if (LOCATION_TYPES.includes(type) || ADDRESS_TYPES.includes(type)) {
    return 'green'
  }

  if (type === 'json') {
    return 'volcano'
  }

  return 'default'
}
