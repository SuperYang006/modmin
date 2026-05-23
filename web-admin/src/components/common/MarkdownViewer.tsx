import { useEffect, useRef, useState } from 'react'
import 'vditor/dist/index.css'
import { getRichTextPlainText, hasRichTextContent } from '@/runtime/richtext/html'
import { renderMarkdownToHtml } from '@/runtime/markdown/html'

interface MarkdownViewerProps {
  value: unknown
  mode?: 'table' | 'detail'
}

function truncateText(value: string, maxLength = 80) {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value
}

export function MarkdownViewer(props: MarkdownViewerProps) {
  const mdText = typeof props.value === 'string' ? props.value : ''
  const [html, setHtml] = useState('')
  const mountedRef = useRef(false)

  // Skip md2html for empty content or table mode
  const shouldRender = Boolean(mdText && props.mode !== 'table')

  useEffect(() => {
    if (!shouldRender) {
      setHtml('')
      return
    }

    mountedRef.current = true

    renderMarkdownToHtml(mdText).then((result) => {
      if (mountedRef.current) {
        setHtml(result)
      }
    })

    return () => {
      mountedRef.current = false
    }
  }, [mdText, shouldRender])

  const plainText = getRichTextPlainText(mdText)
  const hasContent = hasRichTextContent(mdText)

  if (!hasContent) {
    return <span>-</span>
  }

  if (props.mode === 'table') {
    const text = plainText ? truncateText(plainText) : '[图片]'
    return <span title={plainText || text}>{text}</span>
  }

  return (
    <div
      className="runtime-markdown-viewer vditor-reset"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
