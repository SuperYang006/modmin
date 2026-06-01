import { useNavigate } from 'react-router-dom'
import { Alert, Card, Skeleton } from 'antd'
import { DashboardHeader } from '@/pages/dashboard/components/DashboardHeader'
import { DashboardModelList } from '@/pages/dashboard/components/DashboardModelList'
import { DashboardStats } from '@/pages/dashboard/components/DashboardStats'
import { DashboardWarnings } from '@/pages/dashboard/components/DashboardWarnings'
import { useConsoleOverview } from '@/pages/dashboard/hooks/useConsoleOverview'
import { PageShell } from '@/components/ui'

export function DashboardPage() {
  const navigate = useNavigate()
  const { loading, error, overview } = useConsoleOverview()
  const isSuperAdmin = overview?.isSuperAdmin === true

  function handleNavigate(path: string) {
    navigate(path)
  }

  return (
    <PageShell className="dashboard-page">
      {error ? <Alert type="error" showIcon title={error} /> : null}

      <DashboardHeader isSuperAdmin={isSuperAdmin} onNavigate={handleNavigate} />

      {loading ? (
        <Card>
          <Skeleton active paragraph={{ rows: 8 }} />
        </Card>
      ) : overview ? (
        <>
          <DashboardStats isSuperAdmin={overview.isSuperAdmin} stats={overview.stats} />

          <section className="dashboard-main-grid">
            <DashboardModelList
              isSuperAdmin={overview.isSuperAdmin}
              models={overview.recentModels}
              onNavigate={handleNavigate}
            />
            <DashboardWarnings
              isSuperAdmin={overview.isSuperAdmin}
              warnings={overview.warnings}
              onNavigate={handleNavigate}
            />
          </section>
        </>
      ) : null}
    </PageShell>
  )
}
