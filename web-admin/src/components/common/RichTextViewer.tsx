import { getRichTextPlainText, sanitizeRichTextHtml } from '@/runtime/richtext/html'

interface RichTextViewerProps {
  value: unknown
  mode?: 'table' | 'detail'
}

function truncateText(value: string, maxLength = 80) {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value
}

export function RichTextViewer(props: RichTextViewerProps) {
  const plainText = getRichTextPlainText(props.value)

  if (!plainText) {
    return <span>-</span>
  }

  if (props.mode === 'table') {
    const text = truncateText(plainText)
    return <span title={plainText}>{text}</span>
  }

  return (
    <div
      className="runtime-richtext-viewer"
      dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(props.value) }}
    />
  )
}

