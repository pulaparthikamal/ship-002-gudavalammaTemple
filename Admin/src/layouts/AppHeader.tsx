import { Menu, Moon, Sun } from 'lucide-react'
import { Button } from 'primereact/button'
import { BrandLogo } from '@/components/ui/BrandLogo'
import { selectSidebarCollapsed } from '@/features/preferences/preferencesSlice'
import { useAppSelector } from '@/hooks/redux'
import { useTheme } from '@/hooks/useTheme'

interface AppHeaderProps {
  onOpenMobileMenu: () => void
  isSidebarHoverExpanded: boolean
}

export function AppHeader({ onOpenMobileMenu, isSidebarHoverExpanded }: AppHeaderProps) {
  const isSidebarCollapsed = useAppSelector(selectSidebarCollapsed)
  const { resolvedTheme, toggleTheme } = useTheme()
  const ThemeIcon = resolvedTheme === 'dark' ? Sun : Moon
  const nextThemeLabel = resolvedTheme === 'dark' ? 'light' : 'dark'

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)] px-3 backdrop-blur md:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <Button
          type="button"
          text
          rounded
          severity="secondary"
          aria-label="Open menu"
          title="Open menu"
          className="lg:hidden"
          onClick={onOpenMobileMenu}
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </Button>
        {isSidebarCollapsed && !isSidebarHoverExpanded ? (
          <BrandLogo variant="full" className="hidden h-10 max-w-40 lg:block" />
        ) : null}
      </div>

      <div className="flex min-w-0 items-center gap-3">
        <Button
          type="button"
          text
          rounded
          severity="secondary"
          aria-label={`Switch to ${nextThemeLabel} theme`}
          title={`Switch to ${nextThemeLabel} theme`}
          onClick={toggleTheme}
        >
          <ThemeIcon className="h-4 w-4" aria-hidden="true" />
        </Button>
        <div className="hidden items-center border-r border-[var(--color-border)] pr-4 lg:flex">
          <span className="text-[11px] font-bold uppercase tracking-tight text-[var(--color-text-muted)]">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
        </div>
      </div>
    </header>
  )
}
