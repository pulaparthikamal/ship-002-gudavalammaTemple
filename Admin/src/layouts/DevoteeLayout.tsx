import { useEffect } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { logout, selectCurrentUser, selectIsAuthenticated } from '@/features/auth/authSlice'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { useDevoteeTranslation } from '@/i18n/useTranslation'
import '@/features/devotee/styles/devoteePortal.css'
import { useAppDispatch, useAppSelector } from '@/hooks/redux'
import { useToast } from '@/hooks/useToast'
import { useGetTempleProfileQuery } from '@/services/api/endpoints/templeProfileApi'
import { resolveTempleName } from '@/utils/templeName'
import { trackClick, trackPageview } from '@/utils/analytics'

const SOCIAL_ICONS: { key: 'facebook' | 'instagram' | 'youtube' | 'twitter' | 'whatsapp'; icon: string; label: string }[] = [
  { key: 'facebook', icon: '📘', label: 'Facebook' },
  { key: 'instagram', icon: '📷', label: 'Instagram' },
  { key: 'youtube', icon: '▶️', label: 'YouTube' },
  { key: 'twitter', icon: '🐦', label: 'Twitter' },
  { key: 'whatsapp', icon: '💬', label: 'WhatsApp' },
]

const NAV_ITEMS: {
  to: string
  labelKey:
    | 'devotee.navHome'
    | 'devotee.navDarshan'
    | 'devotee.navSeva'
    | 'devotee.navAccommodation'
    | 'devotee.navPrasadam'
    | 'devotee.navDonations'
    | 'devotee.navLive'
    | 'devotee.navBookings'
    | 'devotee.navFacilities'
    | 'devotee.navEvents'
    | 'devotee.navNearbyPlaces'
  trackLabel?: string
}[] = [
  { to: '/', labelKey: 'devotee.navHome' },
  { to: '/devotee/darshan', labelKey: 'devotee.navDarshan', trackLabel: 'nav_darshan' },
  { to: '/devotee/seva', labelKey: 'devotee.navSeva', trackLabel: 'nav_seva' },
  { to: '/devotee/accommodation', labelKey: 'devotee.navAccommodation', trackLabel: 'nav_accommodation' },
  { to: '/devotee/prasadam', labelKey: 'devotee.navPrasadam', trackLabel: 'nav_prasadam' },
  { to: '/devotee/donations', labelKey: 'devotee.navDonations', trackLabel: 'nav_donations' },
  { to: '/devotee/events', labelKey: 'devotee.navEvents', trackLabel: 'nav_events' },
  { to: '/devotee/live', labelKey: 'devotee.navLive', trackLabel: 'nav_live' },
  { to: '/devotee/bookings', labelKey: 'devotee.navBookings', trackLabel: 'nav_bookings' },
  { to: '/devotee/facilities', labelKey: 'devotee.navFacilities', trackLabel: 'nav_facilities' },
  { to: '/devotee/nearby-places', labelKey: 'devotee.navNearbyPlaces', trackLabel: 'nav_nearby_places' },
]

export function DevoteeLayout() {
  const { t, language } = useDevoteeTranslation()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const { showToast } = useToast()
  const user = useAppSelector(selectCurrentUser)
  const isAuthenticated = useAppSelector(selectIsAuthenticated)
  const { data: templeProfile } = useGetTempleProfileQuery()

  useEffect(() => {
    trackPageview(location.pathname)
  }, [location.pathname])

  const handleLogout = () => {
    dispatch(logout())
    showToast({ severity: 'info', summary: t('devotee.navLogout'), detail: t('devotee.logoutSuccess') })
    navigate('/devotee/login', { replace: true })
  }

  return (
    <div className="devotee-portal">
      <div className="dp-lang-strip">
        <span className="dp-lang-icon" aria-hidden="true">
          🕉️
        </span>
        <LanguageSwitcher audience="devotee" className="dp-lang-select" />
      </div>

      <header className="dp-header">
        <NavLink to="/" className="dp-brand">
          <svg viewBox="0 0 40 40" width="30" height="30" aria-hidden="true">
            <path d="M20 2 L26 14 L14 14 Z" fill="#7c1220" />
            <rect x="16" y="14" width="8" height="18" fill="#a9790c" />
            <circle cx="20" cy="34" r="3" fill="#c1421a" />
          </svg>
          <span>
            <span className="dp-brand-name" style={{ display: 'block' }}>
              {resolveTempleName(templeProfile, language, t('devotee.appName'))}
            </span>
            <span className="dp-brand-subtitle" style={{ display: 'block' }}>
              {t('devotee.appTagline').toUpperCase()}
            </span>
          </span>
        </NavLink>

        <nav className="dp-nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => (isActive ? 'active' : '')}
              onClick={() => item.trackLabel && trackClick(location.pathname, item.trackLabel)}
            >
              {t(item.labelKey)}
            </NavLink>
          ))}
        </nav>

        <div className="dp-header-actions">
          {isAuthenticated ? (
            <>
              <NavLink to="/devotee/profile" className="dp-icon-btn">
                {user?.name ?? t('devotee.navProfile')}
              </NavLink>
              <button type="button" className="dp-icon-btn" onClick={handleLogout}>
                {t('devotee.navLogout')}
              </button>
            </>
          ) : (
            <>
              <NavLink to="/devotee/login" className="dp-icon-btn">
                {t('devotee.homeDevoteeLoginCta')}
              </NavLink>
              <NavLink to="/login" className="dp-icon-btn dp-icon-btn-primary">
                {t('devotee.homeStaffLoginCta')}
              </NavLink>
            </>
          )}
        </div>
      </header>

      <main>
        <Outlet />
      </main>

      <footer className="dp-footer">
        <div className="dp-footer-grid">
          <div>
            <h4>{resolveTempleName(templeProfile, language, t('devotee.appName'))}</h4>
            <p>{templeProfile?.address ?? t('devotee.footerAddress')}</p>
            <p>{templeProfile?.helpline ?? t('devotee.footerHelpline')}</p>
            {templeProfile?.socialLinks && (
              <div className="dp-social-links">
                {SOCIAL_ICONS.filter((s) => templeProfile.socialLinks?.[s.key]).map((s) => (
                  <a
                    key={s.key}
                    href={templeProfile.socialLinks?.[s.key]}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.label}
                    className="dp-social-link"
                  >
                    {s.icon}
                  </a>
                ))}
              </div>
            )}
          </div>
          <div>
            <h4>{t('devotee.footerQuickLinks')}</h4>
            <p>
              <NavLink to="/devotee/darshan">{t('devotee.navDarshan')}</NavLink>
            </p>
            <p>
              <NavLink to="/devotee/seva">{t('devotee.navSeva')}</NavLink>
            </p>
            <p>
              <NavLink to="/devotee/donations">{t('devotee.navDonations')}</NavLink>
            </p>
            <p>
              <NavLink to="/devotee/facilities">{t('devotee.navFacilities')}</NavLink>
            </p>
          </div>
          <div>
            <h4>{t('devotee.footerContact')}</h4>
            {(templeProfile?.contactEmails ?? []).map((email) => (
              <p key={email}>
                <a href={`mailto:${email}`}>{email}</a>
              </p>
            ))}
            <p>{t('devotee.footerPrivacyPolicy')}</p>
            <p>{t('devotee.footerTerms')}</p>
          </div>
        </div>
        <div className="dp-footer-bottom">
          <span>{t('devotee.footerCopyright', { templeName: resolveTempleName(templeProfile, language, t('devotee.appName')) })}</span>
        </div>
      </footer>
    </div>
  )
}
