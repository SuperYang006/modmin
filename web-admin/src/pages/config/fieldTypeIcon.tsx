import type { ReactNode } from 'react'
import {
  AudioOutlined,
  CalendarOutlined,
  CheckSquareOutlined,
  CodeOutlined,
  FileImageOutlined,
  FileMarkdownOutlined,
  FileOutlined,
  FileTextOutlined,
  FontSizeOutlined,
  NumberOutlined,
  OrderedListOutlined,
  PushpinOutlined,
  ShareAltOutlined,
  SlidersOutlined,
  TagsOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons'

export function getFieldTypeIcon(type: string): ReactNode {
  if (type === 'text') {
    return <FontSizeOutlined />
  }

  if (type === 'textarea') {
    return <FileTextOutlined />
  }

  if (type === 'richtext') {
    return <FileTextOutlined />
  }

  if (type === 'markdown') {
    return <FileMarkdownOutlined />
  }

  if (type === 'number') {
    return <NumberOutlined />
  }

  if (type === 'boolean') {
    return <CheckSquareOutlined />
  }

  if (type === 'date' || type === 'datetime') {
    return <CalendarOutlined />
  }

  if (type === 'enum') {
    return <TagsOutlined />
  }

  if (type === 'relation' || type === 'multiRelation' || type === 'polyRelation' || type === 'multiPolyRelation') {
    return <ShareAltOutlined />
  }

  if (type === 'array') {
    return <OrderedListOutlined />
  }

  if (type === 'image') {
    return <FileImageOutlined />
  }

  if (type === 'file') {
    return <FileOutlined />
  }

  if (type === 'video') {
    return <VideoCameraOutlined />
  }

  if (type === 'audio') {
    return <AudioOutlined />
  }

  if (type === 'json') {
    return <CodeOutlined />
  }

  if (type === 'location' || type === 'address') {
    return <PushpinOutlined />
  }

  return <SlidersOutlined />
}
