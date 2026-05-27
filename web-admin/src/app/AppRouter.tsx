import { lazy, Suspense, useEffect } from 'react'
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { message } from 'antd'
import { LoginPage } from '@/pages/auth/LoginPage'

const ProtectedAppRoutes = lazy(() => import('@/app/ProtectedAppRoutes'))
const DevDeployPage = import.meta.env.DEV ? lazy(() => import('@/pages/dev-deploy/DevDeployPage')) : null

function AuthExpiredListener() {
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    function handler(event: Event) {
      if (location.pathname === '/login') return
      const detail = (event as CustomEvent<{ reason?: string }>).detail
      void message.warning(detail?.reason ? `登录态已失效：${detail.reason}` : '登录态已失效，请重新登录')
      navigate('/login', { replace: true, state: { from: location.pathname } })
    }
    window.addEventListener('modmin:auth-expired', handler)
    return () => window.removeEventListener('modmin:auth-expired', handler)
  }, [navigate, location.pathname])

  return null
}

export function AppRouter() {
  const devDeployRoute = DevDeployPage ? (
    <Route
      path="/dev/deploy"
      element={(
        <div className="dev-deploy-route">
          <Suspense fallback={<div style={{ padding: 40, color: '#888' }}>正在加载...</div>}>
            <DevDeployPage />
          </Suspense>
        </div>
      )}
    />
  ) : null

  return (
    <>
      <AuthExpiredListener />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        {devDeployRoute}
        <Route
          path="/*"
          element={
            <Suspense fallback={<div style={{ padding: 40, color: '#888' }}>正在加载...</div>}>
              <ProtectedAppRoutes />
            </Suspense>
          }
        />
      </Routes>
    </>
  )
}
