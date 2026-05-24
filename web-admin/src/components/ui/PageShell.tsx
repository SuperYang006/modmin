import type { CSSProperties, ReactNode } from 'react'

interface PageShellProps {
  children: ReactNode
  className?: string
  style?: CSSProperties
}

export function PageShell({ children, className, style }: PageShellProps) {
  return (
    <div className={['modmin-page-shell', className].filter(Boolean).join(' ')} style={style}>
      {children}
    </div>
  )
}
