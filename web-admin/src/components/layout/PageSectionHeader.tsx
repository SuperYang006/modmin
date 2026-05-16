import type { ReactNode } from 'react'

interface PageSectionHeaderProps {
  title?: string
  description?: string
  actions?: ReactNode
}

export function PageSectionHeader({ title, description, actions }: PageSectionHeaderProps) {
  if (!title && !description && !actions) {
    return null
  }
  return (
    <div className="page-section-header">
      <div className="page-section-header-main">
        {title ? <h1>{title}</h1> : null}
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="page-section-header-actions">{actions}</div> : null}
    </div>
  )
}
