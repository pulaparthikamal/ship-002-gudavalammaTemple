import type { BaseQueryFn } from '@reduxjs/toolkit/query'
import type { AxiosRequestHeaders, Method } from 'axios'
import { API_TIMEOUT_MS } from './apiConfig'
import { formatApiError } from './apiError'
import { apiClient } from './axiosInstance'
import type { ApiError } from '@/types/api'

export interface AxiosBaseQueryRequest {
  url: string
  method?: Method
  data?: unknown
  params?: unknown
  headers?: AxiosRequestHeaders
  timeout?: number
  secured?: boolean
  skipGlobalErrorHandler?: boolean
}

export const axiosBaseQuery =
  (): BaseQueryFn<AxiosBaseQueryRequest, unknown, ApiError> =>
    async ({ url, method = 'GET', data, params, headers, timeout, secured = true, skipGlobalErrorHandler }) => {
      try {
        const result = await apiClient.request({
          url,
          method,
          data,
          params,
          headers: data instanceof FormData 
            ? { ...headers, 'Content-Type': undefined } as any
            : headers,
          timeout: timeout ?? API_TIMEOUT_MS,
          secured,
          skipGlobalErrorHandler,
        })

        return { data: result.data }
      } catch (error) {
        return { error: formatApiError(error) }
      }
    }
