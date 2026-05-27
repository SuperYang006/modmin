import { useEffect, useState } from 'react'
import { getDeployTask, type DeployTaskStatus } from '@/pages/dev-deploy/services'

export function useDeployTask(taskId: string) {
  const [task, setTask] = useState<DeployTaskStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!taskId) {
      setTask(null)
      setError('')
      return
    }

    let cancelled = false
    let timer = 0

    async function loadTask() {
      setLoading(true)
      try {
        const nextTask = await getDeployTask(taskId)
        if (cancelled) return
        setTask(nextTask)
        setError('')

        if (nextTask.status === 'queued' || nextTask.status === 'running') {
          timer = window.setTimeout(() => {
            void loadTask()
          }, 1500)
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : '加载部署状态失败')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadTask()

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [taskId])

  return {
    task,
    loading,
    error,
  }
}
