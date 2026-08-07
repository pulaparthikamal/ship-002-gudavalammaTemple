import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'

export type AppTheme = 'light' | 'dark' | 'system'
export type AppDensity = 'comfortable' | 'compact'

export interface PreferencesState {
  theme: AppTheme
  density: AppDensity
  locale: string
  primaryColor: string
  sidebarCollapsed: boolean
}

type PreferencesRootState = {
  preferences: PreferencesState
}

const initialState: PreferencesState = {
  theme: 'light',
  density: 'comfortable',
  locale: 'en-US',
  primaryColor: '#2563eb',
  sidebarCollapsed: false,
}

const preferencesSlice = createSlice({
  name: 'preferences',
  initialState,
  reducers: {
    setTheme: (state, action: PayloadAction<AppTheme>) => {
      state.theme = action.payload
    },
    setDensity: (state, action: PayloadAction<AppDensity>) => {
      state.density = action.payload
    },
    setLocale: (state, action: PayloadAction<string>) => {
      state.locale = action.payload
    },
    setPrimaryColor: (state, action: PayloadAction<string>) => {
      state.primaryColor = action.payload
    },
    setSidebarCollapsed: (state, action: PayloadAction<boolean>) => {
      state.sidebarCollapsed = action.payload
    },
    toggleSidebar: (state) => {
      state.sidebarCollapsed = !state.sidebarCollapsed
    },
  },
})

export const { setDensity, setLocale, setPrimaryColor, setSidebarCollapsed, setTheme, toggleSidebar } =
  preferencesSlice.actions
export const preferencesReducer = preferencesSlice.reducer

export const selectPreferences = (state: PreferencesRootState) => state.preferences
export const selectSidebarCollapsed = (state: PreferencesRootState) =>
  state.preferences.sidebarCollapsed
