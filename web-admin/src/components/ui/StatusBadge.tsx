import type { ReactNode } from 'react'

export type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'error' | 'processing'

interface StatusBadgeProps {
  tone?: StatusTone
  children: ReactNode
  className?: string
}

export function StatusBadge({ tone = 'neutral', children, className }: StatusBadgeProps) {
  const cls = [
    'modmin-status-badge',
    `modmin-status-badge--${tone}`,
    className,
  ]
    .filter(Boolean)
    .join(' ')
  return <span className={cls}>{children}</span>
}
