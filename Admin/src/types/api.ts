export type ApiErrorStatus = number | 'FETCH_ERROR' | 'CUSTOM_ERROR'

export interface ApiError {
  status: ApiErrorStatus
  message: string
  code?: string
  details?: unknown
  path?: string
  timestamp?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  meta: {
    page: number
    pageSize: number
    total: number
  }
}
