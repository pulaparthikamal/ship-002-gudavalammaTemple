import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { AppHeader } from './AppHeader'
import { Sidebar } from './Sidebar'

export function AppLayout() {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [isSidebarHoverExpanded, setIsSidebarHoverExpanded] = useState(false)

  return (
    <div className="fixed inset-0 overflow-hidden bg-[var(--color-page)] text-[var(--color-text)]">
      <div className="flex h-full min-h-0">
        <Sidebar
          mobileOpen={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
          onDesktopHoverExpandedChange={setIsSidebarHoverExpanded}
        />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <AppHeader
            onOpenMobileMenu={() => setIsMobileSidebarOpen(true)}
            isSidebarHoverExpanded={isSidebarHoverExpanded}
          />
          <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-3 py-3">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
