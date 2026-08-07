import { useRef, useState } from 'react'
import { ExternalLink, LoaderCircle, Plus, Trash2, UploadCloud } from 'lucide-react'
import { Button } from 'primereact/button'
import { useController, useFieldArray, useWatch } from 'react-hook-form'
import type { Control, FieldArrayPath, FieldPath, FieldValues } from 'react-hook-form'
import { FormDropdown } from '@/components/forms/FormDropdown'
import { FormInputText } from '@/components/forms/FormInputText'
import { FormTextarea } from '@/components/forms/FormTextarea'
import { getApiErrorMessage } from '@/services/api/apiError'
import { resolveApiAssetUrl } from '@/services/api/apiConfig'
import { useCentralDocumentUploadService } from '@/services/documents/centralDocumentUploadService'
import type { DocumentCreatePayload } from '@/types/document'
import type { CrudSelectOption } from '@/types/crud'
import { getFileNameFromPath } from '@/utils/fileUploads'
import { cn } from '@/utils/classNames'

interface FormAttachmentLinksProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>
  name: FieldPath<TFieldValues>
  label: string
  helperText?: string
  containerClassName?: string
  disabled?: boolean
  maxItems?: number
  accept?: string
  documentTypeOptions?: CrudSelectOption[]
  uploadFolder?: string
  documentMetadata?: Partial<DocumentCreatePayload> | ((values: TFieldValues) => Partial<DocumentCreatePayload> | undefined)
}

interface AttachmentFormValueShape {
  documentType: string
  title: string
  fileUrl: string
  description: string
}

const emptyAttachmentLink: AttachmentFormValueShape = {
  documentType: '',
  title: '',
  fileUrl: '',
  description: '',
}

function getOriginalFileName(fileUrl: string | undefined | null): string {
  if (!fileUrl) return ''
  const fileName = getFileNameFromPath(fileUrl)
  const fullMatch = fileName.match(/^\d+-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}-(.+)$/i)
  if (fullMatch?.[1]) {
    return fullMatch[1]
  }
  const shortMatch = fileName.match(/^\d+-(.+)$/)
  if (shortMatch?.[1]) {
    return shortMatch[1]
  }
  return fileName
}

