import { useEffect, useMemo, useRef, useState } from 'react'
import { message } from 'antd'
import { Editor, Toolbar } from '@wangeditor/editor-for-react'
import type { IDomEditor, IEditorConfig, IToolbarConfig } from '@wangeditor/editor'
import '@wangeditor/editor/dist/css/style.css'
import { uploadAsset, resolveAssetUrl } from '@/services/asset'
import { buildRichTextImageHtml, useResolvedRichTextHtml } from '@/runtime/richtext/assets'
import { sanitizeRichTextHtml, serializeRichTextHtmlForStorage } from '@/runtime/richtext/html'

interface RichTextEditorProps {
  value?: string
  disabled?: boolean
  collectionName?: string
  fieldKey?: string
  onChange: (value: string) => void
}

const MAX_RICH_TEXT_IMAGE_SIZE = 5 * 1024 * 1024

function normalizeNetworkImageUrl(value: string) {
  return value.trim()
}

function checkNetworkImageUrl(value: string) {
  const url = normalizeNetworkImageUrl(value)
  if (!url) {
    return '请输入图片地址'
  }

  if (!/^https?:\/\//i.test(url)) {
    return '图片地址仅支持 http 或 https'
  }

  return true
}

function injectImageModalHelp(container: HTMLElement | null) {
  if (!container) return

  const modals = Array.from(container.querySelectorAll<HTMLElement>('.w-e-modal'))
  modals.forEach((modal) => {
    if (modal.querySelector('.runtime-richtext-image-modal-help')) {
      return
    }

    const text = modal.textContent || ''
    if (!text.includes('图片地址') || !text.includes('图片链接')) {
      return
    }

    const help = document.createElement('div')
    help.className = 'runtime-richtext-image-modal-help'
    help.textContent = '提示：图片地址用于显示图片；图片链接用于点击图片后跳转，可留空。'
    modal.insertBefore(help, modal.firstChild)
  })
}

function applyDefaultImageWidth(rawHtml: string) {
  if (typeof document === 'undefined') {
    return rawHtml
  }

  const template = document.createElement('template')
  template.innerHTML = rawHtml

  Array.from(template.content.querySelectorAll('img')).forEach((image) => {
    if (!image.style.width) {
      image.style.width = '100%'
    }
  })

  return template.innerHTML
}

export function RichTextEditor(props: RichTextEditorProps) {
  const { disabled, onChange } = props
  const containerRef = useRef<HTMLDivElement | null>(null)
  const editorRef = useRef<IDomEditor | null>(null)
  const [editorReady, setEditorReady] = useState(false)
  const value = typeof props.value === 'string' ? props.value : ''
  const resolvedValue = useResolvedRichTextHtml(value)
  const lastEmittedHtmlRef = useRef(serializeRichTextHtmlForStorage(value))
  const lastAppliedDisplayHtmlRef = useRef(sanitizeRichTextHtml(resolvedValue))
  const latestHtmlRef = useRef(value)
  const syncTimerRef = useRef<number | null>(null)

  function emitChange(rawHtml: string) {
    const htmlWithDefaultImageWidth = applyDefaultImageWidth(rawHtml)
    const sanitizedHtml = serializeRichTextHtmlForStorage(htmlWithDefaultImageWidth)
    latestHtmlRef.current = htmlWithDefaultImageWidth
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
      customAlert: (info, type) => {
        if (type === 'error') {
          void message.error(info)
        } else if (type === 'warning') {
          void message.warning(info)
        } else {
          void message.info(info)
        }
      },
      MENU_CONF: {
        insertImage: {
          checkImage: checkNetworkImageUrl,
          parseImageSrc: normalizeNetworkImageUrl,
          onInsertedImage() {
            const currentEditor = editorRef.current
            if (currentEditor) {
              emitChange(currentEditor.getHtml())
            }
          },
        },
        editImage: {
          checkImage: checkNetworkImageUrl,
          parseImageSrc: normalizeNetworkImageUrl,
          onUpdatedImage() {
            const currentEditor = editorRef.current
            if (currentEditor) {
              emitChange(currentEditor.getHtml())
            }
          },
        },
        uploadImage: {
          allowedFileTypes: ['image/*'],
          maxFileSize: MAX_RICH_TEXT_IMAGE_SIZE,
          async customUpload(file: File) {
            const currentEditor = editorRef.current

            try {
              if (!file.type.startsWith('image/')) {
                throw new Error('只能上传图片文件')
              }

              if (file.size > MAX_RICH_TEXT_IMAGE_SIZE) {
                throw new Error('图片大小不能超过 5MB')
              }

              const uploaded = await uploadAsset(file, props.collectionName || 'runtime', props.fieldKey || 'richtext')
              if (uploaded.contentType && !uploaded.contentType.startsWith('image/')) {
                throw new Error('只能上传图片文件')
              }

              const displayUrl = await resolveAssetUrl(uploaded)
              const imageHtml = buildRichTextImageHtml(uploaded, displayUrl)

              currentEditor?.dangerouslyInsertHtml(imageHtml)
              if (currentEditor) {
                emitChange(currentEditor.getHtml())
              }
            } catch (error) {
              const message = error instanceof Error ? error.message : '图片上传失败'
              currentEditor?.alert(message, 'error')
              throw error
            }
          },
        },
      },
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
    [disabled, onChange, props.collectionName, props.fieldKey],
  )

  useEffect(() => {
    const nextValue = serializeRichTextHtmlForStorage(value)
    const nextDisplayValue = sanitizeRichTextHtml(resolvedValue)
    const nextDisplayStorageValue = serializeRichTextHtmlForStorage(nextDisplayValue)
    const displayMatchesCurrentValue = nextDisplayStorageValue === nextValue
    const editor = editorRef.current

    if (
      editor &&
      displayMatchesCurrentValue &&
        (nextValue !== lastEmittedHtmlRef.current ||
        (nextDisplayValue !== lastAppliedDisplayHtmlRef.current &&
          serializeRichTextHtmlForStorage(editor.getHtml()) === nextValue))
    ) {
      editor.setHtml(nextDisplayValue)
      lastEmittedHtmlRef.current = nextValue
      lastAppliedDisplayHtmlRef.current = nextDisplayValue
    }
  }, [value, resolvedValue])

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
    const container = containerRef.current
    if (!container) return

    injectImageModalHelp(container)

    const observer = new MutationObserver(() => {
      injectImageModalHelp(container)
    })
    observer.observe(container, {
      childList: true,
      subtree: true,
    })

    return () => {
      observer.disconnect()
    }
  }, [])

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
        defaultHtml={sanitizeRichTextHtml(resolvedValue)}
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
