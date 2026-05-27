import type { ComponentType } from 'react'
import {
  ApiOutlined,
  AuditOutlined,
  DatabaseOutlined,
  FolderOpenOutlined,
  PlusSquareOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  TeamOutlined,
  UserSwitchOutlined,
} from '@ant-design/icons'
import { resolveDevBreadcrumbs } from '@/app/devOnlyNavigation'

export interface StaticNavItem {
  key: string
  label: string
  to: string
  icon?: ComponentType
}

export interface StaticNavTreeItem {
  key: string
  label: string
  icon?: ComponentType
  children: StaticNavItem[]
}

export interface SidebarMenuNode {
  key: string
  label: string
  to?: string
  icon?: ComponentType
  children?: SidebarMenuNode[]
}

export interface BreadcrumbItem {
  label: string
  to?: string
}

export const configNavItems: StaticNavItem[] = [
  {
    key: 'dashboard',
    label: '控制台',
    to: '/dashboard',
  },
  {
    key: 'config-home',
    label: '数据模型管理',
    to: '/config/models',
  },
  {
    key: 'config-menu-groups',
    label: '菜单分组管理',
    to: '/config/menu-groups',
  },
]

export const configNavTree: StaticNavTreeItem[] = [
  {
    key: 'config-model-center',
    label: '模型中心',
    children: [
      {
        key: 'config-home',
        label: '模型列表',
        to: '/config/models',
        icon: DatabaseOutlined,
      },
      {
        key: 'config-model-create',
        label: '创建模型',
        to: '/config/models/create',
        icon: PlusSquareOutlined,
      },
    ],
  },
  {
    key: 'config-access-control',
    label: '账号与权限',
    icon: SettingOutlined,
    children: [
      {
        key: 'config-roles',
        label: '角色管理',
        to: '/config/roles',
        icon: SafetyCertificateOutlined,
      },
      {
        key: 'config-admin-users',
        label: '用户管理',
        to: '/config/admin-users',
        icon: UserSwitchOutlined,
      },
    ],
  },
  {
    key: 'config-system-structure',
    label: '系统结构',
    icon: FolderOpenOutlined,
    children: [
      {
        key: 'config-menu-groups',
        label: '菜单分组管理',
        to: '/config/menu-groups',
        icon: FolderOpenOutlined,
      },
    ],
  },
  {
    key: 'config-audit-integration',
    label: '审计与集成',
    icon: AuditOutlined,
    children: [
      {
        key: 'config-audit-logs',
        label: '操作日志',
        to: '/config/audit-logs',
        icon: AuditOutlined,
      },
      {
        key: 'config-webhooks',
        label: 'Webhook 配置',
        to: '/config/webhooks',
        icon: ApiOutlined,
      },
      {
        key: 'config-webhook-deliveries',
        label: 'Webhook 记录',
        to: '/config/webhook-deliveries',
        icon: AuditOutlined,
      },
    ],
  },
]

export function getGeneratedPagePath(pageCode: string) {
  return `/generated/${pageCode}`
}

export function getGeneratedCreatePath(pageCode: string) {
  return `/generated/${pageCode}/create`
}

export function getModelEditPath(collectionName: string) {
  return `/config/models/${collectionName}/edit`
}

export function resolveBreadcrumbs(
  pathname: string,
  collectionEntries: Array<{ collectionName: string; pageCode: string; label: string }>,
): BreadcrumbItem[] {
  const collectionEntry = collectionEntries.find((item) => pathname === getGeneratedPagePath(item.pageCode))
  const generatedCreateEntry = collectionEntries.find((item) => pathname === getGeneratedCreatePath(item.pageCode))
  const generatedEditEntry = collectionEntries.find((item) => {
    const prefix = `/generated/${item.pageCode}/`
    return pathname.startsWith(prefix) && pathname.endsWith('/edit')
  })

  if (pathname === '/dashboard') {
    return [{ label: '控制台' }]
  }

  if (pathname === '/config/models') {
    return [{ label: '系统配置' }, { label: '模型中心' }, { label: '模型列表' }]
  }

  if (pathname === '/config/models/create') {
    return [
      { label: '系统配置' },
      { label: '模型中心' },
      { label: '模型列表', to: '/config/models' },
      { label: '创建模型' },
    ]
  }

  if (pathname === '/config/menu-groups') {
    return [{ label: '系统配置' }, { label: '系统结构' }, { label: '菜单分组管理' }]
  }

  if (pathname === '/config/roles') {
    return [{ label: '系统配置' }, { label: '账号与权限' }, { label: '角色管理' }]
  }

  if (pathname === '/config/admin-users') {
    return [{ label: '系统配置' }, { label: '账号与权限' }, { label: '用户管理' }]
  }

  if (pathname === '/config/audit-logs') {
    return [{ label: '系统配置' }, { label: '审计与集成' }, { label: '操作日志' }]
  }

  if (pathname === '/config/webhooks') {
    return [{ label: '系统配置' }, { label: '审计与集成' }, { label: 'Webhook 配置' }]
  }

  if (pathname === '/config/webhook-deliveries') {
    return [{ label: '系统配置' }, { label: '审计与集成' }, { label: 'Webhook 记录' }]
  }

  const devBreadcrumbs = resolveDevBreadcrumbs(pathname)
  if (devBreadcrumbs) {
    return devBreadcrumbs
  }

  const editEntry = collectionEntries.find((item) => pathname === getModelEditPath(item.collectionName))
  if (editEntry) {
    return [
      { label: '系统配置' },
      { label: '模型中心' },
      { label: '模型列表', to: '/config/models' },
      { label: `编辑模型 - ${editEntry.label}` },
    ]
  }

  if (collectionEntry) {
    return [{ label: '业务模型' }, { label: '全部模型' }, { label: collectionEntry.label }]
  }

  if (generatedCreateEntry) {
    return [
      { label: '业务模型' },
      { label: '全部模型' },
      { label: generatedCreateEntry.label, to: getGeneratedPagePath(generatedCreateEntry.pageCode) },
      { label: '新增数据' },
    ]
  }

  if (generatedEditEntry) {
    return [
      { label: '业务模型' },
      { label: '全部模型' },
      { label: generatedEditEntry.label, to: getGeneratedPagePath(generatedEditEntry.pageCode) },
      { label: '编辑数据' },
    ]
  }

  if (pathname === '/no-access') {
    return [{ label: '提示' }, { label: '暂无访问权限' }]
  }

  return [{ label: '控制台' }]
}
