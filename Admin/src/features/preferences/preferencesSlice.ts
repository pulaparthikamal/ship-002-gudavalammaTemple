import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'

export type AppTheme = 'light' | 'dark' | 'system'
export type AppDensity = 'comfortable' | 'compact'

export interface PreferencesState {
  theme: AppTheme
  density: AppDensity
  /**
   * Staff and devotee language selection are independent — switching one
   * must never affect the other, since they're different audiences on
   * shared UI (LanguageSwitcher) that can be viewed side by side (e.g. a
   * staff member previewing the devotee site).
   */
  staffLocale: string
  devoteeLocale: string
  primaryColor: string
  sidebarCollapsed: boolean
  /**
   * Flat key->text dictionaries for locales that don't have a hand-written
   * bundled dictionary (see Admin/src/i18n/translations) — fetched on
   * demand from `POST /translations/:locale` and cached here so it
   * persists across sessions via redux-persist. Shared across both
   * audiences (keyed by dictionary key, and staff/devotee key namespaces
   * never overlap), only which *locale* to look up differs per audience.
   */
  dynamicTranslations: Record<string, Record<string, string>>
}

type PreferencesRootState = {
  preferences: PreferencesState
}

const initialState: PreferencesState = {
  theme: 'light',
  density: 'comfortable',
  staffLocale: 'en',
  devoteeLocale: 'en',
  primaryColor: '#2563eb',
  sidebarCollapsed: false,
  dynamicTranslations: {},
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
    setStaffLocale: (state, action: PayloadAction<string>) => {
      state.staffLocale = action.payload
    },
    setDevoteeLocale: (state, action: PayloadAction<string>) => {
      state.devoteeLocale = action.payload
    },
    setDynamicTranslations: (state, action: PayloadAction<{ locale: string; dict: Record<string, string> }>) => {
      // Guards against stale persisted state saved before this field existed
      // (root-level redux-persist replaces the whole `preferences` object on
      // rehydration, so an old blob can genuinely lack this key).
      if (!state.dynamicTranslations) {
        state.dynamicTranslations = {}
      }
      state.dynamicTranslations[action.payload.locale] = action.payload.dict
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

export const {
  setDensity,
  setStaffLocale,
  setDevoteeLocale,
  setDynamicTranslations,
  setPrimaryColor,
  setSidebarCollapsed,
  setTheme,
  toggleSidebar,
} = preferencesSlice.actions
export const preferencesReducer = preferencesSlice.reducer

export const selectPreferences = (state: PreferencesRootState) => state.preferences
export const selectSidebarCollapsed = (state: PreferencesRootState) =>
  state.preferences.sidebarCollapsed
