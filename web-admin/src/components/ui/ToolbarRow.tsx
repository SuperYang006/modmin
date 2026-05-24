import type { ReactNode } from 'react'

interface ToolbarRowProps {
  /** 左侧内容，常用于搜索、筛选 */
  left?: ReactNode
  /** 右侧内容，常用于操作按钮 */
  right?: ReactNode
  /** 任一区域为空时仍占位，确保布局稳定 */
  children?: ReactNode
  className?: string
}

export function ToolbarRow({ left, right, children, className }: ToolbarRowProps) {
  return (
    <div className={['modmin-toolbar-row', className].filter(Boolean).join(' ')}>
      <div className="modmin-toolbar-row__left">{left ?? children}</div>
      {right ? <div className="modmin-toolbar-row__right">{right}</div> : null}
    </div>
  )
}
