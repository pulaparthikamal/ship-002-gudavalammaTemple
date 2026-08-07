import { useMemo, useRef } from 'react'
import type { PropsWithChildren } from 'react'
import { Toast } from 'primereact/toast'
import { ToastContext } from './toastContext'
import type { ToastContextValue } from './toastContext'

export function ToastProvider({ children }: PropsWithChildren) {
  const toastRef = useRef<Toast>(null)
  const contextValue = useMemo<ToastContextValue>(
    () => ({
      showToast: (message) => {
        toastRef.current?.show({
          life: 3500,
          ...message,
        })
      },
    }),
    [],
  )

  return (
    <ToastContext.Provider value={contextValue}>
      <Toast ref={toastRef} position="top-right" className="app-toast" />
      {children}
    </ToastContext.Provider>
  )
}
