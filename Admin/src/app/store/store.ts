import {
  FLUSH,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
  REHYDRATE,
  persistReducer,
  persistStore,
} from 'redux-persist'
import { configureStore, createListenerMiddleware, isAnyOf } from '@reduxjs/toolkit'
import { setupListeners } from '@reduxjs/toolkit/query'
import { rootReducer } from './rootReducer'
import { persistConfig } from './persistConfig'
import { logout, selectIsAuthenticated, sessionExpired, setCredentials } from '@/features/auth/authSlice'
import { clearSession, establishSession } from '@/features/session/sessionSlice'
import { apiSlice } from '@/services/api/apiSlice'
import {
  registerAuthHttpErrorHandler,
  setAuthSnapshotResolver,
} from '@/services/api/authSessionBridge'
import { setLocaleSnapshotResolver } from '@/services/api/localeSessionBridge'
import { menusApi } from '@/services/api/endpoints/menusApi'

const listenerMiddleware = createListenerMiddleware()
const persistedReducer = persistReducer(persistConfig, rootReducer)

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
        ignoredPaths: ['_persist'],
      },
    }).concat(listenerMiddleware.middleware, apiSlice.middleware),
  devTools: import.meta.env.DEV,
})

export const persistor = persistStore(store)

listenerMiddleware.startListening({
  actionCreator: setCredentials,
  effect: (action, listenerApi) => {
    listenerApi.dispatch(establishSession({ userId: action.payload.user.id }))
    listenerApi.dispatch(
      menusApi.endpoints.getMenus.initiate(undefined, {
        forceRefetch: true,
        subscribe: false,
      }),
    )
  },
})

listenerMiddleware.startListening({
  matcher: isAnyOf(logout, sessionExpired),
  effect: async (_action, listenerApi) => {
    listenerApi.dispatch(clearSession())
    listenerApi.dispatch(apiSlice.util.resetApiState())
    await persistor.flush()
  },
})

setAuthSnapshotResolver(() => {
  const state = store.getState()

  return {
    accessToken: state.auth.accessToken,
    expiresAt: state.auth.expiresAt,
    isAuthenticated: selectIsAuthenticated(state),
  }
})

setLocaleSnapshotResolver(() => {
  const state = store.getState()

  return {
    staffLocale: state.preferences.staffLocale ?? 'en',
    devoteeLocale: state.preferences.devoteeLocale ?? 'en',
  }
})

registerAuthHttpErrorHandler((status, error) => {
  if (status === 401 && selectIsAuthenticated(store.getState())) {
    store.dispatch(sessionExpired(error.message))
  }
})

setupListeners(store.dispatch)

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
