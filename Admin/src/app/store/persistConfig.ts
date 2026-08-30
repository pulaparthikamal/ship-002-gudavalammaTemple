import { createTransform } from 'redux-persist'
import type { PersistConfig, PersistedState, PersistState } from 'redux-persist'
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

/**
 * Migrates a session persisted before the staff/devotee locale split
 * (Phase 13a) — it has a single `preferences.locale` field, not
 * `staffLocale`/`devoteeLocale`. This has to run as a redux-persist
 * `migrate` step (operating on the *raw* persisted blob, before the default
 * `autoMergeLevel1` reconciler runs) rather than inside the preferences
 * slice's own reducer: the reconciler skips hard-applying `inboundState` for
 * any top-level key the wrapped reducer's REHYDRATE handling touched at all
 * (by design — "reducer already handled it"), which would silently discard
 * every *other* persisted preference (theme, sidebar state, cached
 * dynamic translations) the moment this migration fires. Doing it here, on
 * the raw blob, keeps every other field intact and lets the normal
 * reconciliation path apply the (now-migrated) inbound state as usual.
 */
const migrate = (state: PersistedState): Promise<PersistedState> => {
  const rootState = state as (RootReducerState & { _persist: PersistState }) | undefined
  const preferences = rootState?.preferences as (RootReducerState['preferences'] & { locale?: string }) | undefined
  const legacyLocale = preferences?.locale

  if (!rootState || !preferences || !legacyLocale) {
    return Promise.resolve(state)
  }

  return Promise.resolve({
    ...rootState,
    preferences: {
      ...preferences,
      staffLocale: preferences.staffLocale ?? legacyLocale,
      devoteeLocale: preferences.devoteeLocale ?? legacyLocale,
    },
  })
}

export const persistConfig: PersistConfig<RootReducerState> = {
  key: 'root',
  version: 1,
  storage: webStorage,
  whitelist: ['auth', 'session', 'preferences'],
  blacklist: ['api'],
  transforms: [authPersistTransform],
  migrate,
}
