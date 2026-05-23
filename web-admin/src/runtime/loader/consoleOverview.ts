import { callCloudFunction } from '@/services/cloud'
import type { ConsoleOverviewResult } from '@/types/schema'

export async function getConsoleOverview() {
  return callCloudFunction<Record<string, never>, ConsoleOverviewResult>('modmin_system', {
    action: 'getConsoleOverview',
    data: {},
    meta: {
      requestId: `system_console_overview_${Date.now()}`,
      clientTime: Date.now(),
    },
  })
}
