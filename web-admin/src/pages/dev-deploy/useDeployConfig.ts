import { useEffect, useState } from 'react'
import { getDeployConfig, type DeployConfigSnapshot } from '@/pages/dev-deploy/services'

export function useDeployConfig() {
  const [config, setConfig] = useState<DeployConfigSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadConfig() {
      setLoading(true)
      try {
        const nextConfig = await getDeployConfig()
        if (cancelled) return
        setConfig(nextConfig)
        setError('')
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : '读取部署配置失败')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadConfig()
    return () => {
      cancelled = true
    }
  }, [])

  return {
    config,
    loading,
    error,
  }
}
