import { useEffect, useState } from 'react'
import { Button } from 'primereact/button'
import { Dialog } from 'primereact/dialog'
import { Dropdown } from 'primereact/dropdown'
import { Eye, Pencil, History as HistoryIcon } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog'
import { useToast } from '@/hooks/useToast'
import { useStaffTranslation } from '@/i18n/useTranslation'
import {
  useGetDraftPageContentQuery,
  useSaveDraftPageContentMutation,
  usePublishPageContentMutation,
  useListPageContentVersionsQuery,
  useRestorePageContentVersionMutation,
} from '@/services/api/endpoints/pageContentApi'
import { BuilderCanvas } from '@/components/screenBuilder/BuilderCanvas'
import { WidgetPalette } from '@/components/screenBuilder/WidgetPalette'
import { WidgetInspector } from '@/components/screenBuilder/WidgetInspector'
import { SCREEN_KEYS, SCREEN_LABELS, SCREEN_PREVIEW_ROUTES, WIDGET_PALETTE } from '@/types/pageContent'
import type { ScreenKey, Widget, WidgetType } from '@/types/pageContent'
import type { Layout } from 'react-grid-layout'

const SCREEN_OPTIONS = SCREEN_KEYS.map((key) => ({ label: SCREEN_LABELS[key], value: key }))

