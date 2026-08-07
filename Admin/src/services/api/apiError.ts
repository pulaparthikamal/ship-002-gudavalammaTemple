import axios from 'axios'
import type { ApiError } from '@/types/api'

type ApiErrorResponseBody = {
  message?: string
  respMessage?: string
  error?: string
  code?: string
  details?: unknown
  errors?: unknown
  path?: string
  timestamp?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isApiError(error: unknown): error is ApiError {
  return isRecord(error) && 'status' in error && typeof error.message === 'string'
}

function getResponseBody(data: unknown): ApiErrorResponseBody | undefined {
  if (typeof data === 'string') {
    return { message: data }
  }

  if (!isRecord(data)) {
    return undefined
  }

  return data as ApiErrorResponseBody
}

export function formatApiError(error: unknown): ApiError {
  if (axios.isAxiosError(error)) {
    const body = getResponseBody(error.response?.data)
    const status = error.response?.status ?? 'FETCH_ERROR'

    return {
      status,
      message: body?.message ?? body?.respMessage ?? body?.error ?? error.message ?? 'Request failed',
      code: body?.code ?? error.code,
      details: body?.details ?? body?.errors,
      path: body?.path ?? error.config?.url,
      timestamp: body?.timestamp ?? new Date().toISOString(),
    }
  }

  if (isApiError(error)) {
    return error
  }

  if (error instanceof Error) {
    return {
      status: 'CUSTOM_ERROR',
      message: error.message,
      timestamp: new Date().toISOString(),
    }
  }

  return {
    status: 'CUSTOM_ERROR',
    message: 'An unexpected error occurred',
    details: isRecord(error) ? JSON.parse(JSON.stringify(error, Object.getOwnPropertyNames(error))) : error,
    timestamp: new Date().toISOString(),
  }
}

export function getApiErrorMessage(error: unknown, fallback = 'Something went wrong') {
  if (!error) {
    return fallback
  }

  return formatApiError(error).message || fallback
}
