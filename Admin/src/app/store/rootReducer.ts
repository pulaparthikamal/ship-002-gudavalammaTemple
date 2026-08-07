import { combineReducers } from '@reduxjs/toolkit'
import { authReducer } from '@/features/auth/authSlice'
import { preferencesReducer } from '@/features/preferences/preferencesSlice'
import { sessionReducer } from '@/features/session/sessionSlice'
import { apiSlice } from '@/services/api/apiSlice'

export const rootReducer = combineReducers({
  auth: authReducer,
  session: sessionReducer,
  preferences: preferencesReducer,
  [apiSlice.reducerPath]: apiSlice.reducer,
})

export type RootReducerState = ReturnType<typeof rootReducer>