export function ScreenBuilderPage() {
  const { t } = useStaffTranslation()
  const [screenKey, setScreenKey] = useState<ScreenKey>('home')
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')
  const [widgets, setWidgets] = useState<Widget[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [previewReloadKey, setPreviewReloadKey] = useState(0)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [restoreTargetId, setRestoreTargetId] = useState<string | null>(null)
  const { showToast } = useToast()

  const { data: draftWidgets, isFetching } = useGetDraftPageContentQuery(screenKey)
  const [saveDraftMutation, { isLoading: isSaving }] = useSaveDraftPageContentMutation()
  const [publish, { isLoading: isPublishing }] = usePublishPageContentMutation()
  const { data: versions = [], isFetching: isLoadingVersions } = useListPageContentVersionsQuery(screenKey, {
    skip: !historyOpen,
  })
  const [restoreVersion, { isLoading: isRestoring }] = useRestorePageContentVersionMutation()

  useEffect(() => {
    setWidgets(draftWidgets ?? [])
    setSelectedId(null)
  }, [draftWidgets, screenKey])

  const selectedWidget = widgets.find((w) => w.id === selectedId) ?? null

  const handleAddWidget = (type: WidgetType) => {
    const meta = WIDGET_PALETTE.find((w) => w.type === type)!
    const maxY = widgets.reduce((max, w) => Math.max(max, w.y + w.h), 0)
    const newWidget: Widget = {
      id: `w-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      type,
      x: 0,
      y: maxY,
      w: meta.defaultW,
      h: meta.defaultH,
      ...(type === 'heading' || type === 'text' || type === 'button' ? { content: { en: '' } } : {}),
      ...(type === 'carousel' ? { images: [], slideDurationMs: 4000, transition: 'fade', heightPx: 300 } : {}),
    }
    setWidgets((prev) => [...prev, newWidget])
    setSelectedId(newWidget.id)
  }

  const handleRemoveWidget = (id: string) => {
    setWidgets((prev) => prev.filter((w) => w.id !== id))
    if (selectedId === id) setSelectedId(null)
  }

  const handleLayoutChange = (layout: Layout[]) => {
    setWidgets((prev) =>
      prev.map((widget) => {
        const item = layout.find((l) => l.i === widget.id)
        return item ? { ...widget, x: item.x, y: item.y, w: item.w, h: item.h } : widget
      })
    )
  }

  const handleWidgetPatch = (patch: Partial<Widget>) => {
    if (!selectedId) return
    setWidgets((prev) => prev.map((w) => (w.id === selectedId ? { ...w, ...patch } : w)))
  }

  const persistDraft = async () => {
    const saved = await saveDraftMutation({ screenKey, widgets }).unwrap()
    setWidgets(saved)
    return saved
  }

  const handleSaveDraft = async () => {
    try {
      await persistDraft()
      showToast({ severity: 'success', summary: t('Draft saved') })
    } catch {
      showToast({ severity: 'error', summary: t('Could not save draft') })
    }
  }

  const handlePublish = async () => {
    try {
      await persistDraft()
      await publish(screenKey).unwrap()
      showToast({ severity: 'success', summary: t('Published'), detail: t('The live screen has been updated.') })
    } catch {
      showToast({ severity: 'error', summary: t('Could not publish') })
    }
  }

  const handleTogglePreview = async () => {
    if (mode === 'preview') {
      setMode('edit')
      return
    }

    // Save first so the iframe's fetch of the real page reflects the current
    // in-progress edits, not just whatever was last explicitly saved.
    try {
      await persistDraft()
    } catch {
      showToast({
        severity: 'error',
        summary: t('Could not save draft'),
        detail: t('Showing the last saved preview instead.'),
      })
    }
    setPreviewReloadKey((key) => key + 1)
    setMode('preview')
  }

  const handleRestoreVersion = async () => {
    if (!restoreTargetId) return
    try {
      await restoreVersion({ screenKey, versionId: restoreTargetId }).unwrap()
      showToast({
        severity: 'success',
        summary: t('Draft restored'),
        detail: t('Review it, then Publish when ready.'),
      })
      setMode('edit')
      setHistoryOpen(false)
    } catch {
      showToast({ severity: 'error', summary: t('Could not restore version') })
    } finally {
      setRestoreTargetId(null)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t('Temple Management')}
        title={t('Screen Customizer')}
        description={t(
          'Drag, resize, and configure banners, carousels, and content blocks for each devotee-facing screen — preview before publishing.',
        )}
        actions={
          <div className="flex gap-2">
            <Button
              type="button"
              label={t('History')}
              icon={<HistoryIcon size={14} className="mr-1" />}
              outlined
              onClick={() => setHistoryOpen(true)}
            />
            <Button
              type="button"
              label={mode === 'edit' ? t('Preview') : t('Edit')}
              icon={mode === 'edit' ? <Eye size={14} className="mr-1" /> : <Pencil size={14} className="mr-1" />}
              outlined
              onClick={() => void handleTogglePreview()}
            />
            <Button type="button" label={t('Save Draft')} outlined loading={isSaving} onClick={handleSaveDraft} />
            <Button type="button" label={t('Publish')} loading={isPublishing} onClick={handlePublish} />
          </div>
        }
      />

      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-[var(--color-text-strong)]">{t('Screen:')}</label>
        <Dropdown value={screenKey} options={SCREEN_OPTIONS} onChange={(e) => setScreenKey(e.value)} className="w-56" />
        {isFetching && <span className="text-xs text-[var(--color-text-muted)]">{t('Loading…')}</span>}
      </div>

      {mode === 'preview' ? (
        <iframe
          key={`${screenKey}-${previewReloadKey}`}
          src={`${SCREEN_PREVIEW_ROUTES[screenKey]}?previewDraft=1`}
          title={t('Screen preview')}
          style={{
            width: '100%',
            height: '80vh',
            border: '1px solid var(--color-border)',
            borderRadius: 12,
            background: '#fff',
          }}
        />
      ) : (
        <div className="grid grid-cols-[200px_1fr_280px] gap-4">
          <WidgetPalette onAdd={handleAddWidget} />
          <BuilderCanvas
            widgets={widgets}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onLayoutChange={handleLayoutChange}
            onRemove={handleRemoveWidget}
          />
          {selectedWidget ? (
            <WidgetInspector widget={selectedWidget} onChange={handleWidgetPatch} />
          ) : (
            <div className="rounded-lg border border-dashed border-[var(--color-border)] p-4 text-center text-sm text-[var(--color-text-muted)]">
              {t('Select a widget on the canvas to edit its settings.')}
            </div>
          )}
        </div>
      )}

      <Dialog
        visible={historyOpen}
        onHide={() => setHistoryOpen(false)}
        header={t('Version History')}
        modal
        style={{ width: 'min(92vw, 40rem)' }}
      >
        {isLoadingVersions ? (
          <p className="py-6 text-center text-sm text-[var(--color-text-muted)]">{t('Loading…')}</p>
        ) : versions.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--color-text-muted)]">
            {t('No published versions yet — versions are created each time you publish.')}
          </p>
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {versions.map((version) => (
              <li key={version.id} className="flex items-center justify-between gap-4 py-3">
                <span className="text-sm text-[var(--color-text-strong)]">
                  {new Date(version.publishedAt).toLocaleString()}
                </span>
                <Button
                  type="button"
                  label={t('Restore to draft')}
                  outlined
                  size="small"
                  onClick={() => setRestoreTargetId(version.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </Dialog>

      <ConfirmationDialog
        open={restoreTargetId !== null}
        title={t('Restore this version to draft?')}
        message={t(
          "This will replace your current draft with this version's content. It won't go live until you publish again.",
        )}
        confirmLabel={t('Restore')}
        cancelLabel={t('staff.crud.cancel')}
        confirmLoading={isRestoring}
        onConfirm={() => void handleRestoreVersion()}
        onClose={() => setRestoreTargetId(null)}
      />
    </div>
  )
}
