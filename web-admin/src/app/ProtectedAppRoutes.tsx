import { lazy, Suspense, useEffect, useState, type JSX } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { getGeneratedPagePath } from '@/app/navigation'
import { listCollectionSchemas } from '@/runtime/loader/listCollectionSchemas'
import { usePermission } from '@/context/PermissionContext'

const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage').then((module) => ({ default: module.DashboardPage })))
const GeneratedCrudPage = lazy(() => import('@/pages/generated/GeneratedCrudPage').then((module) => ({ default: module.GeneratedCrudPage })))
const GeneratedCrudFormPage = lazy(() => import('@/pages/generated/GeneratedCrudFormPage').then((module) => ({ default: module.GeneratedCrudFormPage })))
const ConfigPage = lazy(() => import('@/pages/config/ConfigPage').then((module) => ({ default: module.ConfigPage })))
const ModelCreatePage = lazy(() => import('@/pages/config/ModelCreatePage').then((module) => ({ default: module.ModelCreatePage })))
const ModelEditPage = lazy(() => import('@/pages/config/ModelEditPage').then((module) => ({ default: module.ModelEditPage })))
const MenuGroupManagementPage = lazy(() => import('@/pages/config/MenuGroupManagementPage').then((module) => ({ default: module.MenuGroupManagementPage })))
const RoleManagementPage = lazy(() => import('@/pages/config/RoleManagementPage').then((module) => ({ default: module.RoleManagementPage })))
const AdminUserManagementPage = lazy(() => import('@/pages/config/AdminUserManagementPage').then((module) => ({ default: module.AdminUserManagementPage })))
const AuditLogPage = lazy(() => import('@/pages/config/AuditLogPage').then((module) => ({ default: module.AuditLogPage })))
const WebhookManagementPage = lazy(() => import('@/pages/config/WebhookManagementPage').then((module) => ({ default: module.WebhookManagementPage })))
const WebhookDeliveriesPage = lazy(() => import('@/pages/config/WebhookDeliveriesPage').then((module) => ({ default: module.WebhookDeliveriesPage })))
const DataExportPage = lazy(() => import('@/pages/config/DataExportPage').then((module) => ({ default: module.DataExportPage })))
const DataImportPage = lazy(() => import('@/pages/config/DataImportPage').then((module) => ({ default: module.DataImportPage })))
const ImportExportHistoryPage = lazy(() => import('@/pages/config/ImportExportHistoryPage').then((module) => ({ default: module.ImportExportHistoryPage })))
const ImportExportPage = lazy(() => import('@/pages/config/ImportExportPage').then((module) => ({ default: module.ImportExportPage })))
const NoAccessPage = lazy(() => import('@/pages/no-access/NoAccessPage').then((module) => ({ default: module.NoAccessPage })))

function RouteFallback() {
  return <div style={{ padding: 40, color: '#888' }}>正在加载...</div>
}

function LazyRoute({ children }: { children: JSX.Element }) {
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>
}

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
        const canAccessDataExport = Object.values(permMap).some((permission) => Boolean(permission.canList))
        if (canAccessDataExport) {
          setTarget('/config/data-export')
          return
        }
        const canAccessDataImport = Object.values(permMap).some((permission) => Boolean(permission.canCreate || permission.canUpdate))
        if (canAccessDataImport) {
          setTarget('/config/data-import')
          return
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
        <Route path="dashboard" element={<LazyRoute><DashboardPage /></LazyRoute>} />
        <Route path="no-access" element={<LazyRoute><NoAccessPage /></LazyRoute>} />
        <Route path="generated/:pageCode" element={<LazyRoute><GeneratedCrudPage /></LazyRoute>} />
        <Route path="generated/:pageCode/create" element={<LazyRoute><GeneratedCrudFormPage /></LazyRoute>} />
        <Route path="generated/:pageCode/:recordId/edit" element={<LazyRoute><GeneratedCrudFormPage /></LazyRoute>} />
        <Route path="config/models" element={<SuperAdminGuard><LazyRoute><ConfigPage /></LazyRoute></SuperAdminGuard>} />
        <Route path="config/models/create" element={<SuperAdminGuard><LazyRoute><ModelCreatePage /></LazyRoute></SuperAdminGuard>} />
        <Route path="config/models/:collectionName/edit" element={<SuperAdminGuard><LazyRoute><ModelEditPage /></LazyRoute></SuperAdminGuard>} />
        <Route path="config/menu-groups" element={<SuperAdminGuard><LazyRoute><MenuGroupManagementPage /></LazyRoute></SuperAdminGuard>} />
        <Route path="config/roles" element={<SuperAdminGuard><LazyRoute><RoleManagementPage /></LazyRoute></SuperAdminGuard>} />
        <Route path="config/admin-users" element={<SuperAdminGuard><LazyRoute><AdminUserManagementPage /></LazyRoute></SuperAdminGuard>} />
        <Route path="config/import-export" element={<LazyRoute><ImportExportPage /></LazyRoute>} />
        <Route path="config/data-export" element={<LazyRoute><DataExportPage /></LazyRoute>} />
        <Route path="config/data-import" element={<LazyRoute><DataImportPage /></LazyRoute>} />
        <Route path="config/import-export-history" element={<LazyRoute><ImportExportHistoryPage /></LazyRoute>} />
        <Route path="config/audit-logs" element={<SuperAdminGuard><LazyRoute><AuditLogPage /></LazyRoute></SuperAdminGuard>} />
        <Route path="config/webhooks" element={<SuperAdminGuard><LazyRoute><WebhookManagementPage /></LazyRoute></SuperAdminGuard>} />
        <Route path="config/webhook-deliveries" element={<SuperAdminGuard><LazyRoute><WebhookDeliveriesPage /></LazyRoute></SuperAdminGuard>} />
      </Route>
    </Routes>
  )
}
