import { useState, useEffect } from 'react'
import axios from 'axios'
import { ColorPicker } from 'primereact/colorpicker'
import { Dropdown } from 'primereact/dropdown'
import { InputText } from 'primereact/inputtext'
import { Button } from 'primereact/button'
import { Message } from 'primereact/message'
import { Dialog } from 'primereact/dialog'
import { Password } from 'primereact/password'
import { PageHeader } from '@/components/ui/PageHeader'
import { Loader2, ChevronDown, ChevronRight, Settings2, Zap } from 'lucide-react'
import {
  setDensity,
  setLocale,
  setPrimaryColor,
  setTheme,
  selectPreferences,
} from '@/features/preferences/preferencesSlice'
import type { AppDensity, AppTheme } from '@/features/preferences/preferencesSlice'
import { useAppDispatch, useAppSelector } from '@/hooks/redux'
import { selectCurrentUser } from '@/features/auth/authSlice'
import { useGetSettingsQuery, useUpdateSettingMutation } from '@/services/api/endpoints/settingsApi'
import { normalizeHexColor } from '@/utils/themeColors'
import { AUTH_BASE_URL } from '@/services/api/apiConfig'
import { useGetPlatformConfigsQuery, useUpdatePlatformConfigMutation, useDeletePlatformConfigMutation } from '@/services/api/endpoints/platformConfigApi'
import { useGetPlatformsQuery } from '@/services/api/endpoints/platformsApi'
import { PlatformIcon } from '@/components/ui/PlatformIcon'
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog'
import type { Platform } from '@/types/platform'

const themeOptions: Array<{ label: string; value: AppTheme }> = [
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
  { label: 'System', value: 'system' },
]

const densityOptions: Array<{ label: string; value: AppDensity }> = [
  { label: 'Comfortable', value: 'comfortable' },
  { label: 'Compact', value: 'compact' },
]

const localeOptions = [
  { label: 'English (US)', value: 'en-US' },
  { label: 'English (India)', value: 'en-IN' },
]

// ─── Connection status for a single platform ─────────────────────────────────
interface PlatformConnection {
  isConnected: boolean
  accountName: string
  isChecking: boolean
}

const defaultConnection: PlatformConnection = {
  isConnected: false,
  accountName: '',
  isChecking: true,
}

