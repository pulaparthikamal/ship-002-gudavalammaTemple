import axios, { AxiosHeaders } from 'axios'
import type { InternalAxiosRequestConfig } from 'axios'
import { API_BASE_URL, API_TIMEOUT_MS } from './apiConfig'
import { formatApiError } from './apiError'
import {
  getAuthSessionSnapshot,
  isAuthSnapshotExpired,
  notifyAuthHttpError,
} from './authSessionBridge'
import type { ApiError } from '@/types/api'

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT_MS,
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
})

function attachAuthorizationHeader(config: InternalAxiosRequestConfig) {
  if (config.secured === false) {
    return config
  }

  const snapshot = getAuthSessionSnapshot()

  if (isAuthSnapshotExpired(snapshot)) {
    const tokenExpiredError: ApiError = {
      status: 401,
      code: 'TOKEN_EXPIRED',
      message: 'Your session has expired. Please sign in again.',
      timestamp: new Date().toISOString(),
    }

    notifyAuthHttpError(401, tokenExpiredError)
    return Promise.reject(tokenExpiredError)
  }

  if (snapshot.accessToken) {
    const headers = AxiosHeaders.from(config.headers)
    headers.set('Authorization', `Bearer ${snapshot.accessToken}`)
    config.headers = headers
  }

  return config
}

apiClient.interceptors.request.use(attachAuthorizationHeader)

apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    const apiError = formatApiError(error)
    const shouldHandleGlobally =
      !axios.isAxiosError(error) || error.config?.skipGlobalErrorHandler !== true

    if (shouldHandleGlobally && (apiError.status === 401 || apiError.status === 403)) {
      notifyAuthHttpError(apiError.status, apiError)
    }

    return Promise.reject(apiError)
  },
)
