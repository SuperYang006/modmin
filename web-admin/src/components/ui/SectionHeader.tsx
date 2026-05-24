import type { ReactNode } from 'react'

interface SectionHeaderProps {
  title: ReactNode
  description?: ReactNode
  extra?: ReactNode
  className?: string
}

export function SectionHeader({ title, description, extra, className }: SectionHeaderProps) {
  return (
    <div className={['modmin-section-header', className].filter(Boolean).join(' ')}>
      <div className="modmin-section-header__main">
        <h2 className="modmin-section-header__title">{title}</h2>
        {description ? (
          <div className="modmin-section-header__description">{description}</div>
        ) : null}
      </div>
      {extra ? <div className="modmin-section-header__extra">{extra}</div> : null}
    </div>
  )
}
