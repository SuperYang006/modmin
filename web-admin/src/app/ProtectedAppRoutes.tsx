import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { DashboardPage } from '@/pages/dashboard/DashboardPage'
import { GeneratedCrudPage } from '@/pages/generated/GeneratedCrudPage'
import { ConfigPage } from '@/pages/config/ConfigPage'
import { ModelCreatePage } from '@/pages/config/ModelCreatePage'
import { ModelEditPage } from '@/pages/config/ModelEditPage'
import { MenuGroupManagementPage } from '@/pages/config/MenuGroupManagementPage'
import { RoleManagementPage } from '@/pages/config/RoleManagementPage'
import { AdminUserManagementPage } from '@/pages/config/AdminUserManagementPage'
import { AuditLogPage } from '@/pages/config/AuditLogPage'
import { WebhookManagementPage } from '@/pages/config/WebhookManagementPage'
import { WebhookDeliveriesPage } from '@/pages/config/WebhookDeliveriesPage'
import { NoAccessPage } from '@/pages/no-access/NoAccessPage'
import { getGeneratedPagePath } from '@/app/navigation'
import { listCollectionSchemas } from '@/runtime/loader/listCollectionSchemas'
import { usePermission } from '@/context/PermissionContext'

function SuperAdminGuard({ children }: { children: JSX.Element }) {
  const { isSuperAdmin } = usePermission()
  if (!isSuperAdmin) return <Navigate to="/" replace />
  return children
}

function LandingRedirect() {
  const { isSuperAdmin, permMap } = usePermission()
  const [target, setTarget] = useState<string | null>(isSuperAdmin ? '/dashboard' : null)

  useEffect(() => {
    if (target) return
    let cancelled = false
    void listCollectionSchemas()
      .then((response) => {
        if (cancelled) return
        if (response.code === 0 && response.data.list.length > 0) {
          const accessible = response.data.list.filter((c) => permMap[c.collectionName]?.canList === true)
          if (accessible.length > 0) {
            setTarget(getGeneratedPagePath(accessible[0].pageCode))
            return
          }
        }
        setTarget('/no-access')
      })
      .catch(() => {
        if (!cancelled) setTarget('/no-access')
      })
    return () => {
      cancelled = true
    }
  }, [target, permMap])

  if (!target) return <div style={{ padding: 40, color: '#888' }}>正在加载...</div>
  return <Navigate to={target} replace />
}

export default function ProtectedAppRoutes() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <AuthGuard>
            <AdminLayout />
          </AuthGuard>
        }
      >
        <Route index element={<LandingRedirect />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="no-access" element={<NoAccessPage />} />
        <Route path="generated/:pageCode" element={<GeneratedCrudPage />} />
        <Route path="config/models" element={<SuperAdminGuard><ConfigPage /></SuperAdminGuard>} />
        <Route path="config/models/create" element={<SuperAdminGuard><ModelCreatePage /></SuperAdminGuard>} />
        <Route path="config/models/:collectionName/edit" element={<SuperAdminGuard><ModelEditPage /></SuperAdminGuard>} />
        <Route path="config/menu-groups" element={<SuperAdminGuard><MenuGroupManagementPage /></SuperAdminGuard>} />
        <Route path="config/roles" element={<SuperAdminGuard><RoleManagementPage /></SuperAdminGuard>} />
        <Route path="config/admin-users" element={<SuperAdminGuard><AdminUserManagementPage /></SuperAdminGuard>} />
        <Route path="config/audit-logs" element={<SuperAdminGuard><AuditLogPage /></SuperAdminGuard>} />
        <Route path="config/webhooks" element={<SuperAdminGuard><WebhookManagementPage /></SuperAdminGuard>} />
        <Route path="config/webhook-deliveries" element={<SuperAdminGuard><WebhookDeliveriesPage /></SuperAdminGuard>} />
      </Route>
    </Routes>
  )
}
