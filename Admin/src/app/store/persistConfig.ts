import { createTransform } from 'redux-persist'
import type { PersistConfig } from 'redux-persist'
import { initialAuthState, isAccessTokenExpired } from '@/features/auth/authSlice'
import type { RootReducerState } from './rootReducer'
import { webStorage } from './webStorage'
import type { AuthState } from '@/types/auth'

const authPersistTransform = createTransform<AuthState, AuthState, RootReducerState>(
  (inboundState) => ({
    ...inboundState,
    error: null,
  }),
  (outboundState) => {
    if (!outboundState.accessToken) {
      return initialAuthState
    }

    if (isAccessTokenExpired(outboundState.expiresAt)) {
      return {
        ...initialAuthState,
        status: 'expired',
        error: 'Your session has expired. Please sign in again.',
      }
    }

    return {
      ...outboundState,
      status: 'authenticated',
      error: null,
    }
  },
  { whitelist: ['auth'] },
)

export const persistConfig: PersistConfig<RootReducerState> = {
  key: 'root',
  version: 1,
  storage: webStorage,
  whitelist: ['auth', 'session', 'preferences'],
  blacklist: ['api'],
  transforms: [authPersistTransform],
}
