import { useRef, useState } from 'react'
import { ExternalLink, LoaderCircle, UploadCloud, X } from 'lucide-react'
import { Button } from 'primereact/button'
import { Controller } from 'react-hook-form'
import type { Control, FieldPath, FieldValues } from 'react-hook-form'
import { getApiErrorMessage } from '@/services/api/apiError'
import { resolveApiAssetUrl } from '@/services/api/apiConfig'
import { useCentralDocumentUploadService } from '@/services/documents/centralDocumentUploadService'
import type { DocumentCreatePayload } from '@/types/document'
import { getFileNameFromPath } from '@/utils/fileUploads'
import { cn } from '@/utils/classNames'

interface FormFileUploadProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>
  name: FieldPath<TFieldValues>
  label: string
  helperText?: string
  containerClassName?: string
  accept?: string
  chooseLabel?: string
  clearLabel?: string
  disabled?: boolean
  emptyMessage?: string
  folder?: string
  documentMetadata?: Partial<DocumentCreatePayload>
  multiple?: boolean
}

function normalizeUploadedPaths(value: unknown): string[] {
  if (typeof value === 'string') {
    return value.trim() ? [value] : []
  }

  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
}

export function FormFileUpload<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  helperText,
  containerClassName,
  accept,
  chooseLabel,
  clearLabel = 'Clear',
  disabled = false,
  emptyMessage,
  folder,
  documentMetadata,
  multiple = false,
}: FormFileUploadProps<TFieldValues>) {
  const inputId = name.replaceAll('.', '-')
  const inputRef = useRef<HTMLInputElement | null>(null)
  const { uploadDocument, isLoading: isUploading } = useCentralDocumentUploadService()
  const [uploadError, setUploadError] = useState<string | null>(null)

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const uploadedPaths = normalizeUploadedPaths(field.value)
        const resolvedChooseLabel = chooseLabel ?? (multiple ? 'Choose and upload files' : 'Choose and upload file')
        const resolvedEmptyMessage =
          emptyMessage ?? (multiple ? 'No files uploaded yet.' : 'No file uploaded yet.')

        const assignInputRef = (element: HTMLInputElement | null) => {
          inputRef.current = element
          field.ref(element)
        }

        const updateValue = (nextFilePaths: string[]) => {
          field.onChange(multiple ? nextFilePaths : (nextFilePaths[0] ?? ''))
        }

        const clearSelection = () => {
          updateValue([])

          if (inputRef.current) {
            inputRef.current.value = ''
          }
        }

        const removeFileAtIndex = (indexToRemove: number) => {
          updateValue(uploadedPaths.filter((_, index) => index !== indexToRemove))
        }

        return (
          <div className={cn('flex min-w-0 flex-col gap-1.5', containerClassName)}>
            <label className="text-sm font-semibold leading-5 text-[var(--color-text-strong)]" htmlFor={inputId}>
              {label}
            </label>

            <input
              ref={assignInputRef}
              id={inputId}
              name={field.name}
              type="file"
              accept={accept}
              multiple={multiple}
              disabled={disabled || isUploading}
              className="sr-only"
              onBlur={field.onBlur}
              onChange={async (event) => {
                const nextFiles = Array.from(event.target.files ?? [])

                if (!nextFiles.length) {
                  return
                }

                setUploadError(null)

                try {
                  const uploadedFilePaths: string[] = []

                  for (const file of nextFiles) {
                    const uploadedFile = await uploadDocument({
                      file,
                      folder,
                      metadata: documentMetadata,
                    })

                    uploadedFilePaths.push(uploadedFile.fileUrl)
                  }

                  updateValue(multiple ? [...uploadedPaths, ...uploadedFilePaths] : uploadedFilePaths.slice(-1))
                } catch (error) {
                  setUploadError(getApiErrorMessage(error))
                } finally {
                  event.target.value = ''
                }
              }}
              aria-describedby={`${inputId}-message`}
              aria-invalid={fieldState.invalid}
            />

            <div
              className={cn(
                'rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-3',
                fieldState.invalid && 'border-red-300 bg-red-50/40',
                disabled && 'cursor-not-allowed opacity-70',
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  label={resolvedChooseLabel}
                  icon={
                    isUploading ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <UploadCloud className="h-4 w-4" aria-hidden="true" />
                    )
                  }
                  severity="secondary"
                  outlined
                  disabled={disabled || isUploading}
                  onClick={() => inputRef.current?.click()}
                />

                {uploadedPaths.length ? (
                  <Button
                    type="button"
                    label={clearLabel}
                    text
                    severity="secondary"
                    disabled={disabled || isUploading}
                    onClick={clearSelection}
                  />
                ) : null}

                {accept ? <span className="text-xs text-[var(--color-text-muted)]">Accepted: {accept}</span> : null}
              </div>

              <div className="mt-3 space-y-2">
                {uploadedPaths.length ? (
                  uploadedPaths.map((filePath, index) => (
                    <div
                      key={`${filePath}-${index}`}
                      className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)]/55 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[var(--color-text-strong)]">
                          {getFileNameFromPath(filePath)}
                        </p>
                      </div>

                      <div className="flex items-center gap-1">
                        <a
                          href={resolveApiAssetUrl(filePath)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex rounded-md p-1 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-primary)]"
                          aria-label={`Open ${getFileNameFromPath(filePath)}`}
                        >
                          <ExternalLink className="h-4 w-4" aria-hidden="true" />
                        </a>
                        <button
                          type="button"
                          className="rounded-md p-1 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-text-strong)]"
                          aria-label={`Remove ${getFileNameFromPath(filePath)}`}
                          disabled={disabled || isUploading}
                          onClick={() => removeFileAtIndex(index)}
                        >
                          <X className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-[var(--color-text-muted)]">{resolvedEmptyMessage}</p>
                )}
              </div>
            </div>

            <p
              id={`${inputId}-message`}
              className={cn(
                'min-h-[1.125rem] px-0.5 pt-0.5 text-xs leading-[1.125rem]',
                fieldState.error || uploadError ? 'text-red-600' : 'text-[var(--color-text-muted)]',
              )}
            >
              {fieldState.error?.message ?? uploadError ?? helperText}
            </p>
          </div>
        )
      }}
    />
  )
}
