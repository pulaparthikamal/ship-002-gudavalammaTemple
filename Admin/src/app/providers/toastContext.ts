import { createContext } from 'react'
import type { ToastMessage } from 'primereact/toast'

export interface ToastContextValue {
  showToast: (message: ToastMessage) => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)
