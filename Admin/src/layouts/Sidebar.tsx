import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import {
  ChevronDown,
  ChevronsUpDown,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  UserRound,
  X,
} from 'lucide-react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Button } from 'primereact/button'
import { OverlayPanel } from 'primereact/overlaypanel'
import { BrandLogo } from '@/components/ui/BrandLogo'
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog'
import { logout, selectCurrentUser } from '@/features/auth/authSlice'
import { selectSidebarCollapsed, toggleSidebar } from '@/features/preferences/preferencesSlice'
import { useAppDispatch, useAppSelector } from '@/hooks/redux'
import { useGetMenusQuery } from '@/services/api/endpoints/menusApi'
import type { AppMenuItem } from '@/types/menu'
import { cn } from '@/utils/classNames'
import { resolveMenuIcon } from '@/utils/menuIcons'
import { canShowMenuItem } from '@/utils/permissions'
import { getUserInitials } from '@/utils/userDisplay'

interface SidebarProps {
  mobileOpen: boolean
  onCloseMobile: () => void
  onDesktopHoverExpandedChange: (isExpanded: boolean) => void
}

function getMenuTitle(item: AppMenuItem) {
  return item.title || item.name || item.route
}

function getMenuKey(item: AppMenuItem) {
  return `${item._id || item.route || item.title}-${item.sequenceNo}`
}

function sortMenus(items: AppMenuItem[] = []): AppMenuItem[] {
  return [...items]
    .sort((first, second) => first.sequenceNo - second.sequenceNo)
    .map((item) => ({
      ...item,
      submenu: sortMenus(item.submenu ?? []),
    }))
}

function hasActiveRoute(item: AppMenuItem, pathname: string): boolean {
  const route = item.route?.replace(/\/+$/, '')
  if (route && (pathname === route || pathname.startsWith(`${route}/`))) {
    return true
  }

  return Boolean(item.submenu?.some((child) => hasActiveRoute(child, pathname)))
}

function collectActiveMenuKeys(items: AppMenuItem[], pathname: string): string[] {
  return items.flatMap((item) => {
    const children = item.submenu ?? []
    const childKeys = collectActiveMenuKeys(children, pathname)

    if (children.length && hasActiveRoute(item, pathname)) {
      return [getMenuKey(item), ...childKeys]
    }

    return childKeys
  })
}

function filterMenusByPermission(items: AppMenuItem[], permissions: Record<string, unknown> | undefined) {
  return items.reduce<AppMenuItem[]>((visibleItems, item) => {
    const visibleChildren = filterMenusByPermission(item.submenu ?? [], permissions)
    const hasVisibleSelf = canShowMenuItem(permissions, item)

    if (!hasVisibleSelf && !visibleChildren.length) {
      return visibleItems
    }

    visibleItems.push({
      ...item,
      submenu: visibleChildren,
    })

    return visibleItems
  }, [])
}

