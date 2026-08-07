import type { ApiError } from '@/types/api'

export interface AuthSessionSnapshot {
  accessToken: string | null
  expiresAt: number | null
  isAuthenticated: boolean
}

type AuthSnapshotResolver = () => AuthSessionSnapshot
type AuthHttpErrorHandler = (status: 401 | 403, error: ApiError) => void

const emptySnapshot: AuthSessionSnapshot = {
  accessToken: null,
  expiresAt: null,
  isAuthenticated: false,
}

let snapshotResolver: AuthSnapshotResolver | undefined
let authHttpErrorHandler: AuthHttpErrorHandler | undefined

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseJson<T>(value: string | null): T | null {
  if (!value) {
    return null
  }

  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

function readLocalStorageItem(key: string) {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function readPersistedAuthSnapshot(): AuthSessionSnapshot {
  if (typeof window === 'undefined') {
    return emptySnapshot
  }

  const persistedRoot = parseJson<Record<string, string>>(readLocalStorageItem('persist:root'))
  const rawAuth = persistedRoot?.auth
  const persistedAuth = parseJson<Record<string, unknown>>(rawAuth ?? null)

  if (!isRecord(persistedAuth)) {
    return emptySnapshot
  }

  const accessToken = typeof persistedAuth.accessToken === 'string' ? persistedAuth.accessToken : null
  const expiresAt = typeof persistedAuth.expiresAt === 'number' ? persistedAuth.expiresAt : null
  const status = typeof persistedAuth.status === 'string' ? persistedAuth.status : null

  return {
    accessToken,
    expiresAt,
    isAuthenticated: Boolean(accessToken) && status === 'authenticated',
  }
}

export function setAuthSnapshotResolver(resolver: AuthSnapshotResolver) {
  snapshotResolver = resolver
}

export function getAuthSessionSnapshot() {
  return snapshotResolver?.() ?? readPersistedAuthSnapshot()
}

export function isAuthSnapshotExpired(snapshot: AuthSessionSnapshot) {
  return Boolean(snapshot.accessToken && snapshot.expiresAt && snapshot.expiresAt <= Date.now())
}

export function registerAuthHttpErrorHandler(handler: AuthHttpErrorHandler) {
  authHttpErrorHandler = handler
}

export function notifyAuthHttpError(status: 401 | 403, error: ApiError) {
  authHttpErrorHandler?.(status, error)
}
