export interface ApiRequest<TData = Record<string, unknown>> {
  action: string
  data: TData
  meta?: {
    requestId?: string
    clientTime?: number
  }
}

export interface ApiResponse<TData = unknown> {
  code: number
  message: string
  data: TData
  requestId?: string
  serverTime?: number
}

