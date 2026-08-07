import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { logout, selectCurrentUser } from '@/features/auth/authSlice'
import { DEVOTEE_LANGUAGES } from '@/features/devotee/i18n/devoteeTranslations'
import { useDevoteeLanguage } from '@/features/devotee/i18n/useDevoteeLanguage'
import '@/features/devotee/styles/devoteePortal.css'
import { useAppDispatch, useAppSelector } from '@/hooks/redux'
import { useToast } from '@/hooks/useToast'

const NAV_ITEMS: { to: string; labelKey: 'navHome' | 'navDarshan' | 'navSeva' | 'navAccommodation' | 'navPrasadam' | 'navDonations' | 'navLive' | 'navBookings' | 'navFacilities' }[] = [
  { to: '/devotee/dashboard', labelKey: 'navHome' },
  { to: '/devotee/darshan', labelKey: 'navDarshan' },
  { to: '/devotee/seva', labelKey: 'navSeva' },
  { to: '/devotee/accommodation', labelKey: 'navAccommodation' },
  { to: '/devotee/prasadam', labelKey: 'navPrasadam' },
  { to: '/devotee/donations', labelKey: 'navDonations' },
  { to: '/devotee/live', labelKey: 'navLive' },
  { to: '/devotee/bookings', labelKey: 'navBookings' },
  { to: '/devotee/facilities', labelKey: 'navFacilities' },
]

export function DevoteeLayout() {
  const { t, language, setLanguage } = useDevoteeLanguage()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const user = useAppSelector(selectCurrentUser)

  const handleLogout = () => {
    dispatch(logout())
    showToast({ severity: 'info', summary: t('navLogout'), detail: t('logoutSuccess') })
    navigate('/devotee/login', { replace: true })
  }

  return (
    <div className="devotee-portal">
      <div className="dp-lang-strip">
        <span className="dp-lang-icon" aria-hidden="true">
          🕉️
        </span>
        {DEVOTEE_LANGUAGES.map((option, index) => (
          <span key={option.code} style={{ display: 'flex', alignItems: 'center' }}>
            {index > 0 ? <span className="dp-sep">|</span> : null}
            <button
              type="button"
              className={language === option.code ? 'active' : ''}
              onClick={() => setLanguage(option.code)}
            >
              {option.label}
            </button>
          </span>
        ))}
      </div>

      <header className="dp-header">
        <NavLink to="/devotee/dashboard" className="dp-brand">
          <svg viewBox="0 0 40 40" width="30" height="30" aria-hidden="true">
            <path d="M20 2 L26 14 L14 14 Z" fill="#7c1220" />
            <rect x="16" y="14" width="8" height="18" fill="#a9790c" />
            <circle cx="20" cy="34" r="3" fill="#c1421a" />
          </svg>
          <span>
            <span className="dp-brand-name" style={{ display: 'block' }}>
              {t('appName')}
            </span>
            <span className="dp-brand-subtitle" style={{ display: 'block' }}>
              {t('appTagline').toUpperCase()}
            </span>
          </span>
        </NavLink>

        <nav className="dp-nav">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? 'active' : '')}>
              {t(item.labelKey)}
            </NavLink>
          ))}
        </nav>

        <div className="dp-header-actions">
          <NavLink to="/devotee/profile" className="dp-icon-btn">
            {user?.name ?? t('navProfile')}
          </NavLink>
          <button type="button" className="dp-icon-btn" onClick={handleLogout}>
            {t('navLogout')}
          </button>
        </div>
      </header>

      <main>
        <Outlet />
      </main>

      <footer className="dp-footer">
        <div className="dp-footer-grid">
          <div>
            <h4>{t('appName')}</h4>
            <p>{t('footerAddress')}</p>
            <p>{t('footerHelpline')}</p>
          </div>
          <div>
            <h4>{t('footerQuickLinks')}</h4>
            <p>
              <NavLink to="/devotee/darshan">{t('navDarshan')}</NavLink>
            </p>
            <p>
              <NavLink to="/devotee/seva">{t('navSeva')}</NavLink>
            </p>
            <p>
              <NavLink to="/devotee/donations">{t('navDonations')}</NavLink>
            </p>
            <p>
              <NavLink to="/devotee/facilities">{t('navFacilities')}</NavLink>
            </p>
          </div>
          <div>
            <h4>{t('footerContact')}</h4>
            <p>{t('footerPrivacyPolicy')}</p>
            <p>{t('footerTerms')}</p>
          </div>
        </div>
        <div className="dp-footer-bottom">
          <span>{t('footerCopyright')}</span>
        </div>
      </footer>
    </div>
  )
}
