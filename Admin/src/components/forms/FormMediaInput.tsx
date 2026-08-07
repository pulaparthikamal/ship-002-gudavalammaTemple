import { useRef, useState, useCallback } from 'react'
import { X, UploadCloud, Link2, LoaderCircle, GripVertical, ImageIcon } from 'lucide-react'
import { Controller } from 'react-hook-form'
import type { Control, FieldPath, FieldValues } from 'react-hook-form'
import { Button } from 'primereact/button'
import { useUploadDocumentFileMutation } from '@/services/api/endpoints/documentsApi'
import { getApiErrorMessage } from '@/services/api/apiError'
import { resolveApiAssetUrl } from '@/services/api/apiConfig'
import { cn } from '@/utils/classNames'

interface Props<T extends FieldValues> {
  control: Control<T>
  name: FieldPath<T>
  label: string
  helperText?: string
  containerClassName?: string
  disabled?: boolean
  folder?: string
  maxFiles?: number
}

function toDisplayUrl(url: string) {
  return resolveApiAssetUrl(url)
}

type InputMode = 'upload' | 'url'

export function FormMediaInput<T extends FieldValues>({
  control, name, label, helperText, containerClassName,
  disabled = false, folder = 'socialMediaPosts/uploaded', maxFiles = 10,
}: Props<T>) {
  const inputId = name.replaceAll('.', '-')
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [uploadDoc, { isLoading: uploading }] = useUploadDocumentFileMutation()
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [urlDraft, setUrlDraft] = useState('')
  const [urlError, setUrlError] = useState<string | null>(null)
  const [mode, setMode] = useState<InputMode>('upload')
  const dragIdx = useRef<number | null>(null)

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const items: string[] = Array.isArray(field.value)
          ? (field.value as string[]).filter(Boolean)
          : field.value ? [String(field.value)] : []

        const set = (next: string[]) => field.onChange(next)
        const canAdd = !disabled && items.length < maxFiles

        const handleFiles = async (files: FileList | null) => {
          if (!files?.length || !canAdd) return
          setUploadError(null)
          const batch = Array.from(files).slice(0, maxFiles - items.length)
          try {
            const urls: string[] = []
            for (const file of batch) {
              const res = await uploadDoc({
                file,
                folder,
              }).unwrap()
              urls.push(res.fileUrl)
            }
            set([...items, ...urls])
          } catch (e) {
            setUploadError(getApiErrorMessage(e))
          } finally {
            if (fileRef.current) fileRef.current.value = ''
          }
        }

        const addUrl = () => {
          const url = urlDraft.trim()
          if (!url) { setUrlError('Enter a URL'); return }
          if (!/^https?:\/\//i.test(url)) { setUrlError('Must start with https://'); return }
          if (items.includes(url)) { setUrlError('Already added'); return }
          if (!canAdd) { setUrlError(`Max ${maxFiles} images`); return }
          setUrlError(null); setUrlDraft('')
          set([...items, url])
        }

        const onDragStart = useCallback((idx: number) => { dragIdx.current = idx }, [])
        const onDrop = useCallback((toIdx: number) => {
          const from = dragIdx.current
          if (from === null || from === toIdx) { dragIdx.current = null; return }
          const next = [...items]
          const [moved] = next.splice(from, 1)
          next.splice(toIdx, 0, moved)
          dragIdx.current = null
          set(next)
        }, [items])

        return (
          <div className={cn('flex flex-col gap-2', containerClassName)}>
            <label className="text-sm font-semibold text-[var(--color-text-strong)]" htmlFor={inputId}>
              {label}
            </label>

            <div className={cn(
              'rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden',
              fieldState.invalid && 'border-red-400',
              disabled && 'opacity-60 pointer-events-none',
            )}>

              {/* ── Mode toggle tabs ── */}
              <div className="flex border-b border-[var(--color-border)]">
                {(['upload', 'url'] as InputMode[]).map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => { setMode(m); setUploadError(null); setUrlError(null) }}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold transition-colors',
                      mode === m
                        ? 'bg-[var(--color-primary)] text-white'
                        : 'text-[var(--color-text-muted)] hover:bg-[var(--color-hover)]',
                    )}
                  >
                    {m === 'upload' ? <UploadCloud className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
                    {m === 'upload' ? 'Upload Files' : 'Paste URL'}
                  </button>
                ))}
              </div>

              <div className="p-4 space-y-4">

                {/* ── Upload panel ── */}
                {mode === 'upload' && (
                  <div>
                    <input ref={el => { fileRef.current = el; field.ref(el) }}
                      id={inputId} type="file" accept="image/*" multiple
                      disabled={disabled || uploading || !canAdd}
                      className="sr-only"
                      onChange={e => handleFiles(e.target.files)}
                    />
                    <button
                      type="button"
                      disabled={disabled || uploading || !canAdd}
                      onClick={() => fileRef.current?.click()}
                      className={cn(
                        'w-full flex flex-col items-center justify-center gap-2 py-8 rounded-xl border-2 border-dashed transition-colors',
                        canAdd
                          ? 'border-[var(--color-border)] hover:border-[var(--color-primary)] hover:bg-[var(--color-hover)] cursor-pointer'
                          : 'border-[var(--color-border)] opacity-50 cursor-not-allowed',
                      )}
                    >
                      {uploading
                        ? <LoaderCircle className="h-8 w-8 animate-spin text-[var(--color-primary)]" />
                        : <UploadCloud className="h-8 w-8 text-[var(--color-text-muted)]" />}
                      <span className="text-sm font-medium text-[var(--color-text-muted)]">
                        {uploading ? 'Uploading…' : 'Click to select images'}
                      </span>
                      <span className="text-xs text-[var(--color-text-muted)]">
                        {items.length}/{maxFiles} used · JPG, PNG, WebP, GIF
                      </span>
                    </button>
                    {uploadError && <p className="mt-2 text-xs text-red-500 font-medium">{uploadError}</p>}
                  </div>
                )}

                {/* ── URL panel ── */}
                {mode === 'url' && (
                  <div className="space-y-2">
                    <div className={cn(
                      'flex items-center gap-2 rounded-lg border px-3 py-2.5 bg-[var(--color-surface-alt)]',
                      urlError ? 'border-red-400' : 'border-[var(--color-border)]',
                    )}>
                      <Link2 className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
                      <input
                        type="url"
                        value={urlDraft}
                        onChange={e => { setUrlDraft(e.target.value); setUrlError(null) }}
                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addUrl())}
                        placeholder="https://… direct image URL or Google Drive link"
                        disabled={disabled || !canAdd}
                        className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--color-text-muted)] min-w-0"
                      />
                    </div>
                    {urlError && <p className="text-xs text-red-500">{urlError}</p>}
                    <Button
                      type="button" label="Add URL" severity="secondary" outlined
                      disabled={disabled || !canAdd || !urlDraft.trim()}
                      onClick={addUrl}
                      className="w-full"
                    />
                  </div>
                )}

                {/* ── Thumbnails with drag-to-reorder ── */}
                {items.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {items.length} image{items.length > 1 ? 's' : ''} · drag to reorder
                    </p>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {items.map((url, idx) => (
                        <div
                          key={`${url}-${idx}`}
                          draggable
                          onDragStart={() => onDragStart(idx)}
                          onDragOver={e => e.preventDefault()}
                          onDrop={() => onDrop(idx)}
                          className="group relative aspect-square rounded-lg overflow-hidden border-2 border-transparent hover:border-[var(--color-primary)] transition-all cursor-grab active:cursor-grabbing shadow-sm bg-[var(--color-surface-muted)]"
                        >
                          <img
                            src={toDisplayUrl(url)}
                            alt={`${idx + 1}`}
                            className="w-full h-full object-cover"
                            onError={e => {
                              const el = e.target as HTMLImageElement
                              el.style.display = 'none'
                              const fb = el.parentElement?.querySelector('.fallback-icon') as HTMLElement
                              if (fb) fb.style.display = 'flex'
                            }}
                          />
                          <div className="fallback-icon hidden absolute inset-0 items-center justify-center bg-[var(--color-surface-muted)]">
                            <ImageIcon className="h-6 w-6 text-[var(--color-text-muted)]" />
                          </div>
                          {/* index */}
                          <div className="absolute top-1 left-1 bg-black/65 text-white text-[9px] font-bold rounded px-1 leading-4">
                            {idx + 1}
                          </div>
                          {/* drag handle */}
                          <div className="absolute top-1 right-7 opacity-0 group-hover:opacity-100 bg-black/50 rounded p-0.5">
                            <GripVertical className="h-3 w-3 text-white" />
                          </div>
                          {/* remove */}
                          <button
                            type="button"
                            onClick={() => set(items.filter((_, i) => i !== idx))}
                            disabled={disabled}
                            className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-0.5 shadow opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="h-3 w-3" />
                          </button>
                          <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <p className={cn(
              'min-h-[1.125rem] px-0.5 text-xs',
              fieldState.error ? 'text-red-500' : 'text-[var(--color-text-muted)]',
            )}>
              {fieldState.error?.message ?? helperText}
            </p>
          </div>
        )
      }}
    />
  )
}
