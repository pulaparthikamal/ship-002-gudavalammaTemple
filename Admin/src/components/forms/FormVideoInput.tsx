import { useRef, useState } from 'react'
import { X, UploadCloud, Link2, LoaderCircle, Video } from 'lucide-react'
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
}

type InputMode = 'upload' | 'url'

export function FormVideoInput<T extends FieldValues>({
  control, name, label, helperText, containerClassName,
  disabled = false, folder = 'socialMediaPosts/uploadedVideos',
}: Props<T>) {
  const inputId = name.replaceAll('.', '-')
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [uploadDoc, { isLoading: uploading }] = useUploadDocumentFileMutation()
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [urlDraft, setUrlDraft] = useState('')
  const [urlError, setUrlError] = useState<string | null>(null)
  const [mode, setMode] = useState<InputMode>('upload')

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const currentUrl: string = (field.value as string) || ''
        const resolved = /^https?:\/\//i.test(currentUrl)
          ? currentUrl
          : resolveApiAssetUrl(currentUrl)

        const clear = () => { field.onChange(''); setUrlDraft(''); setUploadError(null) }

        const handleFile = async (files: FileList | null) => {
          const file = files?.[0]
          if (!file) return
          setUploadError(null)
          try {
            const res = await uploadDoc({
              file,
              folder,
            }).unwrap()
            field.onChange(res.fileUrl)
          } catch (e) {
            setUploadError(getApiErrorMessage(e))
          } finally {
            if (fileRef.current) fileRef.current.value = ''
          }
        }

        const applyUrl = () => {
          const url = urlDraft.trim()
          if (!url) { setUrlError('Enter a URL'); return }
          if (!/^https?:\/\//i.test(url)) { setUrlError('Must start with https://'); return }
          setUrlError(null); setUrlDraft('')
          field.onChange(url)
        }

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

              {/* ── Current video preview (when set) ── */}
              {currentUrl ? (
                <div className="p-4 space-y-3">
                  <div className="relative rounded-xl overflow-hidden bg-black shadow-inner">
                    <video
                      src={resolved}
                      controls
                      className="w-full max-h-52 object-contain"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-[var(--color-text-muted)] truncate min-w-0">
                      {currentUrl.startsWith('http') ? currentUrl : currentUrl.split('/').pop()}
                    </p>
                    <Button
                      type="button" label="Remove" severity="danger" text size="small"
                      icon={<X className="h-3.5 w-3.5 mr-1" />}
                      onClick={clear} disabled={disabled}
                      className="shrink-0"
                    />
                  </div>
                </div>
              ) : (
                <>
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
                        {m === 'upload' ? 'Upload Video' : 'Paste URL'}
                      </button>
                    ))}
                  </div>

                  <div className="p-4">
                    {/* Upload panel */}
                    {mode === 'upload' && (
                      <div>
                        <input
                          ref={el => { fileRef.current = el; field.ref(el) }}
                          id={inputId}
                          type="file"
                          accept="video/mp4,video/webm,video/quicktime,video/x-msvideo,video/mpeg,video/*"
                          disabled={disabled || uploading}
                          className="sr-only"
                          onChange={e => handleFile(e.target.files)}
                        />
                        <button
                          type="button"
                          disabled={disabled || uploading}
                          onClick={() => fileRef.current?.click()}
                          className="w-full flex flex-col items-center justify-center gap-2 py-10 rounded-xl border-2 border-dashed border-[var(--color-border)] hover:border-[var(--color-primary)] hover:bg-[var(--color-hover)] transition-colors cursor-pointer"
                        >
                          {uploading
                            ? <LoaderCircle className="h-10 w-10 animate-spin text-[var(--color-primary)]" />
                            : <Video className="h-10 w-10 text-[var(--color-text-muted)]" />}
                          <span className="text-sm font-medium text-[var(--color-text-muted)]">
                            {uploading ? 'Uploading video…' : 'Click to select video'}
                          </span>
                          <span className="text-xs text-[var(--color-text-muted)]">MP4, WebM, MOV, AVI — up to 200 MB</span>
                        </button>
                        {uploadError && <p className="mt-2 text-xs text-red-500 font-medium">{uploadError}</p>}
                      </div>
                    )}

                    {/* URL panel */}
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
                            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), applyUrl())}
                            placeholder="https://… YouTube, Drive, or direct .mp4 link"
                            disabled={disabled}
                            className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--color-text-muted)] min-w-0"
                          />
                        </div>
                        {urlError && <p className="text-xs text-red-500">{urlError}</p>}
                        <Button
                          type="button" label="Set Video URL" severity="secondary" outlined
                          disabled={disabled || !urlDraft.trim()}
                          onClick={applyUrl}
                          className="w-full"
                        />
                      </div>
                    )}
                  </div>
                </>
              )}
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
