export type AuthStatus = 'anonymous' | 'authenticated' | 'expired'

/**
 * Client-only discriminator (never sent to/received from the backend). The
 * backend has a single User/Role model with no devotee/staff distinction, so
 * this tags which portal a session was established through, letting the two
 * portals' route guards stay mutually exclusive in one shared auth slice.
 */
export type AuthAudience = 'staff' | 'devotee'

export interface AuthUser {
  id: string
  name: string
  email: string
  roles: string[]
  permissions?: Record<string, unknown>
}

export interface AuthSession {
  accessToken: string
  refreshToken: string | null
  expiresAt: number | null
  user: AuthUser
  loginData: LoginResponseUser | null
  audience: AuthAudience
}

export interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  expiresAt: number | null
  user: AuthUser | null
  loginData: LoginResponseUser | null
  status: AuthStatus
  error: string | null
  audience: AuthAudience | null
}

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  firstName: string
  lastName: string
  email: string
  phone?: string
  password: string
}

export interface DeviceInfo {
  ipAddress: string
  browserName: string
  osName: string
  osVersion: string
  deviceType: 'browser'
}

export interface ForgotPasswordRequest {
  email: string
  entityType: 'user'
  deviceInfo: DeviceInfo
}

export interface AuthMutationResponse {
  success?: boolean
  statusCode?: number
  respMessage?: string
  message?: string
  data?: unknown
  meta?: unknown
  errors?: unknown
}

export interface LoginResponseRole {
  _id: string
  role: string
  roleType: string
  status: string
  active: boolean
  permissions?: Record<string, unknown>
}

export interface LoginResponseUser {
  _id: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  role?: LoginResponseRole
  isActive?: boolean
  isEmailVerified?: boolean
}

export interface LoginResponse {
  success?: boolean
  statusCode?: number
  respMessage?: string
  data?: LoginResponseUser
  meta?: unknown
  errors?: unknown
  accessToken: string
  refreshToken?: string | null
  expiresAt?: number | null
  expiresIn?: number
  user?: AuthUser
}
