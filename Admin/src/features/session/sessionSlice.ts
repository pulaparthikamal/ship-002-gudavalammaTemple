import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'

export interface SessionState {
  sessionId: string | null
  userId: string | null
  startedAt: string | null
  lastActiveAt: string | null
  selectedWorkspaceId: string | null
  isLocked: boolean
}

type SessionRootState = {
  session: SessionState
}

const initialState: SessionState = {
  sessionId: null,
  userId: null,
  startedAt: null,
  lastActiveAt: null,
  selectedWorkspaceId: null,
  isLocked: false,
}

function createSessionId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
}

const sessionSlice = createSlice({
  name: 'session',
  initialState,
  reducers: {
    establishSession: (state, action: PayloadAction<{ userId: string }>) => {
      const now = new Date().toISOString()

      state.sessionId = createSessionId()
      state.userId = action.payload.userId
      state.startedAt = now
      state.lastActiveAt = now
      state.isLocked = false
    },
    touchSession: (state) => {
      state.lastActiveAt = new Date().toISOString()
    },
    setSelectedWorkspace: (state, action: PayloadAction<string | null>) => {
      state.selectedWorkspaceId = action.payload
    },
    lockSession: (state) => {
      state.isLocked = true
    },
    clearSession: () => initialState,
  },
})

export const { clearSession, establishSession, lockSession, setSelectedWorkspace, touchSession } =
  sessionSlice.actions
export const sessionReducer = sessionSlice.reducer

export const selectSession = (state: SessionRootState) => state.session
export const selectSessionId = (state: SessionRootState) => state.session.sessionId
