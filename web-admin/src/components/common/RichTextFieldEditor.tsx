import { useEffect, useMemo, useState } from 'react'
import { Button, Drawer, Empty, Space } from 'antd'
import { EditOutlined } from '@ant-design/icons'
import { RichTextEditor } from '@/components/common/RichTextEditor'
import { flushRichTextEditors } from '@/runtime/richtext/editorState'
import { getRichTextPlainText, hasRichTextContent } from '@/runtime/richtext/html'

interface RichTextFieldEditorProps {
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

export function RichTextFieldEditor(props: RichTextFieldEditorProps) {
  const value = typeof props.value === 'string' ? props.value : ''
  const [open, setOpen] = useState(false)
  const [draftValue, setDraftValue] = useState(value)
  const plainText = useMemo(() => getRichTextPlainText(value), [value])
  const hasContent = hasRichTextContent(value)

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
    const flushedValues = flushRichTextEditors()
    const nextValue = props.fieldKey ? (flushedValues[props.fieldKey] ?? draftValue) : draftValue
    props.onChange(nextValue)
    setOpen(false)
  }

  return (
    <>
      <div className={`runtime-richtext-field${props.disabled ? ' is-disabled' : ''}`}>
        <div className="runtime-richtext-field-preview">
          {hasContent ? (
            <span>{plainText ? truncateText(plainText) : '[图片内容]'}</span>
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无富文本内容" />
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
        className="runtime-richtext-drawer"
        onClose={closeEditor}
        extra={
          <Space>
            <Button onClick={closeEditor}>取消</Button>
            <Button type="primary" onClick={confirmEditor}>确定</Button>
          </Space>
        }
      >
        <RichTextEditor
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