export function Sidebar({ mobileOpen, onCloseMobile, onDesktopHoverExpandedChange }: SidebarProps) {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const isCollapsed = useAppSelector(selectSidebarCollapsed)
  const currentUser = useAppSelector(selectCurrentUser)
  const { data: menuResponse, isFetching, isError } = useGetMenusQuery()
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({})
  const profileOverlayRef = useRef<OverlayPanel>(null)
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false)
  const [isHoverExpanded, setIsHoverExpanded] = useState(false)

  const ToggleIcon = isCollapsed ? PanelLeftOpen : PanelLeftClose
  const menus = useMemo(
    () =>
      sortMenus(filterMenusByPermission(menuResponse ?? [], currentUser?.permissions)).filter(
        (item) => item.route !== '/dashboard',
      ),
    [currentUser?.permissions, menuResponse],
  )
  const isDesktopCompact = isCollapsed && !isHoverExpanded
  const hoverOverlayStyle =
    isCollapsed && isHoverExpanded
      ? {
          backgroundColor: 'color-mix(in srgb, var(--color-surface) 78%, transparent)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
        }
      : undefined

  useEffect(() => {
    const activeKeys = collectActiveMenuKeys(menus, location.pathname)
    if (!activeKeys.length) {
      return
    }

    setOpenMenus((current) => {
      let changed = false
      const next = { ...current }

      for (const key of activeKeys) {
        if (!next[key]) {
          next[key] = true
          changed = true
        }
      }

      return changed ? next : current
    })
  }, [location.pathname, menus])

  const toggleMenu = (key: string) => {
    setOpenMenus((current) => ({
      ...current,
      [key]: !current[key],
    }))
  }

  const collapseHoveredSidebar = () => {
    if (!isCollapsed) {
      return
    }

    profileOverlayRef.current?.hide()
    setIsHoverExpanded(false)
    onDesktopHoverExpandedChange(false)
  }

  const expandHoveredSidebar = () => {
    if (!isCollapsed) {
      return
    }

    setIsHoverExpanded(true)
    onDesktopHoverExpandedChange(true)
  }

  const handleConfirmedLogout = () => {
    setIsLogoutDialogOpen(false)
    onCloseMobile()
    collapseHoveredSidebar()
    dispatch(logout())
    navigate('/login', { replace: true })
  }

  const confirmLogout = () => {
    profileOverlayRef.current?.hide()
    setIsLogoutDialogOpen(true)
  }

  const toggleProfileOverlay = (event: ReactMouseEvent<HTMLButtonElement>) => {
    profileOverlayRef.current?.toggle(event)
  }

  const openRoute = (path: string) => {
    profileOverlayRef.current?.hide()
    onCloseMobile()
    collapseHoveredSidebar()
    navigate(path)
  }

