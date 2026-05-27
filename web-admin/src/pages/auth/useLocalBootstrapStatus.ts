import { useEffect, useState } from 'react'
import { getLocalBootstrapStatus, type LocalBootstrapStatus } from '@/pages/dev-deploy/services'

const apiMode = (import.meta.env.VITE_API_MODE as 'mock' | 'http' | 'tcb' | undefined) ?? 'mock'

export function useLocalBootstrapStatus() {
  const [status, setStatus] = useState<LocalBootstrapStatus | null>(null)
  const [loading, setLoading] = useState(apiMode === 'http')
  const [error, setError] = useState('')

  useEffect(() => {
    if (apiMode !== 'http') {
      setLoading(false)
      return
    }

    let cancelled = false

    async function loadStatus() {
      setLoading(true)
      try {
        const nextStatus = await getLocalBootstrapStatus()
        if (cancelled) return
        setStatus(nextStatus)
        setError('')
      } catch (nextError) {
        if (cancelled) return
        setError(nextError instanceof Error ? nextError.message : '读取本地初始化状态失败')
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadStatus()

    return () => {
      cancelled = true
    }
  }, [])

  return {
    status,
    loading,
    error,
  }
}
