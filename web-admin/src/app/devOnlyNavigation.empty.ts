import type { BreadcrumbItem, StaticNavTreeItem } from '@/app/navigation'

export const devNavTree: StaticNavTreeItem[] = []

export function resolveDevBreadcrumbs(_pathname: string): BreadcrumbItem[] | null {
  return null
}
