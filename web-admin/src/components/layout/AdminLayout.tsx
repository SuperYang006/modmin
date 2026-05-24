import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Breadcrumb, Button, Dropdown, Layout, Space, Avatar, Divider } from 'antd'
import { HomeOutlined, LogoutOutlined, RightOutlined, UserOutlined } from '@ant-design/icons'
import { getStoredAuthSession } from '@/auth/session'
import { resolveBreadcrumbs } from '@/app/navigation'
import { BrandLogo } from '@/components/common/BrandLogo'
import { AppearanceSettings } from '@/components/common/AppearanceSettings'
import { PageTabs } from '@/components/layout/PageTabs'
import { SidebarNavigation } from '@/components/layout/SidebarNavigation'
import { logoutAdminUser } from '@/runtime/loader/auth'
import { listCollectionSchemas } from '@/runtime/loader/listCollectionSchemas'
import { listMenuGroups } from '@/runtime/loader/listMenuGroups'
import { displayRoleName } from '@/runtime/roles/displayRoleName'
import { resolveAssetUrl } from '@/services/asset'
import type { CollectionSchemaSummary, MenuGroupItem } from '@/types/schema'

export function AdminLayout() {
  const [session, setSession] = useState(() => getStoredAuthSession())
  const [avatarUrl, setAvatarUrl] = useState('')
  const location = useLocation()
  const navigate = useNavigate()
  const [collections, setCollections] = useState<CollectionSchemaSummary[]>([])
  const [menuGroups, setMenuGroups] = useState<MenuGroupItem[]>([])

  useEffect(() => {
    function handleSessionUpdate() {
      setSession(getStoredAuthSession())
    }
    window.addEventListener('modmin:session-updated', handleSessionUpdate)
    return () => window.removeEventListener('modmin:session-updated', handleSessionUpdate)
  }, [])

  useEffect(() => {
    const avatar = session?.userInfo.avatar
    if (!avatar) {
      setAvatarUrl('')
      return
    }
    void resolveAssetUrl(avatar).then(setAvatarUrl).catch(() => setAvatarUrl(''))
  }, [session?.userInfo.avatar])

  useEffect(() => {
    async function loadSidebarData() {
      const [collectionResponse, groupResponse] = await Promise.all([
        listCollectionSchemas(),
        listMenuGroups(),
      ])

      if (collectionResponse.code === 0) {
        setCollections(collectionResponse.data.list)
      }

      setMenuGroups(groupResponse.code === 0 ? groupResponse.data.list : [])
    }

    void loadSidebarData()

    window.addEventListener('modmin:schema-updated', loadSidebarData)
    return () => window.removeEventListener('modmin:schema-updated', loadSidebarData)
  }, [])

  const collectionEntries = collections.map((item) => ({
    collectionName: item.collectionName,
    pageCode: item.pageCode,
    label: item.modelName || item.collectionName,
  }))
  const isModelEditorPage =
    location.pathname === '/config/models/create' || /^\/config\/models\/[^/]+\/edit$/.test(location.pathname)
  const breadcrumbs = resolveBreadcrumbs(location.pathname, collectionEntries)
  const breadcrumbItems = breadcrumbs.map((item, index) => {
    const isLast = index === breadcrumbs.length - 1
    return {
      title: (
        <span className={`app-breadcrumb-node${isLast ? ' app-breadcrumb-node-current' : ''}`}>
          {index === 0 ? <HomeOutlined className="app-breadcrumb-icon" /> : null}
          {item.to && !isLast ? <Link to={item.to}>{item.label}</Link> : <span>{item.label}</span>}
        </span>
      ),
    }
  })

  const displayName = session?.userInfo.nickName || session?.userInfo.userName || '未登录'
  const userInitial = displayName.slice(0, 1).toUpperCase()
  const roleLabel = displayRoleName(session?.userInfo.roleCode)

  return (
    <Layout className="app-shell">
      <Layout.Sider width={248} className="app-side" theme="dark">
        <div className="app-logo-block">
          <BrandLogo tone="light" subtitle="Model Admin" />
        </div>
        <SidebarNavigation collections={collections} menuGroups={menuGroups} />
      </Layout.Sider>
      <Layout className="app-main-shell">
        <Layout.Header className="app-topbar">
          <div className="app-topbar-tools" />
          <div className="app-topbar-account">
            <AppearanceSettings />
            <Dropdown
              placement="bottomRight"
              overlayClassName="app-user-dropdown"
              menu={{
                items: [
                  {
                    key: 'profile',
                    type: 'group',
                    label: (
                      <div className="app-user-dropdown-header">
                        <Avatar size={40} src={avatarUrl || undefined} className="app-user-avatar">
                          {!avatarUrl ? userInitial : null}
                        </Avatar>
                        <div className="app-user-dropdown-info">
                          <span className="app-user-dropdown-name">{displayName}</span>
                          <span className="app-user-dropdown-role">{roleLabel}</span>
                        </div>
                      </div>
                    ),
                  },
                  { type: 'divider' },
                  {
                    key: 'logout',
                    label: '退出登录',
                    icon: <LogoutOutlined />,
                    danger: true,
                  },
                ],
                onClick: ({ key }) => {
                  if (key === 'logout') {
                    void logoutAdminUser().then(() => {
                      navigate('/login', { replace: true })
                    })
                  }
                },
              }}
              trigger={['click']}
            >
              <Button type="text" className="app-user-entry">
                <Space size={10} align="center">
                  <Avatar size={32} src={avatarUrl || undefined} icon={!avatarUrl ? <UserOutlined /> : undefined} className="app-user-avatar" />
                  <div className="app-user-meta">
                    <span className="app-user-name">{displayName}</span>
                    <span className="app-user-role">{roleLabel}</span>
                  </div>
                  <Divider type="vertical" className="app-user-divider" />
                  <span className="app-user-status">在线</span>
                </Space>
              </Button>
            </Dropdown>
          </div>
        </Layout.Header>
        <div className="app-subbar">
          <Breadcrumb
            items={breadcrumbItems}
            separator={<RightOutlined className="app-breadcrumb-separator" />}
            className="app-breadcrumb"
          />
          <PageTabs collectionEntries={collectionEntries} />
        </div>
        <Layout.Content className={`app-content${isModelEditorPage ? ' app-content-model-editor' : ''}`}>
          <Outlet />
        </Layout.Content>
      </Layout>
    </Layout>
  )
}
