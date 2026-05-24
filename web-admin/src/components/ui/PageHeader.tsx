import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: ReactNode
  description?: ReactNode
  extra?: ReactNode
  className?: string
}

export function PageHeader({ title, description, extra, className }: PageHeaderProps) {
  return (
    <header className={['modmin-page-header', className].filter(Boolean).join(' ')}>
      <div className="modmin-page-header__main">
        <h1 className="modmin-page-header__title">{title}</h1>
        {description ? (
          <div className="modmin-page-header__description">{description}</div>
        ) : null}
      </div>
      {extra ? <div className="modmin-page-header__extra">{extra}</div> : null}
    </header>
  )
}
