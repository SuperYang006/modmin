import type { CSSProperties, ReactNode } from 'react'

interface PanelCardProps {
  children: ReactNode
  title?: ReactNode
  extra?: ReactNode
  /** 是否使用更紧凑的 padding；默认 false 走标准间距。 */
  compact?: boolean
  /** 关闭内边距，由消费者完全控制（如表格场景） */
  noPadding?: boolean
  className?: string
  style?: CSSProperties
}

export function PanelCard({
  children,
  title,
  extra,
  compact,
  noPadding,
  className,
  style,
}: PanelCardProps) {
  const cls = [
    'modmin-panel-card',
    compact ? 'modmin-panel-card--compact' : '',
    noPadding ? 'modmin-panel-card--no-padding' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <section className={cls} style={style}>
      {title || extra ? (
        <header className="modmin-panel-card__header">
          {title ? <div className="modmin-panel-card__title">{title}</div> : <span />}
          {extra ? <div className="modmin-panel-card__extra">{extra}</div> : null}
        </header>
      ) : null}
      <div className="modmin-panel-card__body">{children}</div>
    </section>
  )
}
