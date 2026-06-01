import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { getStoredAuthSession } from '@/auth/session'
import { BrandLogo } from '@/components/common/BrandLogo'
import { restoreTcbLogin, validateAdminSession } from '@/runtime/loader/auth'
import { getMyPermissions } from '@/runtime/loader/getMyPermissions'
import { PermissionContext } from '@/context/PermissionContext'
import type { PermissionContextValue } from '@/context/PermissionContext'

export function AuthGuard(props: { children: JSX.Element }) {
  const { children } = props
  const location = useLocation()
  const [checking, setChecking] = useState(true)
  const [allowed, setAllowed] = useState(false)
  const [permissions, setPermissions] = useState<PermissionContextValue>({ isSuperAdmin: false, permMap: {} })

  useEffect(() => {
    async function bootstrap() {
      try {
        const session = getStoredAuthSession()

        if (!session) {
          setAllowed(false)
          setChecking(false)
          return
        }

        const response = await validateAdminSession()

        if (response.code !== 0 || !response.data.valid) {
          setAllowed(false)
          setChecking(false)
          return
        }

        try {
          await restoreTcbLogin()
        } catch {
          setAllowed(false)
          setChecking(false)
          return
        }

        // 加载权限
        const permResponse = await getMyPermissions()
        if (permResponse.code === 0) {
          setPermissions({
            isSuperAdmin: permResponse.data.isSuperAdmin,
            permMap: permResponse.data.permMap,
          })
        }

        setAllowed(true)
        setChecking(false)
      } catch {
        setAllowed(false)
        setChecking(false)
      }
    }

    void bootstrap()
  }, [])

  if (checking) {
    return (
      <div className="app-auth-check-screen">
        <div className="app-auth-check-stage">
          <div className="app-auth-check-orb">
            <span className="app-auth-check-ring app-auth-check-ring-outer" />
            <span className="app-auth-check-ring app-auth-check-ring-inner" />
            <span className="app-auth-check-logo">
              <BrandLogo showText={false} />
            </span>
          </div>
          <div className="app-auth-check-text">
            <div className="app-auth-check-title">正在校验登录状态</div>
            <div className="app-auth-check-subtitle">
              <span className="app-auth-check-dots">
                <i />
                <i />
                <i />
              </span>
              <span>正在恢复会话与云开发环境</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!allowed) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return (
    <PermissionContext.Provider value={permissions}>
      {children}
    </PermissionContext.Provider>
  )
}
