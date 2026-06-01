import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Menu } from 'antd'
import {
  AppstoreOutlined,
  DashboardOutlined,
  DownOutlined,
  ExportOutlined,
  FolderOpenOutlined,
  HistoryOutlined,
  ImportOutlined,
  RightOutlined,
  SettingOutlined,
  SwapOutlined,
} from '@ant-design/icons'
import { devNavTree } from '@/app/devOnlyNavigation'
import { configNavTree, getGeneratedPagePath } from '@/app/navigation'
import type { SidebarMenuNode } from '@/app/navigation'
import { getModelIconComponent } from '@/components/common/modelIcons'
import { usePermission } from '@/context/PermissionContext'
import type { CollectionSchemaSummary, MenuGroupItem } from '@/types/schema'

interface SidebarNavigationProps {
  collections: CollectionSchemaSummary[]
  menuGroups: MenuGroupItem[]
}

const UNGROUPED_KEY = 'ungrouped'

export function SidebarNavigation({ collections, menuGroups }: SidebarNavigationProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { isSuperAdmin, permMap } = usePermission()
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({
    system: true,
  })

  // 只展示有 canList 权限的集合
  const visibleCollections = useMemo(
    () => isSuperAdmin ? collections : collections.filter((c) => permMap[c.collectionName]?.canList === true),
    [collections, isSuperAdmin, permMap],
  )
  const canAccessImportExport = isSuperAdmin || collections.some((item) => {
    const permission = permMap[item.collectionName]
    return Boolean(permission?.canList || permission?.canCreate || permission?.canUpdate)
  }) || Object.values(permMap).some((permission) => Boolean(permission.canList || permission.canCreate || permission.canUpdate))
  const canAccessDataExport = isSuperAdmin || collections.some((item) => Boolean(permMap[item.collectionName]?.canList)) || Object.values(permMap).some((permission) => Boolean(permission.canList))
  const canAccessDataImport = isSuperAdmin || collections.some((item) => Boolean(permMap[item.collectionName]?.canCreate || permMap[item.collectionName]?.canUpdate)) || Object.values(permMap).some((permission) => Boolean(permission.canCreate || permission.canUpdate))

  const configMenuTree: SidebarMenuNode[] = useMemo(
    () =>
      [...configNavTree, ...devNavTree].map((group) => ({
        key: `config_group_${group.key}`,
        label: group.label,
        icon: group.icon,
        children: group.children.map((item) => ({
          key: item.key,
          label: item.label,
          to: item.to,
          icon: item.icon,
        })),
      })),
    [],
  )

  const businessMenuTree: SidebarMenuNode[] = useMemo(() => {
    if (visibleCollections.length === 0) {
      return []
    }

    const enabledGroups = menuGroups
      .filter((group) => group.status === 'enabled')
      .slice()
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    const sortedCollections = visibleCollections
      .slice()
      .sort((a, b) => {
        const aSort = typeof a.sortOrder === 'number' ? a.sortOrder : Number.MAX_SAFE_INTEGER
        const bSort = typeof b.sortOrder === 'number' ? b.sortOrder : Number.MAX_SAFE_INTEGER
        return aSort - bSort
      })

    const byGroup = new Map<string, CollectionSchemaSummary[]>()
    sortedCollections.forEach((collection) => {
      const key = collection.menuGroupId || UNGROUPED_KEY
      const list = byGroup.get(key) ?? []
      list.push(collection)
      byGroup.set(key, list)
    })

    const toLeaf = (collection: CollectionSchemaSummary): SidebarMenuNode => ({
      key: `business_model_${collection.collectionName}`,
      label: collection.modelName || collection.collectionName,
      to: getGeneratedPagePath(collection.pageCode),
      icon: getModelIconComponent(collection.icon),
    })

    const groupNodes: SidebarMenuNode[] = enabledGroups
      .map((group) => {
        const children = (byGroup.get(group.groupId) || []).map(toLeaf)
        return {
          key: `menu_group_${group.groupId}`,
          label: group.title,
          icon: group.icon ? getModelIconComponent(group.icon) : undefined,
          children: children.length > 0 ? children : [{ key: `menu_group_${group.groupId}_empty`, label: '当前分组无业务数据', disabled: true }],
        }
      })

    const ungrouped = byGroup.get(UNGROUPED_KEY) || []

    return [...groupNodes, ...ungrouped.map(toLeaf)]
  }, [visibleCollections, menuGroups])

  useEffect(() => {
    setOpenMenus((prev) => {
      const next = { ...prev }

      if (location.pathname.startsWith('/config')) {
        next.system = true
        const activeConfigGroup = configMenuTree.find((group) =>
          hasActiveDescendant(group, location.pathname),
        )
        if (activeConfigGroup) {
          next[activeConfigGroup.key] = true
        }
      }

      const activeGroup = businessMenuTree.find((group) => hasActiveDescendant(group, location.pathname))
      if (activeGroup) {
        next[activeGroup.key] = true
      }

      return next
    })
  }, [location.pathname, configMenuTree, businessMenuTree])

  function hasActiveDescendant(node: SidebarMenuNode, pathname: string): boolean {
    if (node.to === pathname) {
      return true
    }

    return node.children?.some((child) => hasActiveDescendant(child, pathname)) ?? false
  }

  function renderMenuNodes(nodes: SidebarMenuNode[]): Array<Record<string, unknown>> {
    return nodes.map((node) => {
      const NodeIcon = node.icon
      if (node.children?.length) {
        return {
          key: node.key,
          label: node.label,
          icon: NodeIcon ? <NodeIcon /> : <FolderOpenOutlined />,
          children: renderMenuNodes(node.children),
        }
      }

      return {
        key: node.to || node.key,
        label: node.label,
        icon: NodeIcon ? <NodeIcon /> : undefined,
      }
    })
  }

  const menuItems = useMemo(
    () => [
      ...(isSuperAdmin
        ? [
            {
              key: '/dashboard',
              icon: <DashboardOutlined />,
              label: '控制台',
            },
            {
              key: 'system',
              icon: <SettingOutlined />,
              label: '系统配置',
              children: configMenuTree.map((group) => ({
                key: group.key,
                icon: group.icon ? <group.icon /> : <AppstoreOutlined />,
                label: group.label,
                children: renderMenuNodes(group.children || []),
              })),
            },
          ]
        : canAccessImportExport
          ? [
              {
                key: 'system',
                icon: <SettingOutlined />,
                label: '系统配置',
                children: [
                  {
                    key: 'config_group_import_export',
                    icon: <SwapOutlined />,
                    label: '数据导入导出',
                    children: [
                      ...(canAccessDataExport
                        ? [
                            {
                              key: '/config/data-export',
                              icon: <ExportOutlined />,
                              label: '数据导出',
                            },
                          ]
                        : []),
                      ...(canAccessDataImport
                        ? [
                            {
                              key: '/config/data-import',
                              icon: <ImportOutlined />,
                              label: '数据导入',
                            },
                          ]
                        : []),
                      {
                        key: '/config/import-export-history',
                        icon: <HistoryOutlined />,
                        label: '任务记录',
                      },
                    ],
                  },
                ],
              },
            ]
          : []),
      ...(businessMenuTree.length > 0
        ? businessMenuTree.map((node) => {
            const NodeIcon = node.icon
            if (node.children) {
              return {
                key: node.key,
                icon: NodeIcon ? <NodeIcon /> : <FolderOpenOutlined />,
                label: node.label,
                children: renderMenuNodes(node.children),
              }
            }
            return {
              key: node.to || node.key,
              icon: NodeIcon ? <NodeIcon /> : undefined,
              label: node.label,
            }
          })
        : []),
    ],
    [canAccessDataExport, canAccessDataImport, canAccessImportExport, configMenuTree, businessMenuTree, isSuperAdmin],
  )

  const selectedKeys = [location.pathname]
  const openKeys = Object.entries(openMenus)
    .filter(([, value]) => value)
    .map(([key]) => key)

  return (
    <Menu
      mode="inline"
      theme="dark"
      className="app-side-menu"
      items={menuItems}
      selectedKeys={selectedKeys}
      openKeys={openKeys}
      onOpenChange={(keys) => {
        const nextState = keys.reduce<Record<string, boolean>>((acc, key) => {
          acc[String(key)] = true
          return acc
        }, {})
        setOpenMenus(nextState)
      }}
      expandIcon={({ isOpen }) =>
        isOpen
          ? <DownOutlined style={{ fontSize: 11, transition: 'none' }} />
          : <RightOutlined style={{ fontSize: 11, transition: 'none' }} />
      }
      onClick={({ key }) => {
        if (typeof key === 'string' && key.startsWith('/')) {
          navigate(key)
        }
      }}
    />
  )
}