export function SettingsPage() {
  const dispatch = useAppDispatch()
  const preferences = useAppSelector(selectPreferences)
  const user = useAppSelector(selectCurrentUser)

  const { data: settings, isLoading: isLoadingSettings } = useGetSettingsQuery()
  const [updateSetting, { isLoading: isUpdating }] = useUpdateSettingMutation()

  const [sessionExpiry, setSessionExpiry] = useState<string>('')
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Platform connection states — keyed by normalized platform key
  const [connections, setConnections] = useState<Record<string, PlatformConnection>>({})

  // Advanced Developer Settings
  const [showAdvanced, setShowAdvanced] = useState(false)
  const { data: platformConfigsResponse, refetch: refetchConfigs } = useGetPlatformConfigsQuery()
  const [updatePlatformConfig, { isLoading: isUpdatingConfig }] = useUpdatePlatformConfigMutation()
  const [deletePlatformConfig, { isLoading: isDeletingConfig }] = useDeletePlatformConfigMutation()
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [showResetConfigDialog, setShowResetConfigDialog] = useState(false)
  const [selectedPlatform, setSelectedPlatform] = useState<string>('')
  const [configForm, setConfigForm] = useState({
    clientId: '',
    clientSecret: '',
    redirectUri: '',
  })

  const { data: platformsList = [] } = useGetPlatformsQuery()

  // ─── Connection checkers ────────────────────────────────────────────────────

  const setConnectionState = (key: string, patch: Partial<PlatformConnection>) => {
    setConnections((prev) => ({
      ...prev,
      [key]: { ...(prev[key] ?? defaultConnection), ...patch },
    }))
  }

  const checkFacebookConnection = async (userId: string) => {
    setConnectionState('facebook', { isChecking: true })
    try {
      const res = await axios.get(`${AUTH_BASE_URL}/auth/facebook/pages?userId=${userId}`)
      if (res.data.success && res.data.data?.length > 0) {
        setConnectionState('facebook', {
          isConnected: true,
          accountName: res.data.data[0].pageName || 'Facebook Page',
          isChecking: false,
        })
      } else {
        setConnectionState('facebook', { isConnected: false, accountName: '', isChecking: false })
      }
    } catch {
      setConnectionState('facebook', { isConnected: false, accountName: '', isChecking: false })
    }
  }

  const checkInstagramConnection = async (userId: string) => {
    setConnectionState('instagram', { isChecking: true })
    try {
      const res = await axios.get(`${AUTH_BASE_URL}/auth/instagram/accounts?userId=${userId}`)
      if (res.data.success && res.data.data?.length > 0) {
        const acct = res.data.data[0]
        setConnectionState('instagram', {
          isConnected: true,
          accountName: acct.username || acct.name || 'Instagram Account',
          isChecking: false,
        })
      } else {
        setConnectionState('instagram', { isConnected: false, accountName: '', isChecking: false })
      }
    } catch {
      setConnectionState('instagram', { isConnected: false, accountName: '', isChecking: false })
    }
  }

  const checkLinkedInConnection = async (userId: string) => {
    setConnectionState('linkedin', { isChecking: true })
    try {
      const res = await axios.get(`${AUTH_BASE_URL}/auth/linkedin/status?userId=${userId}`)
      if (res.data.success && res.data.data?.length > 0) {
        setConnectionState('linkedin', {
          isConnected: true,
          accountName: res.data.data[0].name || 'LinkedIn User',
          isChecking: false,
        })
      } else {
        setConnectionState('linkedin', { isConnected: false, accountName: '', isChecking: false })
      }
    } catch {
      setConnectionState('linkedin', { isConnected: false, accountName: '', isChecking: false })
    }
  }

  const checkYouTubeConnection = async (userId: string) => {
    setConnectionState('youtube', { isChecking: true })
    try {
      const res = await axios.get(`${AUTH_BASE_URL}/auth/youtube/status?userId=${userId}`)
      if (res.data.success && res.data.data?.length > 0) {
        setConnectionState('youtube', {
          isConnected: true,
          accountName: res.data.data[0].name || 'YouTube Channel',
          isChecking: false,
        })
      } else {
        setConnectionState('youtube', { isConnected: false, accountName: '', isChecking: false })
      }
    } catch {
      setConnectionState('youtube', { isConnected: false, accountName: '', isChecking: false })
    }
  }

  useEffect(() => {
    if (!user?.id) return
    checkFacebookConnection(user.id)
    checkInstagramConnection(user.id)
    checkLinkedInConnection(user.id)
    checkYouTubeConnection(user.id)
  }, [user?.id])

  // ─── Connect / Disconnect handlers ─────────────────────────────────────────

  const handleConnect = (platformKey: string) => {
    const userId = user?.id || ''
    if (platformKey === 'linkedin') {
      const conn = connections['linkedin']
      if (conn?.isConnected) {
        const logoutWin = window.open('https://www.linkedin.com/m/logout/', '_blank', 'width=600,height=600')
        setTimeout(() => {
          if (logoutWin) logoutWin.close()
          window.location.href = `${AUTH_BASE_URL}/auth/linkedin?userId=${userId}`
        }, 2500)
        return
      }
    }
    window.location.href = `${AUTH_BASE_URL}/auth/${platformKey}?userId=${userId}`
  }

  const handleDisconnect = async (platformKey: string) => {
    const userId = user?.id
    if (!userId) return
    try {
      if (platformKey === 'linkedin') {
        await axios.delete(`${AUTH_BASE_URL}/auth/linkedin/disconnect?userId=${userId}`)
        setConnectionState('linkedin', { isConnected: false, accountName: '' })
      } else if (platformKey === 'youtube') {
        await axios.delete(`${AUTH_BASE_URL}/auth/youtube/disconnect?userId=${userId}`)
        setConnectionState('youtube', { isConnected: false, accountName: '' })
      }
    } catch (err) {
      console.error(`Failed to disconnect ${platformKey}:`, err)
    }
  }

  // ─── Per-platform meta ──────────────────────────────────────────────────────

  const getPlatformMeta = (key: string) => {
    const descriptions: Record<string, string> = {
      facebook: 'Post updates, images & videos to your Facebook Pages.',
      instagram: 'Publish images and reels to your Instagram professional account.',
      linkedin: 'Share articles, images & videos with your LinkedIn network.',
      youtube: 'Upload and manage videos on your YouTube channel.',
      twitter: 'Tweet and thread posts from the dashboard.',
    }
    const hasDisconnect = ['linkedin', 'youtube'].includes(key)
    return {
      description: descriptions[key] ?? `Connect your ${key} account.`,
      hasDisconnect,
    }
  }

  // ─── Settings ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (settings) {
      const exp = settings.find((s) => s.key === 'SESSION_EXPIRY')
      if (exp) setSessionExpiry(String(exp.value))
    }
  }, [settings])

  const handleSaveSessionExpiry = async () => {
    try {
      await updateSetting({ key: 'SESSION_EXPIRY', data: { value: sessionExpiry } }).unwrap()
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (error) {
      console.error('Failed to update session expiry:', error)
    }
  }

  // ─── Developer credentials modal ───────────────────────────────────────────

  const openConfigModal = (platform: string) => {
    setSelectedPlatform(platform)
    const existing = platformConfigsResponse?.data?.find((c) => c.platform === platform)
    setConfigForm({
      clientId: existing?.clientId || '',
      clientSecret: existing?.clientSecret || '',
      redirectUri: existing?.redirectUri || '',
    })
    setShowConfigModal(true)
  }

  const handleSaveConfig = async () => {
    try {
      await updatePlatformConfig({ platform: selectedPlatform, ...configForm }).unwrap()
      setShowConfigModal(false)
      refetchConfigs()
    } catch (error) {
      console.error('Failed to update platform config:', error)
    }
  }

  const handleResetConfig = async () => {
    try {
      await deletePlatformConfig(selectedPlatform).unwrap()
      setShowResetConfigDialog(false)
      setShowConfigModal(false)
      refetchConfigs()
    } catch (error) {
      console.error('Failed to reset platform config:', error)
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-full space-y-8">
      <PageHeader
        eyebrow="Settings"
        title="Application settings"
        description="Manage workspace preferences and system configurations."
      />

      {/* ── Workspace Preferences ────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-[var(--color-text-strong)]">Workspace Preferences</h2>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--color-text-strong)]" htmlFor="settings-theme">
                Theme
              </label>
              <Dropdown
                inputId="settings-theme"
                value={preferences.theme}
                options={themeOptions}
                optionLabel="label"
                optionValue="value"
                onChange={(e) => dispatch(setTheme(e.value as AppTheme))}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--color-text-strong)]" htmlFor="settings-density">
                Density
              </label>
              <Dropdown
                inputId="settings-density"
                value={preferences.density}
                options={densityOptions}
                optionLabel="label"
                optionValue="value"
                onChange={(e) => dispatch(setDensity(e.value as AppDensity))}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--color-text-strong)]" htmlFor="settings-locale">
                Locale
              </label>
              <Dropdown
                inputId="settings-locale"
                value={preferences.locale}
                options={localeOptions}
                optionLabel="label"
                optionValue="value"
                onChange={(e) => dispatch(setLocale(String(e.value)))}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--color-text-strong)]" htmlFor="settings-primary-color">
                Primary accent color
              </label>
              <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3">
                <ColorPicker
                  inputId="settings-primary-color"
                  format="hex"
                  value={preferences.primaryColor?.replace('#', '')}
                  onChange={(e) => dispatch(setPrimaryColor(normalizeHexColor(String(e.value))))}
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--color-text-strong)]">
                    {normalizeHexColor(preferences.primaryColor).toUpperCase()}
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Updates buttons, hover, active, focus, and accent surfaces instantly.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── System Settings ───────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-[var(--color-text-strong)]">System Settings</h2>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--color-text-strong)]" htmlFor="session-expiry">
                Session Expiry (minutes)
              </label>
              <div className="flex gap-2">
                <InputText
                  id="session-expiry"
                  value={sessionExpiry}
                  onChange={(e) => setSessionExpiry(e.target.value)}
                  disabled={isLoadingSettings}
                  className="flex-1"
                  placeholder="e.g. 15"
                />
                <Button
                  label="Save"
                  icon="pi pi-check"
                  onClick={handleSaveSessionExpiry}
                  loading={isUpdating}
                  disabled={isLoadingSettings}
                  className="flex items-center gap-1"
                />
              </div>
              {saveSuccess && (
                <Message severity="success" text="Session expiry updated successfully!" className="mt-2 w-full justify-start" />
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Social Media Integration ──────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-[var(--color-text-strong)]">Social Media Accounts</h2>
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-primary-muted,#eff6ff)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-primary)]">
            <Zap size={11} />
            One-click connect
          </span>
        </div>
        <p className="text-sm text-[var(--color-text-muted)] -mt-2">
          Link your social accounts in a single step — just click Connect and approve the permissions on the platform's login screen.
        </p>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {platformsList.filter((p) => p.active).map((p: Platform) => {
            const key = p.name.toLowerCase().replace(/\s+/g, '').replace('(x)', '')
            const conn: PlatformConnection = connections[key] ?? defaultConnection
            const { description, hasDisconnect } = getPlatformMeta(key)

            return (
              <div
                key={p._id.toString()}
                className="relative flex flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                {/* Platform header */}
                <div className="flex items-start justify-between mb-3">
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-xl shadow-sm"
                    style={{ backgroundColor: p.color ? `${p.color}18` : 'var(--color-surface-muted)' }}
                  >
                    <PlatformIcon icon={p.icon} svg={p.svg} color={p.color || 'var(--color-primary)'} size={22} />
                  </div>

                  {/* Connection badge */}
                  {conn.isChecking ? (
                    <span className="flex items-center gap-1.5 rounded-full border border-[var(--color-border)] px-2.5 py-1 text-xs text-[var(--color-text-muted)]">
                      <Loader2 size={11} className="animate-spin" />
                      Checking…
                    </span>
                  ) : conn.isConnected ? (
                    <span className="flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                      Connected
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-2.5 py-1 text-xs text-[var(--color-text-muted)]">
                      <span className="h-1.5 w-1.5 rounded-full bg-gray-300" />
                      Not linked
                    </span>
                  )}
                </div>

                {/* Platform name + account name */}
                <p className="text-sm font-semibold text-[var(--color-text-strong)] mb-0.5">{p.name}</p>
                {conn.isConnected && conn.accountName && (
                  <p className="text-xs font-medium text-green-600 mb-1 truncate">@{conn.accountName}</p>
                )}
                <p className="text-xs text-[var(--color-text-muted)] leading-relaxed mb-4 flex-1">{description}</p>

                {/* Actions */}
                <div className="flex flex-col gap-2">
                  <Button
                    id={`connect-${key}-btn`}
                    label={conn.isConnected ? `Reconnect ${p.name}` : `Connect ${p.name}`}
                    icon={
                      <PlatformIcon
                        icon={p.icon}
                        svg={p.svg}
                        color={conn.isConnected ? (p.color || '#1e293b') : '#fff'}
                        size={15}
                        className="mr-2"
                      />
                    }
                    className="w-full p-button-sm flex items-center justify-center"
                    onClick={() => handleConnect(key)}
                    style={{
                      backgroundColor: conn.isConnected ? 'var(--color-surface-muted)' : (p.color || 'var(--color-primary)'),
                      color: conn.isConnected ? 'var(--color-text-strong)' : '#fff',
                      border: conn.isConnected ? '1px solid var(--color-border)' : 'none',
                    }}
                  />
                  {conn.isConnected && hasDisconnect && (
                    <Button
                      id={`disconnect-${key}-btn`}
                      label="Disconnect"
                      icon="pi pi-times"
                      severity="danger"
                      outlined
                      size="small"
                      className="w-full p-button-sm"
                      onClick={() => handleDisconnect(key)}
                    />
                  )}
                  {key === 'linkedin' && (
                    <p className="mt-1 text-center text-[10px] leading-tight text-[var(--color-text-muted)]">
                      Want to switch accounts?<br />
                      <a 
                        href="https://www.linkedin.com/m/logout/" 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-blue-600 hover:underline font-medium"
                      >
                        Sign out of LinkedIn first
                      </a>
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── Advanced Developer Settings (collapsed by default) ────────────── */}
      <section className="space-y-2">
        <button
          id="toggle-advanced-settings"
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-strong)] transition-colors focus:outline-none group"
        >
          <Settings2 size={15} className="opacity-60 group-hover:opacity-100" />
          Advanced Developer Settings
          {showAdvanced ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>

        {showAdvanced && (
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
            <p className="text-sm text-[var(--color-text-muted)] mb-1">
              Override the system-default OAuth credentials for each platform. Leave blank to use the environment defaults.
            </p>
            <p className="text-xs text-amber-600 mb-5 font-medium">
              ⚠ Only change these if you have registered your own developer app for this deployment.
            </p>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {platformsList.filter((p) => p.active).map((p: Platform) => {
                const key = p.name.toLowerCase().replace(/\s+/g, '').replace('(x)', '')
                const isConfigured = !!platformConfigsResponse?.data?.find((c) => c.platform === key)
                return (
                  <div
                    key={p._id.toString()}
                    className="p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] flex flex-col gap-4 shadow-sm"
                  >
                    <div className="flex items-center gap-2">
                      <PlatformIcon icon={p.icon} svg={p.svg} color={p.color || 'var(--color-primary)'} size="1.2rem" />
                      <span className="font-semibold capitalize text-sm">{p.name}</span>
                    </div>
                    <div className="text-[10px] uppercase font-bold tracking-wide flex-1">
                      {isConfigured ? (
                        <span className="text-green-600 flex items-center gap-1">
                          <i className="pi pi-check-circle text-[10px]" /> Custom credentials active
                        </span>
                      ) : (
                        <span className="text-[var(--color-text-muted)]">Using system defaults</span>
                      )}
                    </div>
                    <Button
                      label="Edit Credentials"
                      size="small"
                      outlined
                      className="mt-2 w-full"
                      onClick={() => openConfigModal(key)}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </section>

      {/* ── Developer Credentials Modal ───────────────────────────────────── */}
      <Dialog
        header={`${selectedPlatform.charAt(0).toUpperCase() + selectedPlatform.slice(1)} OAuth Credentials`}
        visible={showConfigModal}
        onHide={() => setShowConfigModal(false)}
        className="w-full max-w-md"
        footer={
          <div className="flex items-center justify-between gap-2">
            <Button
              label="Reset to .env Defaults"
              icon="pi pi-refresh"
              severity="danger"
              text
              onClick={() => setShowResetConfigDialog(true)}
              loading={isDeletingConfig}
              disabled={!platformConfigsResponse?.data?.find((c) => c.platform === selectedPlatform)}
              tooltip="Deletes the custom credentials from the database — the system will fall back to .env values"
              tooltipOptions={{ position: 'top' }}
            />
            <div className="flex gap-2">
              <Button label="Cancel" text onClick={() => setShowConfigModal(false)} />
              <Button label="Save Changes" icon="pi pi-check" onClick={handleSaveConfig} loading={isUpdatingConfig} />
            </div>
          </div>
        }
      >
        <div className="space-y-4 pt-2">
          {/* Active source banner */}
          {platformConfigsResponse?.data?.find((c) => c.platform === selectedPlatform) ? (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <i className="pi pi-exclamation-triangle mt-0.5 text-amber-600" />
              <div>
                <p className="font-semibold">Custom DB credentials are active</p>
                <p className="mt-0.5 text-amber-700">These override the system .env defaults. If you're getting OAuth errors, click <strong>"Reset to .env Defaults"</strong> to revert.</p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
              <i className="pi pi-info-circle mt-0.5 text-blue-500" />
              <div>
                <p className="font-semibold">Currently using system .env defaults</p>
                <p className="mt-0.5">Only fill this in if you want to override with your own developer app credentials.</p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">Client ID / App ID</label>
            <InputText
              value={configForm.clientId}
              onChange={(e) => setConfigForm({ ...configForm, clientId: e.target.value })}
              className="w-full"
              placeholder={`Enter ${selectedPlatform} Client ID`}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Client Secret / App Secret</label>
            <Password
              value={configForm.clientSecret}
              onChange={(e) => setConfigForm({ ...configForm, clientSecret: e.target.value })}
              className="w-full"
              toggleMask
              feedback={false}
              placeholder={`Enter ${selectedPlatform} Client Secret`}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Redirect URI (Optional Override)</label>
            <InputText
              value={configForm.redirectUri}
              onChange={(e) => setConfigForm({ ...configForm, redirectUri: e.target.value })}
              className="w-full"
              placeholder="e.g. http://localhost:5003/auth/callback"
            />
            <p className="text-[10px] text-[var(--color-text-muted)]">
              Leave blank to use the system default (recommended).
            </p>
          </div>
        </div>
      </Dialog>
      <ConfirmationDialog
        open={showResetConfigDialog}
        title="Reset OAuth credentials?"
        message={`Reset ${selectedPlatform} to use the system .env defaults? The custom credentials stored in the database will be deleted.`}
        confirmLabel="Reset Credentials"
        tone="danger"
        confirmLoading={isDeletingConfig}
        onClose={() => {
          if (!isDeletingConfig) setShowResetConfigDialog(false)
        }}
        onConfirm={() => void handleResetConfig()}
      />
    </div>
  )
}
