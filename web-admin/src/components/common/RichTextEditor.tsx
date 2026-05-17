import { useEffect, useMemo, useRef, useState } from 'react'
import { Editor, Toolbar } from '@wangeditor/editor-for-react'
import type { IDomEditor, IEditorConfig, IToolbarConfig } from '@wangeditor/editor'
import '@wangeditor/editor/dist/css/style.css'
import { sanitizeRichTextHtml } from '@/runtime/richtext/html'

interface RichTextEditorProps {
  value?: string
  disabled?: boolean
  onChange: (value: string) => void
}

export function RichTextEditor(props: RichTextEditorProps) {
  const { disabled, onChange } = props
  const containerRef = useRef<HTMLDivElement | null>(null)
  const editorRef = useRef<IDomEditor | null>(null)
  const [editorReady, setEditorReady] = useState(false)
  const value = typeof props.value === 'string' ? props.value : ''
  const lastEmittedHtmlRef = useRef(sanitizeRichTextHtml(value))
  const latestHtmlRef = useRef(value)
  const syncTimerRef = useRef<number | null>(null)

  function emitChange(rawHtml: string) {
    const sanitizedHtml = sanitizeRichTextHtml(rawHtml)
    latestHtmlRef.current = rawHtml
    lastEmittedHtmlRef.current = sanitizedHtml
    onChange(sanitizedHtml)
  }

  function scheduleChange(rawHtml: string) {
    latestHtmlRef.current = rawHtml

    if (syncTimerRef.current !== null) {
      window.clearTimeout(syncTimerRef.current)
    }

    syncTimerRef.current = window.setTimeout(() => {
      syncTimerRef.current = null
      emitChange(latestHtmlRef.current)
    }, 250)
  }

  const toolbarConfig = useMemo<Partial<IToolbarConfig>>(
    () => ({
      modalAppendToBody: false,
      excludeKeys: [
        'fullScreen',
        'uploadImage',
        'insertVideo',
        'uploadVideo',
        'group-video',
        'emotion',
      ],
    }),
    [],
  )

  const editorConfig = useMemo<Partial<IEditorConfig>>(
    () => ({
      placeholder: '请输入富文本内容',
      readOnly: disabled === true,
      autoFocus: false,
      scroll: true,
      customPaste: (currentEditor, event) => {
        event.preventDefault()
        const text = event.clipboardData?.getData('text/plain') || ''
        currentEditor.insertText(text)
        return false
      },
      onBlur: (currentEditor) => {
        window.setTimeout(() => {
          const activeElement = document.activeElement

          if (activeElement && containerRef.current?.contains(activeElement)) {
            return
          }

          if (syncTimerRef.current !== null) {
            window.clearTimeout(syncTimerRef.current)
            syncTimerRef.current = null
          }

          emitChange(currentEditor.getHtml())
        }, 0)
      },
    }),
    [disabled, onChange],
  )

  useEffect(() => {
    const nextValue = sanitizeRichTextHtml(value)
    const editor = editorRef.current

    if (editor && nextValue !== lastEmittedHtmlRef.current) {
      editor.setHtml(value)
      lastEmittedHtmlRef.current = nextValue
    }
  }, [value])

  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return

    if (disabled) {
      editor.disable()
    } else {
      editor.enable()
    }
  }, [disabled, editorReady])

  useEffect(() => {
    return () => {
      if (syncTimerRef.current !== null) {
        window.clearTimeout(syncTimerRef.current)
      }

      if (editorRef.current) {
        emitChange(editorRef.current.getHtml())
      }

      editorRef.current?.destroy()
      editorRef.current = null
    }
  }, [])

  return (
    <div ref={containerRef} className={`runtime-richtext-editor${disabled ? ' is-disabled' : ''}`}>
      <Toolbar
        editor={editorRef.current}
        defaultConfig={toolbarConfig}
        mode="default"
        className="runtime-richtext-toolbar"
      />
      <Editor
        defaultConfig={editorConfig}
        defaultHtml={value}
        mode="default"
        className="runtime-richtext-editable"
        onCreated={(currentEditor) => {
          editorRef.current = currentEditor
          latestHtmlRef.current = currentEditor.getHtml()
          setEditorReady(true)
        }}
        onChange={(currentEditor) => {
          scheduleChange(currentEditor.getHtml())
        }}
      />
    </div>
  )
}
