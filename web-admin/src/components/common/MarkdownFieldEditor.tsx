import { useEffect, useMemo, useState } from 'react'
import { Button, Drawer, Empty, Space } from 'antd'
import { EditOutlined } from '@ant-design/icons'
import { MarkdownEditor } from '@/components/common/MarkdownEditor'
import { getRichTextPlainText } from '@/runtime/richtext/html'

interface MarkdownFieldEditorProps {
  value?: string
  disabled?: boolean
  collectionName?: string
  fieldKey?: string
  fieldLabel: string
  onChange: (value: string) => void
}

function truncateText(value: string, maxLength = 180) {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value
}

function getMarkdownPlainText(md: string) {
  return getRichTextPlainText(md)
}

function hasMarkdownContent(value: string) {
  return value.trim().length > 0
}

export function MarkdownFieldEditor(props: MarkdownFieldEditorProps) {
  const value = typeof props.value === 'string' ? props.value : ''
  const [open, setOpen] = useState(false)
  const [draftValue, setDraftValue] = useState(value)
  const plainText = useMemo(() => getMarkdownPlainText(value), [value])
  const hasContent = hasMarkdownContent(value)

  useEffect(() => {
    if (!open) {
      setDraftValue(value)
    }
  }, [open, value])

  function openEditor() {
    setDraftValue(value)
    setOpen(true)
  }

  function closeEditor() {
    setDraftValue(value)
    setOpen(false)
  }

  function confirmEditor() {
    props.onChange(draftValue)
    setOpen(false)
  }

  return (
    <>
      <div className={`runtime-markdown-field${props.disabled ? ' is-disabled' : ''}`}>
        <div className="runtime-markdown-field-preview">
          {hasContent ? (
            <span>{plainText ? truncateText(plainText) : '[图片等媒体内容]'}</span>
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无 Markdown 内容" />
          )}
        </div>
        <Button icon={<EditOutlined />} disabled={props.disabled} onClick={openEditor}>
          {hasContent ? '编辑内容' : '添加内容'}
        </Button>
      </div>

      <Drawer
        title={props.fieldLabel}
        open={open}
        width="min(960px, 92vw)"
        destroyOnHidden={false}
        className="runtime-markdown-drawer"
        onClose={closeEditor}
        extra={
          <Space>
            <Button onClick={closeEditor}>取消</Button>
            <Button type="primary" onClick={confirmEditor}>确定</Button>
          </Space>
        }
      >
        <MarkdownEditor
          value={draftValue}
          disabled={props.disabled}
          collectionName={props.collectionName}
          fieldKey={props.fieldKey}
          active={open}
          onChange={setDraftValue}
        />
      </Drawer>
    </>
  )
}
