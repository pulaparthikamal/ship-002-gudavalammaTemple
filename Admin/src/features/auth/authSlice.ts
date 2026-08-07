import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import type { AuthSession, AuthState, AuthUser } from '@/types/auth'

type AuthRootState = {
  auth: AuthState
}

export const initialAuthState: AuthState = {
  accessToken: null,
  refreshToken: null,
  expiresAt: null,
  user: null,
  loginData: null,
  status: 'anonymous',
  error: null,
  audience: null,
}

export function isAccessTokenExpired(expiresAt: number | null) {
  return Boolean(expiresAt && expiresAt <= Date.now())
}

const authSlice = createSlice({
  name: 'auth',
  initialState: initialAuthState,
  reducers: {
    setCredentials: (state, action: PayloadAction<AuthSession>) => {
      state.accessToken = action.payload.accessToken
      state.refreshToken = action.payload.refreshToken
      state.expiresAt = action.payload.expiresAt
      state.user = action.payload.user
      state.loginData = action.payload.loginData
      state.status = 'authenticated'
      state.error = null
      state.audience = action.payload.audience
    },
    logout: () => initialAuthState,
    sessionExpired: (state, action: PayloadAction<string | undefined>) => {
      state.accessToken = null
      state.refreshToken = null
      state.expiresAt = null
      state.user = null
      state.loginData = null
      state.status = 'expired'
      state.error = action.payload ?? 'Your session has expired. Please sign in again.'
    },
    updateAccessToken: (state, action: PayloadAction<{ accessToken: string; expiresAt: number | null }>) => {
      state.accessToken = action.payload.accessToken
      state.expiresAt = action.payload.expiresAt
    },
    updateProfile: (state, action: PayloadAction<Pick<AuthUser, 'name' | 'email'>>) => {
      if (state.user) {
        state.user.name = action.payload.name
        state.user.email = action.payload.email
      }
    },
    clearAuthError: (state) => {
      state.error = null
    },
  },
})

export const { clearAuthError, logout, sessionExpired, setCredentials, updateProfile, updateAccessToken } =
  authSlice.actions
export const authReducer = authSlice.reducer

export const selectAuth = (state: AuthRootState) => state.auth
export const selectCurrentUser = (state: AuthRootState) => state.auth.user
export const selectLoginData = (state: AuthRootState) => state.auth.loginData
export const selectAccessToken = (state: AuthRootState) => state.auth.accessToken
export const selectRefreshToken = (state: AuthRootState) => state.auth.refreshToken
export const selectTokenExpiresAt = (state: AuthRootState) => state.auth.expiresAt
export const selectAuthError = (state: AuthRootState) => state.auth.error
export const selectAuthAudience = (state: AuthRootState) => state.auth.audience

export const selectIsAuthenticated = (state: AuthRootState) =>
  state.auth.status === 'authenticated' &&
  Boolean(state.auth.accessToken) &&
  !isAccessTokenExpired(state.auth.expiresAt)

export const selectIsSessionExpired = (state: AuthRootState) => state.auth.status === 'expired'
