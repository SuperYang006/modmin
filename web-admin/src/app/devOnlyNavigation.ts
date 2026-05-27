import { CloudUploadOutlined } from '@ant-design/icons'
import type { BreadcrumbItem, StaticNavTreeItem } from '@/app/navigation'

export const devNavTree: StaticNavTreeItem[] = [
  {
    key: 'dev-tools',
    label: '开发工具',
    icon: CloudUploadOutlined,
    children: [
      {
        key: 'dev-deploy',
        label: '本地部署工具',
        to: '/dev/deploy',
        icon: CloudUploadOutlined,
      },
    ],
  },
]

export function resolveDevBreadcrumbs(pathname: string): BreadcrumbItem[] | null {
  if (pathname === '/dev/deploy') {
    return [{ label: '开发工具' }, { label: '本地部署工具' }]
  }
  return null
}
