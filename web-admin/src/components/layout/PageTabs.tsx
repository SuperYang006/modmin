import { useEffect, useMemo, useRef, useState } from 'react'
import { Dropdown } from 'antd'
import { CloseOutlined } from '@ant-design/icons'
import { useLocation, useNavigate } from 'react-router-dom'
import { getGeneratedPagePath, resolveBreadcrumbs } from '@/app/navigation'
import { usePermission } from '@/context/PermissionContext'

const STORAGE_KEY = 'cms.pageTabs.v1'
const NO_ACCESS_PATH = '/no-access'

interface PageTab {
  key: string
  path: string
  label: string
  closable: boolean
}

interface PageTabsProps {
  collectionEntries: Array<{ collectionName: string; pageCode: string; label: string }>
}

function loadStoredTabs(): PageTab[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (item): item is PageTab =>
        item && typeof item.key === 'string' && typeof item.path === 'string' && typeof item.label === 'string',
    )
  } catch {
    return []
  }
}

function persistTabs(tabs: PageTab[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tabs))
  } catch {
    // ignore storage failures
  }
}

function buildLabel(pathname: string, collectionEntries: PageTabsProps['collectionEntries']) {
  const breadcrumbs = resolveBreadcrumbs(pathname, collectionEntries)
  return breadcrumbs.length > 0 ? breadcrumbs[breadcrumbs.length - 1].label : '页面'
}

function isConfigPath(path: string) {
  return path === '/config/models' || path.startsWith('/config/')
}

function isGeneratedPath(path: string) {
  return path.startsWith('/generated/')
}

function getCollectionNameFromPath(path: string, collectionEntries: PageTabsProps['collectionEntries']) {
  const pageCode = path.replace('/generated/', '').split('?')[0]
  return collectionEntries.find((e) => e.pageCode === pageCode)?.collectionName ?? ''
}

export function PageTabs({ collectionEntries }: PageTabsProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { isSuperAdmin, permMap } = usePermission()
  const [tabs, setTabs] = useState<PageTab[]>(() => loadStoredTabs())
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const activeTabRef = useRef<HTMLDivElement | null>(null)

  const currentPath = location.pathname + location.search

  // 判断某个 path 对当前用户是否可访问
  function isAccessible(path: string) {
    if (isConfigPath(path)) return isSuperAdmin
    if (isGeneratedPath(path)) {
      const collectionName = getCollectionNameFromPath(path, collectionEntries)
      return isSuperAdmin || permMap[collectionName]?.canList === true
    }
    return true
  }

  // 当前用户的落地页
  const landingPath = useMemo(() => {
    if (isSuperAdmin) return '/config/models'
    const first = collectionEntries.find((e) => permMap[e.collectionName]?.canList === true)
    return first ? getGeneratedPagePath(first.pageCode) : NO_ACCESS_PATH
  }, [isSuperAdmin, permMap, collectionEntries])

  // 过滤掉当前用户无权访问的历史标签
  useEffect(() => {
    if (!isSuperAdmin && Object.keys(permMap).length === 0) return // 权限未加载完毕，先等
    setTabs((prev) => prev.filter((tab) => isAccessible(tab.path)))
  }, [isSuperAdmin, permMap, collectionEntries])

  useEffect(() => {
    if (location.pathname === '/login' || !isAccessible(location.pathname)) return
    const label = buildLabel(location.pathname, collectionEntries)
    setTabs((prev) => {
      const existing = prev.find((tab) => tab.key === currentPath)
      if (existing) {
        const isLanding = currentPath === landingPath
        if (existing.label !== label || existing.closable === isLanding) {
          return prev.map((tab) =>
            tab.key === currentPath ? { ...tab, label, closable: !isLanding } : tab,
          )
        }
        return prev
      }
      const isLanding = currentPath === landingPath
      return [...prev, { key: currentPath, path: currentPath, label, closable: !isLanding }]
    })
  }, [currentPath, collectionEntries, location.pathname, landingPath])

  useEffect(() => {
    persistTabs(tabs)
  }, [tabs])

  useEffect(() => {
    if (!activeTabRef.current || !scrollerRef.current) return
    const tab = activeTabRef.current
    const scroller = scrollerRef.current
    const tabRect = tab.getBoundingClientRect()
    const scrollerRect = scroller.getBoundingClientRect()
    if (tabRect.left < scrollerRect.left) {
      scroller.scrollBy({ left: tabRect.left - scrollerRect.left - 16, behavior: 'smooth' })
    } else if (tabRect.right > scrollerRect.right) {
      scroller.scrollBy({ left: tabRect.right - scrollerRect.right + 16, behavior: 'smooth' })
    }
  }, [currentPath, tabs.length])

  function activateTab(targetKey: string) {
    if (targetKey === currentPath) return
    navigate(targetKey)
  }

  function closeTab(targetKey: string) {
    setTabs((prev) => {
      const targetIndex = prev.findIndex((tab) => tab.key === targetKey)
      if (targetIndex < 0) return prev
      const next = prev.filter((tab) => tab.key !== targetKey)
      if (targetKey === currentPath) {
        const fallback = next[targetIndex] || next[targetIndex - 1] || next[next.length - 1]
        navigate(fallback ? fallback.path : landingPath)
      }
      return next
    })
  }

  function closeOthers(targetKey: string) {
    setTabs((prev) => prev.filter((tab) => tab.key === targetKey || !tab.closable))
    if (targetKey !== currentPath) navigate(targetKey)
  }

  function closeAll() {
    setTabs((prev) => prev.filter((tab) => !tab.closable))
    navigate(landingPath)
  }

  function onScrollWheel(event: React.WheelEvent<HTMLDivElement>) {
    if (event.deltaY === 0) return
    event.currentTarget.scrollLeft += event.deltaY
  }

  const closableCount = useMemo(() => tabs.filter((tab) => tab.closable).length, [tabs])

  if (tabs.length === 0) return null

  return (
    <div className="app-page-tabs">
      <div className="app-page-tabs-scroller" ref={scrollerRef} onWheel={onScrollWheel}>
        {tabs.map((tab) => {
          const isActive = tab.key === currentPath
          const menuItems = [
            {
              key: 'closeOthers',
              label: '关闭其它',
              disabled: tabs.filter((item) => item.closable && item.key !== tab.key).length === 0,
            },
            { key: 'closeAll', label: '关闭全部', danger: true, disabled: closableCount === 0 },
          ]
          return (
            <Dropdown
              key={tab.key}
              menu={{
                items: menuItems,
                onClick: ({ key, domEvent }) => {
                  domEvent.stopPropagation()
                  if (key === 'closeOthers') closeOthers(tab.key)
                  else if (key === 'closeAll') closeAll()
                },
              }}
              trigger={['contextMenu']}
            >
              <div
                ref={isActive ? activeTabRef : undefined}
                className={`app-page-tab${isActive ? ' app-page-tab-active' : ''}`}
                onClick={() => activateTab(tab.key)}
                onMouseDown={(event) => {
                  if (event.button === 1 && tab.closable) {
                    event.preventDefault()
                    closeTab(tab.key)
                  }
                }}
                role="tab"
                aria-selected={isActive}
              >
                <span className="app-page-tab-label" title={tab.label}>{tab.label}</span>
                {tab.closable ? (
                  <button
                    type="button"
                    className="app-page-tab-close"
                    aria-label={`关闭 ${tab.label}`}
                    onClick={(event) => { event.stopPropagation(); closeTab(tab.key) }}
                  >
                    <CloseOutlined />
                  </button>
                ) : null}
              </div>
            </Dropdown>
          )
        })}
      </div>
    </div>
  )
}
