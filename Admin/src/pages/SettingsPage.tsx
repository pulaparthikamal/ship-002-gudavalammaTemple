import { useState, useEffect } from 'react'
import { ColorPicker } from 'primereact/colorpicker'
import { Dropdown } from 'primereact/dropdown'
import { InputText } from 'primereact/inputtext'
import { Button } from 'primereact/button'
import { Message } from 'primereact/message'
import { PageHeader } from '@/components/ui/PageHeader'
import {
  setDensity,
  setPrimaryColor,
  setTheme,
  selectPreferences,
} from '@/features/preferences/preferencesSlice'
import type { AppDensity, AppTheme } from '@/features/preferences/preferencesSlice'
import { useAppDispatch, useAppSelector } from '@/hooks/redux'
import { useStaffTranslation } from '@/i18n/useTranslation'
import { useGetSettingsQuery, useUpdateSettingMutation } from '@/services/api/endpoints/settingsApi'
import { normalizeHexColor } from '@/utils/themeColors'

export function SettingsPage() {
  const { t } = useStaffTranslation()
  const dispatch = useAppDispatch()
  const preferences = useAppSelector(selectPreferences)

  const themeOptions: Array<{ label: string; value: AppTheme }> = [
    { label: t('Light'), value: 'light' },
    { label: t('Dark'), value: 'dark' },
    { label: t('System'), value: 'system' },
  ]

  const densityOptions: Array<{ label: string; value: AppDensity }> = [
    { label: t('Comfortable'), value: 'comfortable' },
    { label: t('Compact'), value: 'compact' },
  ]

  const { data: settings, isLoading: isLoadingSettings } = useGetSettingsQuery()
  const [updateSetting, { isLoading: isUpdating }] = useUpdateSettingMutation()

  const [sessionExpiry, setSessionExpiry] = useState<string>('')
  const [saveSuccess, setSaveSuccess] = useState(false)

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

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-full space-y-8">
      <PageHeader
        eyebrow={t('Settings')}
        title={t('Application settings')}
        description={t('Manage workspace preferences and system configurations.')}
      />

      {/* ── Workspace Preferences ────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-[var(--color-text-strong)]">{t('Workspace Preferences')}</h2>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--color-text-strong)]" htmlFor="settings-theme">
                {t('Theme')}
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
                {t('Density')}
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
              <label className="text-sm font-medium text-[var(--color-text-strong)]" htmlFor="settings-primary-color">
                {t('Primary accent color')}
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
                    {t('Updates buttons, hover, active, focus, and accent surfaces instantly.')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── System Settings ───────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-[var(--color-text-strong)]">{t('System Settings')}</h2>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--color-text-strong)]" htmlFor="session-expiry">
                {t('Session Expiry (minutes)')}
              </label>
              <div className="flex gap-2">
                <InputText
                  id="session-expiry"
                  value={sessionExpiry}
                  onChange={(e) => setSessionExpiry(e.target.value)}
                  disabled={isLoadingSettings}
                  className="flex-1"
                  placeholder={t('e.g. 15')}
                />
                <Button
                  label={t('Save')}
                  icon="pi pi-check"
                  onClick={handleSaveSessionExpiry}
                  loading={isUpdating}
                  disabled={isLoadingSettings}
                  className="flex items-center gap-1"
                />
              </div>
              {saveSuccess && (
                <Message severity="success" text={t('Session expiry updated successfully!')} className="mt-2 w-full justify-start" />
              )}
            </div>
          </div>
        </div>
      </section>

    </div>
  )
}