function isSameFileName(title1: string, title2: string): boolean {
  const clean1 = title1.toLowerCase().replace(/\.[a-z0-9]+$/i, '')
  const clean2 = title2.toLowerCase().replace(/\.[a-z0-9]+$/i, '')
  const sanitize = (s: string) => s.replace(/[^a-z0-9_-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  return sanitize(clean1) === sanitize(clean2) || sanitize(title1.toLowerCase()) === sanitize(title2.toLowerCase())
}

export function FormAttachmentLinks<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  helperText,
  containerClassName,
  disabled = false,
  maxItems = 6,
  accept = '.pdf,.png,.jpg,.jpeg,.webp,image/*',
  documentTypeOptions = [],
  uploadFolder,
  documentMetadata,
}: FormAttachmentLinksProps<TFieldValues>) {
  const inputId = name.replaceAll('.', '-')
  const { fieldState } = useController({ control, name })
  const formValues = useWatch({ control }) as TFieldValues
  const attachmentValues = (useWatch({ control, name }) as AttachmentFormValueShape[] | undefined) ?? []
  const { fields, append, remove, update } = useFieldArray({
    control,
    name: name as FieldArrayPath<TFieldValues>,
  })
  const { uploadDocument: uploadAttachment, isLoading: isUploadingAttachment } = useCentralDocumentUploadService()
  const [uploadingFieldId, setUploadingFieldId] = useState<string | null>(null)
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({})
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  // Maps field index → the last file name that was auto-populated into the title
  // field. Used to distinguish auto-set titles from titles the user typed manually:
  // if the current title still matches what was auto-set, re-uploading will update
  // it to the new file name; if the user has since edited it, it stays untouched.
  const autoTitledFields = useRef<Map<number, string>>(new Map())

  const canAddMore = !disabled && fields.length < maxItems

  const handleUpload = async (index: number, fieldId: string, file: File | null) => {
    if (!file || disabled) {
      return
    }

    setUploadingFieldId(fieldId)
    setUploadErrors((currentErrors) => {
      const nextErrors = { ...currentErrors }
      delete nextErrors[fieldId]
      return nextErrors
    })

    try {
      const currentValue = attachmentValues[index] ?? emptyAttachmentLink
      const resolvedDocumentMetadata =
        typeof documentMetadata === 'function' ? documentMetadata(formValues) : documentMetadata
      const uploadedFile = await uploadAttachment({
        file,
        folder: uploadFolder,
        metadata: resolvedDocumentMetadata
          ? {
              ...resolvedDocumentMetadata,
              documentCategory: currentValue.documentType || resolvedDocumentMetadata.documentCategory,
              documentType: currentValue.documentType || resolvedDocumentMetadata.documentType,
              fileName: currentValue.title.trim() || resolvedDocumentMetadata.fileName,
              description: currentValue.description.trim() || resolvedDocumentMetadata.description,
            }
          : undefined,
      })

      // Determine whether to update the title:
      // - No title yet → use the new file name and record it as auto-set.
      // - Title matches the previously auto-set value (or matches the original file name
      //   from the current file URL) → the user hasn't changed it, so update it to
      //   reflect the newly uploaded file.
      // - Title differs from the previously auto-set value (or original file name) →
      //   the user typed their own title; leave it unchanged.
      const previousAutoTitle = autoTitledFields.current.get(index)
      const currentTitle = currentValue.title.trim()
      let titleIsUserEdited = currentTitle && currentTitle !== previousAutoTitle

      if (titleIsUserEdited && currentValue.fileUrl) {
        const originalName = getOriginalFileName(currentValue.fileUrl)
        if (isSameFileName(currentTitle, originalName)) {
          titleIsUserEdited = false
        }
      }

      const nextTitle = titleIsUserEdited ? currentValue.title : uploadedFile.fileName

      if (!titleIsUserEdited) {
        autoTitledFields.current.set(index, uploadedFile.fileName)
      }

      update(index, {
        ...currentValue,
        fileUrl: uploadedFile.fileUrl,
        title: nextTitle,
      } as never)
    } catch (error) {
      setUploadErrors((currentErrors) => ({
        ...currentErrors,
        [fieldId]: getApiErrorMessage(error),
      }))
    } finally {
      setUploadingFieldId((currentValue) => (currentValue === fieldId ? null : currentValue))

      if (inputRefs.current[fieldId]) {
        inputRefs.current[fieldId]!.value = ''
      }
    }
  }

  return (
    <div className={cn('flex min-w-0 flex-col gap-3', containerClassName)}>
      <div className="flex items-center justify-between gap-3">
        <label className="text-sm font-semibold leading-5 text-[var(--color-text-strong)]" htmlFor={inputId}>
          {label}
        </label>
        <Button
          type="button"
          label="Add attachment"
          icon={<Plus className="h-4 w-4" aria-hidden="true" />}
          severity="secondary"
          outlined
          disabled={!canAddMore}
          onClick={() => append({ ...emptyAttachmentLink } as never)}
        />
      </div>

      <div className="space-y-3">
        {fields.length ? (
          fields.map((field, index) => {
            const currentValue = attachmentValues[index] ?? emptyAttachmentLink
            const uploadedPath = currentValue.fileUrl?.trim()
            const isUploadingCurrentField = uploadingFieldId === field.id

            return (
              <div
                key={field.id}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)]/55 p-3"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[var(--color-text-strong)]">Attachment {index + 1}</p>
                  <Button
                    type="button"
                    icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
                    text
                    severity="danger"
                    disabled={disabled}
                    aria-label={`Remove attachment ${index + 1}`}
                    onClick={() => {
                      const newMap = new Map<number, string>()
                      autoTitledFields.current.forEach((value, key) => {
                        if (key < index) {
                          newMap.set(key, value)
                        } else if (key > index) {
                          newMap.set(key - 1, value)
                        }
                      })
                      autoTitledFields.current = newMap
                      remove(index)
                    }}
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label
                      className="mb-1.5 block text-sm font-semibold leading-5 text-[var(--color-text-strong)]"
                      htmlFor={`${inputId}-${index}-upload`}
                    >
                      File upload
                    </label>
                    <input
                      ref={(element) => {
                        inputRefs.current[field.id] = element
                      }}
                      id={`${inputId}-${index}-upload`}
                      type="file"
                      accept={accept}
                      disabled={disabled || isUploadingAttachment}
                      className="sr-only"
                      onChange={(event) => {
                        void handleUpload(index, field.id, event.target.files?.[0] ?? null)
                      }}
                    />
                    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5">
                      <Button
                        type="button"
                        label={isUploadingCurrentField ? 'Uploading...' : 'Choose and upload'}
                        icon={
                          isUploadingCurrentField ? (
                            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                          ) : (
                            <UploadCloud className="h-4 w-4" aria-hidden="true" />
                          )
                        }
                        severity="secondary"
                        outlined
                        disabled={disabled || isUploadingAttachment}
                        onClick={() => inputRefs.current[field.id]?.click()}
                      />
                      {uploadedPath ? (
                        <a
                          href={resolveApiAssetUrl(uploadedPath)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-primary)]"
                        >
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                          Open uploaded file
                        </a>
                      ) : (
                        <span className="text-xs text-[var(--color-text-muted)]">
                          Upload PDF, image, or supporting registration documentation.
                        </span>
                      )}
                    </div>
                    {uploadErrors[field.id] ? (
                      <p className="mt-1 px-0.5 text-xs leading-[1.125rem] text-red-600">
                        {uploadErrors[field.id]}
                      </p>
                    ) : null}
                  </div>

                  {documentTypeOptions.length ? (
                    <FormDropdown
                      control={control}
                      name={`${name}.${index}.documentType` as FieldPath<TFieldValues>}
                      label="Document type"
                      options={documentTypeOptions}
                      disabled={disabled}
                      placeholder="Choose document type"
                    />
                  ) : (
                    <FormInputText
                      control={control}
                      name={`${name}.${index}.documentType` as FieldPath<TFieldValues>}
                      label="Document type"
                      disabled={disabled}
                      placeholder="Document type"
                    />
                  )}

                  <FormInputText
                    control={control}
                    name={`${name}.${index}.title` as FieldPath<TFieldValues>}
                    label="Title"
                    disabled={disabled}
                    placeholder={uploadedPath ? getFileNameFromPath(uploadedPath) : 'Document title'}
                  />

                  <FormTextarea
                    control={control}
                    name={`${name}.${index}.description` as FieldPath<TFieldValues>}
                    label="Notes"
                    disabled={disabled}
                    rows={3}
                    placeholder="Optional notes for this attachment"
                    containerClassName="md:col-span-2"
                  />
                </div>
              </div>
            )
          })
        ) : (
          <div className="rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-6 text-sm text-[var(--color-text-muted)]">
            No attachments added yet.
          </div>
        )}
      </div>

      <p
        id={`${inputId}-message`}
        className={cn(
          'min-h-[1.125rem] px-0.5 pt-0.5 text-xs leading-[1.125rem]',
          fieldState.error ? 'text-red-600' : 'text-[var(--color-text-muted)]',
        )}
      >
        {fieldState.error?.message ?? helperText}
      </p>
    </div>
  )
}
