import type { PropsWithChildren } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { PrimeReactProvider } from 'primereact/api'
import { Provider as ReduxProvider } from 'react-redux'
import { PersistGate } from 'redux-persist/integration/react'
import { persistor, store } from '@/app/store/store'
import { ToastProvider } from './ToastProvider'
import { LoadingScreen } from '@/components/ui/LoadingScreen'
import { ThemeController } from './ThemeController'
import { SessionExpiredModal } from '@/features/auth/components/SessionExpiredModal'
import { SessionActivityManager } from '@/features/auth/components/SessionActivityManager'
import { RcmRealtimeBridge } from '@/components/rcm/RcmRealtimeBridge'

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <ReduxProvider store={store}>
      <PersistGate loading={<LoadingScreen className="bg-[var(--color-page)]/60 backdrop-blur-sm" message="Loading..." />} persistor={persistor}>
        <PrimeReactProvider value={{ ripple: true, inputStyle: 'filled' }}>
          <ThemeController />
          <ToastProvider>
            <BrowserRouter>
              <RcmRealtimeBridge />
              {children}
              <SessionExpiredModal />
              <SessionActivityManager />
            </BrowserRouter>
          </ToastProvider>
        </PrimeReactProvider>
      </PersistGate>
    </ReduxProvider>
  )
}
