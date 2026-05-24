import type { ReactNode } from 'react'

interface DrawerFooterBarProps {
  /** 左侧次要操作，如「重置」 */
  secondary?: ReactNode
  /** 右侧主操作组，如「取消 + 保存」 */
  primary: ReactNode
  className?: string
}

export function DrawerFooterBar({ secondary, primary, className }: DrawerFooterBarProps) {
  return (
    <div className={['modmin-drawer-footer-bar', className].filter(Boolean).join(' ')}>
      <div className="modmin-drawer-footer-bar__secondary">{secondary}</div>
      <div className="modmin-drawer-footer-bar__primary">{primary}</div>
    </div>
  )
}
