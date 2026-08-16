import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from 'primereact/button'
import { ArrowRight, RotateCcw, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog'
import { useToast } from '@/hooks/useToast'
import { useStaffTranslation } from '@/i18n/useTranslation'
import { getApiErrorMessage } from '@/services/api/apiError'
import {
  useGetReconfigureCatalogsQuery,
  useResetCatalogMutation,
  type ReconfigureCatalogInfo,
  type ReconfigureCatalogKey,
} from '@/services/api/endpoints/templeReconfigureApi'

interface PendingAction {
  catalog: ReconfigureCatalogKey
  label: string
  mode: 'empty' | 'defaults'
}

export function ReconfigureTemplePage() {
  const { t } = useStaffTranslation()
  const { showToast } = useToast()
  const { data: catalogs = [], isLoading } = useGetReconfigureCatalogsQuery()
  const [resetCatalog, { isLoading: isResetting }] = useResetCatalogMutation()
  const [pending, setPending] = useState<PendingAction | null>(null)

  const handleConfirm = async () => {
    if (!pending) return
    try {
      const result = await resetCatalog({ catalog: pending.catalog, mode: pending.mode }).unwrap()
      showToast({
        severity: 'success',
        summary: pending.label,
        detail:
          pending.mode === 'empty'
            ? t('Removed {{count}} record(s).', { count: result.removedCount })
            : t('Removed {{count}} record(s), restored {{restored}} starter default(s).', {
                count: result.removedCount,
                restored: result.currentCount,
              }),
      })
      setPending(null)
    } catch (error) {
      showToast({ severity: 'error', summary: pending.label, detail: getApiErrorMessage(error) })
    }
  }

  return (
    <div className="temple-scope w-full space-y-6">
      <PageHeader
        eyebrow={t('Temple Management')}
        title={t('Reconfigure for a New Temple')}
        description={t(
          'Rebrand this instance for a different temple: update the profile, then choose what happens to each existing catalog. This is a single-instance re-skin — one deployment represents one temple at a time.',
        )}
      />

      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text-strong)]">{t('Step 1 — Temple profile')}</h3>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              {t("Update the temple's name, tagline, address, timings, contact emails, and social links.")}
            </p>
          </div>
          <Link to="/temple-profile">
            <Button
              type="button"
              label={t('Edit Temple Profile')}
              icon={<ArrowRight className="h-4 w-4" />}
              iconPos="right"
            />
          </Link>
        </div>
      </div>

      <div>
        <h3 className="mb-1 text-sm font-semibold text-[var(--color-text-strong)]">{t('Step 2 — Catalog content')}</h3>
        <p className="mb-4 text-sm text-[var(--color-text-muted)]">
          {t(
            "For each catalog, choose to keep the existing content, clear it out, or restore the app's original starter content.",
          )}{' '}
          <strong>{t('Resetting is irreversible')}</strong> {t('— existing records are permanently deleted.')}
        </p>

        {isLoading ? (
          <p className="text-sm text-[var(--color-text-muted)]">{t('Loading catalogs…')}</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {catalogs.map((catalog: ReconfigureCatalogInfo) => (
              <div
                key={catalog.key}
                className="flex flex-col gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
              >
                <div>
                  <div className="text-sm font-semibold text-[var(--color-text-strong)]">{catalog.label}</div>
                  <div className="text-xs text-[var(--color-text-muted)]">
                    {catalog.count} {catalog.count === 1 ? t('record currently') : t('records currently')}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    label={t('Reset to empty')}
                    icon={<Trash2 className="h-3.5 w-3.5" />}
                    severity="danger"
                    outlined
                    size="small"
                    disabled={catalog.count === 0}
                    onClick={() => setPending({ catalog: catalog.key, label: catalog.label, mode: 'empty' })}
                  />
                  {catalog.supportsDefaults && (
                    <Button
                      type="button"
                      label={t('Reset to starter defaults')}
                      icon={<RotateCcw className="h-3.5 w-3.5" />}
                      severity="secondary"
                      outlined
                      size="small"
                      onClick={() => setPending({ catalog: catalog.key, label: catalog.label, mode: 'defaults' })}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmationDialog
        open={pending !== null}
        title={
          pending?.mode === 'empty'
            ? t('Clear {{label}}?', { label: pending?.label ?? '' })
            : t('Reset {{label}} to defaults?', { label: pending?.label ?? '' })
        }
        message={
          pending?.mode === 'empty'
            ? t('This permanently deletes every record in "{{label}}". This cannot be undone.', {
                label: pending?.label ?? '',
              })
            : t(
                'This permanently deletes every existing record in "{{label}}" and replaces them with the app\'s original starter content. This cannot be undone.',
                { label: pending?.label ?? '' },
              )
        }
        confirmLabel={pending?.mode === 'empty' ? t('Delete all') : t('Reset to defaults')}
        tone="danger"
        confirmLoading={isResetting}
        onConfirm={handleConfirm}
        onClose={() => setPending(null)}
      />
    </div>
  )
}
