import { useRef, useState } from 'react'
import { Button } from 'primereact/button'
import { InputText } from 'primereact/inputtext'
import { InputNumber } from 'primereact/inputnumber'
import { Dropdown } from 'primereact/dropdown'
import { Trash2, Upload } from 'lucide-react'
import { useGetEnabledLanguagesQuery } from '@/services/api/endpoints/languagesApi'
import { useUploadDocumentFileMutation } from '@/services/api/endpoints/documentsApi'
import { resolveApiAssetUrl } from '@/services/api/apiConfig'
import { useStaffTranslation } from '@/i18n/useTranslation'
import { WIDGET_PALETTE } from '@/types/pageContent'
import type { CarouselImage, Widget } from '@/types/pageContent'

type StaffT = ReturnType<typeof useStaffTranslation>['t']

interface WidgetInspectorProps {
  widget: Widget
  onChange: (patch: Partial<Widget>) => void
}

const HAS_TEXT_CONTENT: Widget['type'][] = ['heading', 'text', 'button']

export function WidgetInspector({ widget, onChange }: WidgetInspectorProps) {
  const { t } = useStaffTranslation()
  const { data: languages = [] } = useGetEnabledLanguagesQuery()
  const [activeLocale, setActiveLocale] = useState('en')
  const [uploadFile, { isLoading: uploading }] = useUploadDocumentFileMutation()
  const fileRef = useRef<HTMLInputElement | null>(null)
  const paletteMeta = WIDGET_PALETTE.find((item) => item.type === widget.type)

  const setContentForLocale = (locale: string, text: string) => {
    onChange({ content: { ...widget.content, [locale]: text } })
  }

  const handleUploadImage = async (file: File, onDone: (url: string) => void) => {
    try {
      const result = await uploadFile({ file, folder: 'pageContent' }).unwrap()
      onDone(result.fileUrl)
    } catch {
      // Errors surface via the mutation's own error state; nothing else to do here.
    }
  }

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 space-y-4">
      <h3 className="text-sm font-semibold text-[var(--color-text-strong)]">{t('Widget settings')}</h3>
      <p className="text-xs text-[var(--color-text-muted)]">
        {t('Type: {{type}}', { type: paletteMeta ? t(paletteMeta.label) : widget.type })}
      </p>

      {HAS_TEXT_CONTENT.includes(widget.type) && (
        <div>
          <div className="mb-2 flex flex-wrap gap-1">
            {languages.map((lang) => (
              <button
                key={lang.code}
                type="button"
                onClick={() => setActiveLocale(lang.code)}
                className={`rounded px-2 py-1 text-xs ${
                  activeLocale === lang.code ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-hover)]'
                }`}
              >
                {lang.code}
              </button>
            ))}
          </div>
          <InputText
            className="w-full"
            value={widget.content?.[activeLocale] ?? ''}
            onChange={(e) => setContentForLocale(activeLocale, e.target.value)}
            placeholder={t('Text in {{locale}}', { locale: activeLocale })}
          />
          {activeLocale !== 'en' && (
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              {t('Auto-translated from English on save; edit here to override.')}
            </p>
          )}
        </div>
      )}

      {widget.type === 'button' && (
        <div>
          <label className="mb-1 block text-xs text-[var(--color-text-muted)]">{t('Link URL')}</label>
          <InputText className="w-full" value={widget.linkUrl ?? ''} onChange={(e) => onChange({ linkUrl: e.target.value })} />
        </div>
      )}

      {widget.type === 'image' && (
        <div className="space-y-2">
          {widget.imageUrl && (
            <img src={resolveApiAssetUrl(widget.imageUrl)} alt="" className="h-24 w-full rounded object-cover" />
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleUploadImage(file, (url) => onChange({ imageUrl: url }))
            }}
          />
          <Button
            type="button"
            label={uploading ? t('Uploading…') : t('Upload image')}
            icon={<Upload size={14} className="mr-1" />}
            outlined
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          />
          <label className="mb-1 block text-xs text-[var(--color-text-muted)]">{t('Link URL (optional)')}</label>
          <InputText className="w-full" value={widget.linkUrl ?? ''} onChange={(e) => onChange({ linkUrl: e.target.value })} />
        </div>
      )}

      {widget.type === 'carousel' && (
        <CarouselInspector widget={widget} onChange={onChange} onUploadImage={handleUploadImage} uploading={uploading} t={t} />
      )}
    </div>
  )
}

function CarouselInspector({
  widget,
  onChange,
  onUploadImage,
  uploading,
  t,
}: {
  widget: Widget
  onChange: (patch: Partial<Widget>) => void
  onUploadImage: (file: File, onDone: (url: string) => void) => void
  uploading: boolean
  t: StaffT
}) {
  const images = widget.images ?? []
  const fileRef = useRef<HTMLInputElement | null>(null)

  const updateImage = (index: number, patch: Partial<CarouselImage>) => {
    const next = images.map((img, i) => (i === index ? { ...img, ...patch } : img))
    onChange({ images: next })
  }

  const removeImage = (index: number) => {
    onChange({ images: images.filter((_, i) => i !== index) })
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {images.map((img, index) => (
          <div key={index} className="flex items-center gap-2 rounded border border-[var(--color-border)] p-2">
            <img src={resolveApiAssetUrl(img.url)} alt="" className="h-10 w-16 rounded object-cover" />
            <InputText
              className="flex-1"
              placeholder={t('Caption (optional)')}
              value={img.caption ?? ''}
              onChange={(e) => updateImage(index, { caption: e.target.value })}
            />
            <button type="button" onClick={() => removeImage(index)} aria-label={t('Remove image')}>
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onUploadImage(file, (url) => onChange({ images: [...images, { url }] }))
        }}
      />
      <Button
        type="button"
        label={uploading ? t('Uploading…') : t('Add image')}
        icon={<Upload size={14} className="mr-1" />}
        outlined
        disabled={uploading}
        onClick={() => fileRef.current?.click()}
      />

      <div>
        <label className="mb-1 block text-xs text-[var(--color-text-muted)]">
          {t('Slide duration: {{seconds}}s', { seconds: (widget.slideDurationMs ?? 4000) / 1000 })}
        </label>
        <input
          type="range"
          min={1000}
          max={10000}
          step={500}
          value={widget.slideDurationMs ?? 4000}
          onChange={(e) => onChange({ slideDurationMs: Number(e.target.value) })}
          className="w-full"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs text-[var(--color-text-muted)]">{t('Transition')}</label>
        <Dropdown
          value={widget.transition ?? 'fade'}
          options={[
            { label: t('Fade'), value: 'fade' },
            { label: t('Slide'), value: 'slide' },
          ]}
          onChange={(e) => onChange({ transition: e.value })}
          className="w-full"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs text-[var(--color-text-muted)]">{t('Height (px)')}</label>
        <InputNumber
          className="w-full"
          value={widget.heightPx ?? 300}
          onValueChange={(e) => onChange({ heightPx: e.value ?? 300 })}
        />
      </div>
    </div>
  )
}
