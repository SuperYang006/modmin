import { useResolvedRichTextHtml } from '@/runtime/richtext/assets'
import { getRichTextPlainText, hasRichTextContent } from '@/runtime/richtext/html'

interface RichTextViewerProps {
  value: unknown
  mode?: 'table' | 'detail'
}

function truncateText(value: string, maxLength = 80) {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value
}

export function RichTextViewer(props: RichTextViewerProps) {
  const plainText = getRichTextPlainText(props.value)
  const resolvedHtml = useResolvedRichTextHtml(props.value)

  if (!hasRichTextContent(props.value)) {
    return <span>-</span>
  }

  if (props.mode === 'table') {
    const text = plainText ? truncateText(plainText) : '[图片]'
    return <span title={plainText || text}>{text}</span>
  }

  return (
    <div
      className="runtime-richtext-viewer"
      dangerouslySetInnerHTML={{ __html: resolvedHtml }}
    />
  )
}
