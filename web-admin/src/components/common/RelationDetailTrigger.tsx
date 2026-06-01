import { useState } from 'react'
import { Button, Card, Modal, Space } from 'antd'

interface RelationDetailRecord {
  id: string
  label?: string
  record?: Record<string, unknown> | null
  displayFields: string[]
}

interface RelationDetailTriggerProps {
  title: string
  records: RelationDetailRecord[]
}

function formatRelationValue(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return ''
  }

  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      return '[object]'
    }
  }

  return String(value)
}

export function RelationDetailTrigger(props: RelationDetailTriggerProps) {
  const [open, setOpen] = useState(false)
  const { title, records } = props

  if (!records.length) {
    return null
  }

  const isMany = records.length > 1

  return (
    <>
      <Button type="link" size="small" onClick={() => setOpen(true)}>
        详情
      </Button>
      <Modal
        open={open}
        title={title}
        footer={null}
        onCancel={() => setOpen(false)}
        destroyOnHidden
        centered
        width={isMany ? 680 : 640}
        styles={{ body: { maxHeight: '70vh', overflow: 'auto' } }}
      >
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          {records.map((item, index) => {
            const keys = Array.from(new Set(item.displayFields.filter(Boolean)))
            return (
              <Card
                key={`${item.id || item.label || 'record'}-${index}`}
                size="small"
                className="runtime-relation-detail-card"
                title={<span className="runtime-relation-detail-card-title">{isMany ? `${index + 1}. ${item.id || item.label}` : item.id}</span>}
              >
                {item.record ? (
                  <div className="runtime-relation-detail-grid runtime-relation-detail-grid-card">
                    {keys.map((key) => (
                      <div key={key} className="runtime-relation-detail-item">
                        <span>{key}</span>
                        <strong>{formatRelationValue(item.record?.[key]) || '-'}</strong>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="runtime-relation-detail-empty">关联记录详情加载中或暂不可用</div>
                )}
              </Card>
            )
          })}
        </Space>
      </Modal>
    </>
  )
}
