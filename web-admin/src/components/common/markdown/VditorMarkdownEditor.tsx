import { useEffect, useRef, useState } from 'react'
import { message } from 'antd'
import Vditor from 'vditor'
import 'vditor/dist/index.css'
import { uploadMarkdownImage } from './vditorAssetUpload'
import { createVditorOptions } from './vditorConfig'

const TOOLBAR_LABELS: Record<string, string> = {
  headings: '标题',
  bold: '加粗',
  italic: '斜体',
  strike: '删除线',
  quote: '引用',
  line: '分割线',
  list: '无序列表',
  'ordered-list': '有序列表',
  check: '任务列表',
  outdent: '减少缩进',
  indent: '增加缩进',
  code: '代码块',
  'inline-code': '行内代码',
  table: '表格',
  link: '链接',
  upload: '上传图片',
  undo: '撤销',
  redo: '重做',
  preview: '切换预览',
  fullscreen: '切换全屏',
  outline: '大纲目录',
}

interface VditorMarkdownEditorProps {
  value?: string
  disabled?: boolean
  active?: boolean
  collectionName?: string
  fieldKey?: string
  onChange: (value: string) => void
}

export function VditorMarkdownEditor(props: VditorMarkdownEditorProps) {
  const { active = true, value = '', disabled, collectionName, fieldKey, onChange } = props
  const containerRef = useRef<HTMLDivElement>(null)
  const vditorRef = useRef<Vditor | null>(null)
  const [vditorReady, setVditorReady] = useState(false)
  const [toolbarTooltip, setToolbarTooltip] = useState<{ label: string; left: number; top: number } | null>(null)
  const [editorMetrics, setEditorMetrics] = useState({ lines: 0, length: 0 })
  const lastAppliedValueRef = useRef(value)
  const onChangeRef = useRef(onChange)
  const collectionNameRef = useRef(collectionName)
  const fieldKeyRef = useRef(fieldKey)

  onChangeRef.current = onChange
  collectionNameRef.current = collectionName
  fieldKeyRef.current = fieldKey

  useEffect(() => {
    const text = value || ''
    setEditorMetrics({
      lines: text ? text.split('\n').length : 0,
      length: text.length,
    })
  }, [value])

  useEffect(() => {
    if (!containerRef.current || !active) return

    setVditorReady(false)

    const { destroy, vditor } = createVditor(containerRef.current, {
      value,
      disabled,
      collectionName: collectionNameRef.current,
      fieldKey: fieldKeyRef.current,
      onChange: (v) => {
        setEditorMetrics({
          lines: v ? v.split('\n').length : 0,
          length: v.length,
        })
        onChangeRef.current(v)
      },
      ready: () => {
        lastAppliedValueRef.current = value
        setVditorReady(true)
      },
    })
    vditorRef.current = vditor

    return () => {
      destroy()
      vditorRef.current = null
      setVditorReady(false)
      setToolbarTooltip(null)
    }
  }, [active])

  // Sync external value changes without reading getValue() before Vditor internals are ready.
  useEffect(() => {
    if (!vditorReady) return
    const vditor = vditorRef.current
    if (!vditor) return
    if (value === lastAppliedValueRef.current) return
    vditor.setValue(value || '')
    lastAppliedValueRef.current = value
  }, [value, vditorReady])

  // Sync disabled state
  useEffect(() => {
    if (!vditorReady) return
    const vditor = vditorRef.current
    if (!vditor) return
    if (disabled) {
      vditor.disabled()
    } else {
      vditor.enable()
    }
  }, [disabled, vditorReady])

  useEffect(() => {
    if (!vditorReady || !containerRef.current) return

    const container = containerRef.current
    const targets = Array.from(container.querySelectorAll<HTMLElement>('.vditor-toolbar button[aria-label], .vditor-toolbar input[type="file"]'))
    const cleanups = targets.map((target) => {
      const showTooltip = () => {
        const host = target.matches('input[type="file"]')
          ? target.closest<HTMLElement>('.vditor-tooltipped')
          : target
        const type = host?.getAttribute('data-type') || ''
        const label = TOOLBAR_LABELS[type] || host?.getAttribute('aria-label')
        if (!label || !containerRef.current) return

        const buttonRect = (host || target).getBoundingClientRect()
        const containerRect = containerRef.current.getBoundingClientRect()
        setToolbarTooltip({
          label,
          left: buttonRect.left - containerRect.left + buttonRect.width / 2,
          top: buttonRect.top - containerRect.top,
        })
      }

      const hideTooltip = () => {
        const host = target.matches('input[type="file"]')
          ? target.closest<HTMLElement>('.vditor-tooltipped')
          : target
        const type = host?.getAttribute('data-type') || ''
        const label = TOOLBAR_LABELS[type] || host?.getAttribute('aria-label') || ''
        setToolbarTooltip((current) => (current?.label === label ? null : current))
      }

      target.addEventListener('mouseenter', showTooltip)
      target.addEventListener('focus', showTooltip)
      target.addEventListener('mouseleave', hideTooltip)
      target.addEventListener('blur', hideTooltip)

      return () => {
        target.removeEventListener('mouseenter', showTooltip)
        target.removeEventListener('focus', showTooltip)
        target.removeEventListener('mouseleave', hideTooltip)
        target.removeEventListener('blur', hideTooltip)
      }
    })

    return () => {
      cleanups.forEach((cleanup) => cleanup())
      setToolbarTooltip(null)
    }
  }, [vditorReady])

  return (
    <div className={`runtime-vditor-shell${disabled ? ' is-disabled' : ''}`}>
      <div ref={containerRef} className="runtime-vditor-container">
        {toolbarTooltip ? (
          <div
            className="runtime-vditor-tooltip"
            style={{
              left: `${toolbarTooltip.left}px`,
              top: `${toolbarTooltip.top}px`,
            }}
          >
            {toolbarTooltip.label}
          </div>
        ) : null}
      </div>
      <div className="runtime-vditor-statusbar">
        <span>{vditorReady ? 'Markdown 编辑器已就绪' : '正在初始化编辑器...'}</span>
        <span>{editorMetrics.lines} 行</span>
        <span>{editorMetrics.length} 字符</span>
      </div>
    </div>
  )
}

function createVditor(
  element: HTMLDivElement,
  opts: {
    value: string
    disabled?: boolean
    collectionName?: string
    fieldKey?: string
    onChange: (value: string) => void
    ready: () => void
  },
) {
  const vditor = new Vditor(element, {
    ...createVditorOptions({
      value: opts.value,
      uploadHandler: async (files) => {
        for (const file of files) {
          try {
            const mdTag = await uploadMarkdownImage(
              file,
              opts.collectionName || 'runtime',
              opts.fieldKey || 'markdown',
            )
            vditor.insertValue(mdTag)
          } catch (err) {
            message.error(err instanceof Error ? err.message : '图片上传失败')
            return err instanceof Error ? err.message : '图片上传失败'
          }
        }
        return null
      },
      input: opts.onChange,
      after: () => {
        opts.ready()
        if (opts.disabled) {
          vditor.disabled()
        }
      },
    }),
  })

  return {
    vditor,
    destroy: () => {
      try {
        vditor.destroy()
      } catch {
        // ignore destroy errors
      }
    },
  }
}