const accountActionClassName =
    'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-hover)]'

  const renderAccountActions = () => (
    <>
      <button
        type="button"
        className={accountActionClassName}
        onClick={() => openRoute('/profile')}
      >
        <UserRound className="h-4 w-4" />
        Account
      </button>
      <button
        type="button"
        className={accountActionClassName}
        onClick={() => openRoute('/settings')}
      >
        <Settings className="h-4 w-4" />
        Settings
      </button>
      <button
        type="button"
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-[var(--color-danger-text)] hover:bg-[var(--color-danger-soft)]"
        onClick={confirmLogout}
      >
        <LogOut className="h-4 w-4" />
        Log out
      </button>
    </>
  )

  const navLinkClassName = (
    { isActive }: { isActive: boolean },
    compact = false,
  ) =>
    cn(
      'flex items-center gap-2 rounded-lg px-2 py-3 text-sm font-medium text-[var(--color-text)] transition-colors',
      'hover:bg-[var(--color-hover)] hover:text-[var(--color-text-strong)]',
      isActive && 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]',
      compact && 'justify-center',
    )

  const renderLeafMenu = (
    item: AppMenuItem,
    options: { compact?: boolean; isSubmenu?: boolean; closeOnNavigate?: boolean; depth?: number } = {},
  ) => {
    const Icon = resolveMenuIcon(item.iconName)
    const title = getMenuTitle(item)
    const { compact = false, isSubmenu = false, closeOnNavigate = false, depth = 0 } = options
    const handleNavigate = () => {
      collapseHoveredSidebar()

      if (closeOnNavigate) {
        onCloseMobile()
      }
    }

    return (
      <NavLink
        key={getMenuKey(item)}
        to={item.route || '#'}
        title={title}
        className={(state) =>
          cn(navLinkClassName(state, compact), !compact && depth > 1 && 'py-2 text-[13px]')
        }
        style={!compact && depth > 1 ? { paddingLeft: `${Math.min(depth - 1, 3) * 0.75 + 0.5}rem` } : undefined}
        onClick={isCollapsed || closeOnNavigate ? handleNavigate : undefined}
      >
        <Icon className={cn('h-5 w-5 shrink-0', isSubmenu && !compact && 'h-4 w-4')} aria-hidden="true" />
        {!compact ? <span className="truncate">{title}</span> : null}
      </NavLink>
    )
  }

  const renderMenu = (
    item: AppMenuItem,
    options: { compact?: boolean; closeOnNavigate?: boolean; depth?: number } = {},
  ) => {
    const children = item.submenu ?? []
    const { compact = false, closeOnNavigate = false, depth = 0 } = options

    if (!children.length) {
      return renderLeafMenu(item, { compact, closeOnNavigate, depth })
    }

    const key = getMenuKey(item)
    const Icon = resolveMenuIcon(item.iconName)
    const title = getMenuTitle(item)
    const hasActiveChild = hasActiveRoute(item, location.pathname)

    if (compact) {
      return (
        <div key={key} className="space-y-1">
          <button
            type="button"
            title={title}
            aria-label={title}
            className={cn(navLinkClassName({ isActive: hasActiveChild }, true), 'w-full')}
            onClick={expandHoveredSidebar}
          >
            <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
          </button>
        </div>
      )
    }

    const isOpen = openMenus[key] ?? false

    return (
      <div key={key} className="space-y-1">
        <button
          type="button"
          className={cn(
            'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm font-medium text-[var(--color-text)] transition-colors',
            'hover:bg-[var(--color-hover)] hover:text-[var(--color-text-strong)]',
            hasActiveChild && 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]',
            depth > 0 && 'text-[13px]',
          )}
          onClick={() => toggleMenu(key)}
          style={depth > 0 ? { paddingLeft: `${Math.min(depth, 3) * 0.75 + 0.5}rem` } : undefined}
        >
          <Icon className={cn('h-5 w-5 shrink-0', depth > 0 && 'h-4 w-4')} aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">{title}</span>
          <ChevronDown
            className={cn('h-4 w-4 shrink-0 transition-transform', isOpen && 'rotate-180')}
            aria-hidden="true"
          />
        </button>

        {isOpen ? (
          <div className={cn('space-y-1 border-l border-[var(--color-border)] pl-3', depth > 0 ? 'ml-3' : 'ml-5')}>
            {children.map((child) =>
              renderMenu(child, {
                compact,
                closeOnNavigate,
                depth: depth + 1,
              }),
            )}
          </div>
        ) : null}
      </div>
    )
  }

  const desktopSidebar = (
    <aside
      className={cn(
        'relative hidden h-screen shrink-0 overflow-visible lg:block',
        isCollapsed ? 'w-20' : 'w-72',
      )}
    >
      <div
        onMouseEnter={expandHoveredSidebar}
        onMouseLeave={collapseHoveredSidebar}
        className={cn(
          'absolute inset-y-0 left-0 flex h-full max-h-screen flex-col overflow-hidden border-r border-[var(--color-border)] bg-[var(--color-surface)] transition-[width,box-shadow] duration-200',
          isDesktopCompact ? 'w-20' : 'w-72',
          isCollapsed && isHoverExpanded && 'z-30 shadow-xl',
        )}
        style={hoverOverlayStyle}
      >
        <div
          className={cn(
            'flex h-14 items-center border-b border-[var(--color-border)] px-3',
            isDesktopCompact ? 'justify-center' : 'justify-between',
          )}
        >
          {!isDesktopCompact ? (
            <div className="flex min-w-0 flex-1 items-center">
              <BrandLogo variant="full" className="h-10 max-w-40" />
            </div>
          ) : null}
          <Button
            type="button"
            text
            rounded
            severity="secondary"
            aria-label="Toggle sidebar"
            className="h-12 w-12 shrink-0 p-0"
            onClick={() => {
              setIsHoverExpanded(false)
              onDesktopHoverExpandedChange(false)
              dispatch(toggleSidebar())
            }}
          >
            <ToggleIcon className="h-7 w-7" aria-hidden="true" />
          </Button>
        </div>

        <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
          {isFetching ? (
            <p className={cn('px-3 py-2 text-sm text-[var(--color-text-muted)]', isDesktopCompact && 'sr-only')}>
              Loading menus
            </p>
          ) : null}
          {isError ? (
            <p className={cn('px-3 py-2 text-sm text-red-600', isDesktopCompact && 'sr-only')}>
              Menus unavailable
            </p>
          ) : null}
          {menus.map((item) => renderMenu(item, { compact: isDesktopCompact }))}
        </nav>

        <div className="mt-auto shrink-0 border-t border-[var(--color-border)] p-2">
          <button
            type="button"
            className={cn(
              'flex w-full items-center gap-2 rounded-lg p-1.5 text-left transition-colors hover:bg-[var(--color-hover)]',
              isDesktopCompact && 'justify-center',
            )}
            onClick={toggleProfileOverlay}
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--color-primary)] text-xs font-semibold text-white">
              {getUserInitials(currentUser)}
            </span>
            {!isDesktopCompact ? (
              <>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--color-text-strong)]">
                    {currentUser?.name ?? 'User'}
                  </p>
                  {currentUser?.email ? (
                    <p className="truncate text-[11px] text-[var(--color-text-muted)]">{currentUser.email}</p>
                  ) : null}
                </div>
                <ChevronsUpDown className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
              </>
            ) : null}
          </button>

          <OverlayPanel ref={profileOverlayRef} className="w-64">
            <div className="space-y-1 py-1">{renderAccountActions()}</div>
          </OverlayPanel>
        </div>
      </div>
    </aside>
  )

  const mobileSidebar = (
    <>
      <button
        type="button"
        aria-label="Close menu overlay"
        className={cn(
          'fixed inset-0 z-30 bg-neutral-950/40 transition-opacity lg:hidden',
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onCloseMobile}
      />
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-72 max-w-[85vw] flex-col overflow-hidden border-r border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl transition-transform duration-200 lg:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-14 items-center justify-between border-b border-[var(--color-border)] px-3">
          <BrandLogo variant="full" className="h-10 max-w-40" />
          <Button
            type="button"
            text
            rounded
            severity="secondary"
            aria-label="Close menu"
            className="h-12 w-12 shrink-0 p-0"
            onClick={onCloseMobile}
          >
            <X className="h-6 w-6" aria-hidden="true" />
          </Button>
        </div>

        <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
          {isFetching ? <p className="px-3 py-2 text-sm text-[var(--color-text-muted)]">Loading menus</p> : null}
          {isError ? <p className="px-3 py-2 text-sm text-red-600">Menus unavailable</p> : null}
          {menus.map((item) => renderMenu(item, { closeOnNavigate: true }))}
        </nav>

        <div className="mt-auto shrink-0 border-t border-[var(--color-border)] p-3">
          <div className="flex items-center gap-3 rounded-lg bg-[var(--color-surface-muted)] p-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[var(--color-primary)] text-sm font-semibold text-white">
              {getUserInitials(currentUser)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[var(--color-text-strong)]">
                {currentUser?.name ?? 'User'}
              </p>
              {currentUser?.email ? (
                <p className="truncate text-xs text-[var(--color-text-muted)]">{currentUser.email}</p>
              ) : null}
            </div>
          </div>

          <div className="mt-3 space-y-1">{renderAccountActions()}</div>
        </div>
      </aside>
    </>
  )

  return (
    <>
      {mobileSidebar}
      {desktopSidebar}

      <ConfirmationDialog
        open={isLogoutDialogOpen}
        title="Logout?"
        message="Your current session will be closed. You can sign in again whenever you need access."
        confirmLabel="Logout"
        cancelLabel="Cancel"
        tone="danger"
        onClose={() => setIsLogoutDialogOpen(false)}
        onConfirm={handleConfirmedLogout}
      />
    </>
  )
}
