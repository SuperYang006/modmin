import { useEffect, useState } from 'react'
import { getConsoleOverview } from '@/runtime/loader/consoleOverview'
import type { ConsoleOverviewResult } from '@/types/schema'

export function useConsoleOverview() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [overview, setOverview] = useState<ConsoleOverviewResult | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadOverview() {
      setLoading(true)
      setError('')

      try {
        const response = await getConsoleOverview()

        if (cancelled) return

        if (response.code !== 0) {
          setError(response.message || '加载控制台数据失败')
          setOverview(null)
          return
        }

        setOverview(response.data)
      } catch (error) {
        if (!cancelled) {
          setError(error instanceof Error ? error.message : '加载控制台数据失败')
          setOverview(null)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadOverview()

    return () => {
      cancelled = true
    }
  }, [])

  return {
    loading,
    error,
    overview,
  }
}
