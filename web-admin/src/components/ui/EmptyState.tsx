import type { ReactNode } from 'react'

interface EmptyStateProps {
  title?: ReactNode
  description?: ReactNode
  icon?: ReactNode
  action?: ReactNode
  /** 紧凑模式用于表格内空态 */
  compact?: boolean
  className?: string
}

export function EmptyState({
  title = '暂无数据',
  description,
  icon,
  action,
  compact,
  className,
}: EmptyStateProps) {
  const cls = [
    'modmin-empty-state',
    compact ? 'modmin-empty-state--compact' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <div className={cls}>
      {icon ? <div className="modmin-empty-state__icon">{icon}</div> : null}
      <div className="modmin-empty-state__title">{title}</div>
      {description ? (
        <div className="modmin-empty-state__description">{description}</div>
      ) : null}
      {action ? <div className="modmin-empty-state__action">{action}</div> : null}
    </div>
  )
}
