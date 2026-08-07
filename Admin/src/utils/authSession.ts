import type { AuthSession, AuthUser, LoginResponse, LoginResponseUser } from '@/types/auth'

function toDisplayName(user: LoginResponseUser) {
  return [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email
}

function normalizeAuthUser(response: LoginResponse): AuthUser {
  if (response.user) {
    return response.user
  }

  if (!response.data) {
    throw new Error('Login response did not include user data.')
  }

  return {
    id: response.data._id,
    name: toDisplayName(response.data),
    email: response.data.email,
    roles: response.data.role?.role ? [response.data.role.role] : [],
    permissions: response.data.role?.permissions,
  }
}

export function toAuthSession(response: LoginResponse): AuthSession {
  return {
    accessToken: response.accessToken,
    refreshToken: response.refreshToken ?? null,
    expiresAt:
      response.expiresAt ??
      (response.expiresIn ? Date.now() + response.expiresIn * 1000 : null),
    user: normalizeAuthUser(response),
    loginData: response.data ?? null,
  }
}
