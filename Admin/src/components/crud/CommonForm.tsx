import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Copy, Plus } from 'lucide-react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm, useWatch } from 'react-hook-form'
import type { DefaultValues, FieldValues, Resolver } from 'react-hook-form'
import { Button } from 'primereact/button'
import { FormAutoComplete } from '@/components/forms/FormAutoComplete'
import { FormAttachmentLinks } from '@/components/forms/FormAttachmentLinks'
import { FormCheckbox } from '@/components/forms/FormCheckbox'
import { FormClaimLines } from '@/components/forms/FormClaimLines'
import { FormChargeLines } from '@/components/forms/FormChargeLines'
import { FormDatePicker } from '@/components/forms/FormDatePicker'
import { FormDropdown } from '@/components/forms/FormDropdown'
import { FormEmergencyContacts } from '@/components/forms/FormEmergencyContacts'
import { FormFileUpload } from '@/components/forms/FormFileUpload'
import { FormInputText } from '@/components/forms/FormInputText'
import { FormLocalFile } from '@/components/forms/FormLocalFile'
import { FormNumber } from '@/components/forms/FormNumber'
import { FormPassword } from '@/components/forms/FormPassword'
import { FormPermissionsMatrix } from '@/components/forms/FormPermissionsMatrix'
import { FormSwitch } from '@/components/forms/FormSwitch'
import { FormTimePicker } from '@/components/forms/FormTimePicker'
import { FormTextarea } from '@/components/forms/FormTextarea'
import { FormChips } from '@/components/forms/FormChips'
import { FormTagInput } from '@/components/forms/FormTagInput'
import { FormEditableStringList } from '@/components/forms/FormEditableStringList'
import { FormToneSelector } from '@/components/forms/FormToneSelector'
import { FormPlatformSelector } from '@/components/forms/FormPlatformSelector'
import { FormMultiSelect } from '@/components/forms/FormMultiSelect'
import { FormMediaInput } from '@/components/forms/FormMediaInput'
import { FormVideoInput } from '@/components/forms/FormVideoInput'
import { cn } from '@/utils/classNames'
import type { CrudFormConfig, CrudFormField, CrudFormMode } from '@/types/crud'

interface CommonFormProps<TValues extends FieldValues> {
  config: CrudFormConfig<TValues>
  mode: CrudFormMode
  initialValues?: TValues | null
  submitLabel: string
  isSubmitting?: boolean
  datePickerDisplayMode?: 'popup' | 'inline'
  onSubmit: (values: TValues) => void | Promise<void>
  onCancel: () => void
}

function fieldContainerClass<TValues extends FieldValues>(field: CrudFormField<TValues>) {
  return cn('min-w-0', field.fullWidth && 'col-span-full', field.type === 'hidden' && 'hidden')
}

function formGridClass(columns?: 1 | 2 | 3) {
  return cn('grid gap-x-5 gap-y-3', columns === 2 && 'md:grid-cols-2', columns === 3 && 'lg:grid-cols-3')
}

export function CommonForm<TValues extends FieldValues>({
  config,
  mode,
  initialValues,
  submitLabel,
  isSubmitting = false,
  datePickerDisplayMode = 'popup',
  onSubmit,
  onCancel,
}: CommonFormProps<TValues>) {
  const {
    control,
    getValues,
    handleSubmit,
    reset,
    formState: { isSubmitting: isFormSubmitting, errors, submitCount },
    watch,
    setValue,
    clearErrors,
  } = useForm<TValues>({
    resolver: zodResolver(config.schema as never) as Resolver<TValues>,
    defaultValues: config.defaultValues as DefaultValues<TValues>,
    mode: 'onBlur',
  })
  const watchedValues = useWatch({ control }) as Partial<TValues>
  const prevWatchedRef = useRef<Partial<TValues>>(watchedValues)
  const initialValuesSignature = useMemo(
    () => JSON.stringify(initialValues ?? config.defaultValues),
    [config.defaultValues, initialValues],
  )
  const initialValuesToReset = useMemo(
    () => (initialValues ?? config.defaultValues) as DefaultValues<TValues>,
    [initialValuesSignature],
  )

  const formValues = watch()

  useEffect(() => {
    reset(initialValuesToReset)
  }, [initialValuesToReset, reset])

  useEffect(() => {
    if (!config.onValuesChange) return
    const prevValues = prevWatchedRef.current
    prevWatchedRef.current = watchedValues as Partial<TValues>
    config.onValuesChange(watchedValues as TValues, prevValues, setValue, getValues)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedValues])

  const onInvalid = () => {}

  const shouldHideField = (fieldConfig: CrudFormField<TValues>) => {
    if (mode === 'create' && fieldConfig.hideOnAddForm) return true
    if (mode === 'edit' && fieldConfig.hideOnEditForm) return true
    if (fieldConfig.visibleIf && !fieldConfig.visibleIf(formValues)) return true
    return false
  }

  const isFieldDisabled = (fieldConfig: CrudFormField<TValues>) =>
    Boolean(
      fieldConfig.disabled ||
        (mode === 'create' && fieldConfig.disableOnAddForm) ||
        (mode === 'edit' && fieldConfig.disableOnEditForm),
    )

  const visibleSectionFields = config.fields.filter(
    (fieldConfig) => fieldConfig.type !== 'hidden' && !shouldHideField(fieldConfig),
  )
  const hasFormSections = visibleSectionFields.some((fieldConfig) => Boolean(fieldConfig.section?.trim()))

  const renderHiddenField = (fieldConfig: CrudFormField<TValues>) => (
    <Controller
      key={fieldConfig.name}
      control={control}
      name={fieldConfig.name}
      render={({ field }) => (
        <input type="hidden" name={field.name} value={String(field.value ?? '')} />
      )}
    />
  )

  const renderField = (fieldConfig: CrudFormField<TValues>) => {
    const fieldKey = fieldConfig.name

    if (fieldConfig.type === 'hidden' || shouldHideField(fieldConfig)) {
      return renderHiddenField(fieldConfig)
    }

    if (fieldConfig.type === 'action') {
      const actionContext = {
        values: getValues(),
        mode,
        initialValues,
        setValue,
        getValues,
        reset,
      }
      const isActionHidden = fieldConfig.action?.hiddenWhen?.(actionContext)

      if (isActionHidden) {
        return null
      }

      return (
        <div key={`${fieldKey}-${fieldConfig.label}-action`} className={fieldContainerClass(fieldConfig)}>
          <Button
            type="button"
            label={fieldConfig.action?.label ?? fieldConfig.label}
            icon={fieldConfig.action?.icon}
            severity={fieldConfig.action?.severity}
            outlined={fieldConfig.action?.outlined}
            loading={fieldConfig.action?.loading}
            disabled={
              isFieldDisabled(fieldConfig) ||
              fieldConfig.action?.loading ||
              fieldConfig.action?.disabledWhen?.(actionContext)
            }
            className={cn('h-9', fieldConfig.action?.className)}
            onClick={() => {
              void fieldConfig.action?.onClick({
                ...actionContext,
                values: getValues(),
              })
            }}
          />
          {fieldConfig.action?.helperText ?? fieldConfig.helperText ? (
            <p className="mt-2 text-xs text-[var(--color-text-muted)]">
              {fieldConfig.action?.helperText ?? fieldConfig.helperText}
            </p>
          ) : null}
        </div>
      )
    }

    if (fieldConfig.type === 'info') {
      const scenarios = fieldConfig.info?.scenarios ?? []
      return (
        <div key={`${fieldKey}-info`} className={fieldContainerClass(fieldConfig)}>
          {fieldConfig.info?.description ? (
            <p className="mb-2 text-xs leading-5 text-[var(--color-text-muted)] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2">
              {fieldConfig.info.description}
            </p>
          ) : null}
          <div className={
            fieldConfig.info?.columns === 2
              ? 'grid grid-cols-2 gap-2'
              : fieldConfig.info?.columns === 3
                ? 'grid grid-cols-3 gap-2'
                : 'space-y-2'
          }>
            {scenarios.map((scenario) => (
              <InfoScenarioCard key={scenario.label} label={scenario.label} text={scenario.text} />
            ))}
          </div>
        </div>
      )
    }

    const sharedProps = {
      control,
      name: fieldConfig.name,
      label: fieldConfig.label,
      helperText: fieldConfig.helperText,
      disabled: isFieldDisabled(fieldConfig),
      containerClassName: fieldContainerClass(fieldConfig),
    }

    const resolvedOptionsRaw = typeof fieldConfig.options === 'function'
      ? fieldConfig.options(watchedValues as TValues)
      : fieldConfig.options ?? []


    switch (fieldConfig.type) {
      case 'textarea':
        return (
          <FormTextarea
            key={fieldKey}
            {...sharedProps}
            rows={fieldConfig.rows ?? 4}
            placeholder={fieldConfig.placeholder}
          />
        )
      case 'select':
        return (
          <FormDropdown
            key={fieldKey}
            {...sharedProps}
            options={resolvedOptionsRaw}
            placeholder={fieldConfig.placeholder}
          />
        )
      case 'multiSelect':
        return (
          <FormMultiSelect
            key={fieldKey}
            {...sharedProps}
            options={resolvedOptionsRaw}
            placeholder={fieldConfig.placeholder}
          />
        )

      case 'autocomplete':
        return (
          <FormAutoComplete
            key={fieldKey}
            {...sharedProps}
            options={resolvedOptionsRaw}
            setValue={setValue}
            clearErrors={clearErrors}
            placeholder={fieldConfig.placeholder}
            dropdown={fieldConfig.autocomplete?.dropdown}
            emptyMessage={fieldConfig.autocomplete?.emptyMessage}
            forceSelection={fieldConfig.autocomplete?.forceSelection}
            minLength={fieldConfig.autocomplete?.minLength}
            showEmptyMessage={fieldConfig.autocomplete?.showEmptyMessage}
          />
        )
      case 'permissions':
        return (
          <FormPermissionsMatrix
            key={fieldKey}
            {...sharedProps}
            actions={fieldConfig.permissions?.actions}
          />
        )
      case 'number':
        return (
          <FormNumber
            key={fieldKey}
            {...sharedProps}
            min={fieldConfig.min}
            max={fieldConfig.max}
            step={fieldConfig.step}
            placeholder={fieldConfig.placeholder}
          />
        )
      case 'time':
        return (
          <FormTimePicker
            key={fieldKey}
            {...sharedProps}
            placeholder={fieldConfig.placeholder}
            hourFormat={fieldConfig.time?.hourFormat}
            readOnlyInput={fieldConfig.time?.readOnlyInput}
            showButtonBar={fieldConfig.time?.showButtonBar}
            showIcon={fieldConfig.time?.showIcon}
            stepHour={fieldConfig.time?.stepHour}
            stepMinute={fieldConfig.time?.stepMinute}
            touchUI={fieldConfig.time?.touchUI}
          />
        )
      case 'date':
        return (
          <FormDatePicker
            key={fieldKey}
            {...sharedProps}
            displayMode={datePickerDisplayMode}
            dateFormat={fieldConfig.date?.dateFormat}
            hourFormat={fieldConfig.date?.hourFormat}
            maxDate={fieldConfig.date?.maxDate}
            minDate={fieldConfig.date?.minDateFn ? fieldConfig.date.minDateFn(watchedValues) : fieldConfig.date?.minDate}
            placeholder={fieldConfig.placeholder}
            readOnlyInput={fieldConfig.date?.readOnlyInput}
            selectionMode={fieldConfig.date?.selectionMode}
            showButtonBar={fieldConfig.date?.showButtonBar}
            showIcon={fieldConfig.date?.showIcon ?? true}
            showTime={fieldConfig.date?.showTime}
            touchUI={fieldConfig.date?.touchUI}
          />
        )
      case 'upload':
        return (
          <FormFileUpload
            key={fieldKey}
            {...sharedProps}
            accept={fieldConfig.upload?.accept}
            chooseLabel={fieldConfig.upload?.chooseLabel}
            clearLabel={fieldConfig.upload?.clearLabel}
            emptyMessage={fieldConfig.upload?.emptyMessage}
            folder={fieldConfig.upload?.folder}
            multiple={false}
          />
        )
      case 'localFile':
        return (
          <FormLocalFile
            key={fieldKey}
            {...sharedProps}
            accept={fieldConfig.upload?.accept}
          />
        )
      case 'multiUpload':
        return (
          <FormFileUpload
            key={fieldKey}
            {...sharedProps}
            accept={fieldConfig.upload?.accept}
            chooseLabel={fieldConfig.upload?.chooseLabel ?? 'Add Images (up to 10)'}
            clearLabel={fieldConfig.upload?.clearLabel}
            emptyMessage={fieldConfig.upload?.emptyMessage ?? 'No images uploaded yet.'}
            folder={fieldConfig.upload?.folder}
            multiple={true}
          />
        )
      case 'mediaUpload':
        return (
          <FormMediaInput
            key={fieldKey}
            {...sharedProps}
            folder={fieldConfig.upload?.folder}
            maxFiles={fieldConfig.upload?.maxFiles ?? 10}
          />
        )
      case 'videoUpload':
        return (
          <FormVideoInput
            key={fieldKey}
            {...sharedProps}
            folder={fieldConfig.upload?.folder}
          />
        )
      case 'emergencyContacts':
        return (
          <FormEmergencyContacts
            key={fieldKey}
            {...sharedProps}
            maxItems={fieldConfig.emergencyContacts?.maxItems}
            relationshipOptions={fieldConfig.emergencyContacts?.relationshipOptions}
          />
        )
      case 'attachments':
        return (
          <FormAttachmentLinks
            key={fieldKey}
            {...sharedProps}
            accept={fieldConfig.attachments?.accept}
            maxItems={fieldConfig.attachments?.maxItems}
            documentTypeOptions={fieldConfig.attachments?.documentTypeOptions}
            uploadFolder={fieldConfig.attachments?.uploadFolder}
            documentMetadata={fieldConfig.attachments?.documentMetadata}
          />
        )
      case 'chargeLines':
        return (
          <FormChargeLines
            key={fieldKey}
            {...sharedProps}
            providerOptions={fieldConfig.chargeLines?.providerOptions ?? []}
            codeOptions={fieldConfig.chargeLines?.codeOptions ?? []}
            setValue={setValue}
            clearErrors={clearErrors}
            validationMessages={
              typeof (watchedValues as Record<string, unknown>).validationErrors === 'string'
                ? String((watchedValues as Record<string, unknown>).validationErrors)
                    .split('\n')
                    .map((item) => item.trim())
                    .filter(Boolean)
                : []
            }
          />
        )
      case 'claimLines':
        return (
          <FormClaimLines
            key={fieldKey}
            {...sharedProps}
            providerOptions={fieldConfig.claimLines?.providerOptions ?? []}
            placeOfServiceOptions={fieldConfig.claimLines?.placeOfServiceOptions ?? []}
            setValue={setValue}
            clearErrors={clearErrors}
          />
        )
      case 'password':
        return <FormPassword key={fieldKey} {...sharedProps} placeholder={fieldConfig.placeholder} />
      case 'checkbox':
        return <FormCheckbox key={fieldKey} {...sharedProps} />
      case 'switch':
        return (
          <FormSwitch
            key={fieldKey}
            {...sharedProps}
            checkedLabel={fieldConfig.switch?.checkedLabel}
            uncheckedLabel={fieldConfig.switch?.uncheckedLabel}
          />
        )
      case 'chips':
        return (
          <FormChips
            key={fieldKey}
            {...sharedProps}
            options={resolvedOptionsRaw.map((o) => ({ label: o.label, value: String(o.value) }))}
            placeholder={fieldConfig.placeholder}
          />
        )
      case 'toneSelector':
        return (
          <FormToneSelector
            key={fieldKey}
            {...sharedProps}
            placeholder={fieldConfig.placeholder}
          />
        )
      case 'platformSelector':
        return (
          <FormPlatformSelector
            key={fieldKey}
            {...sharedProps}
            placeholder={fieldConfig.placeholder}
          />
        )
      case 'tags':
        return (
          <FormTagInput
            key={fieldKey}
            {...sharedProps}
            placeholder={fieldConfig.placeholder}
            options={resolvedOptionsRaw.map((o) => ({ label: o.label, value: String(o.value) }))}
            maxItems={fieldConfig.tags?.maxItems}
            maxLength={fieldConfig.tags?.maxLength}
            showCharacterCount={fieldConfig.tags?.showCharacterCount}
            commitOnBlur={fieldConfig.tags?.commitOnBlur}
            removeButtonPosition={fieldConfig.tags?.removeButtonPosition}
            valueMode={fieldConfig.tags?.valueMode}
            singleValueEditor={fieldConfig.tags?.singleValueEditor}
            rows={fieldConfig.tags?.rows}
            onDeleteOption={
              fieldConfig.tags?.onDeleteOption
                ? (value) => fieldConfig.tags?.onDeleteOption?.(value, watchedValues as TValues)
                : undefined
            }
          />

        )
      case 'editableStringList':
        return (
          <FormEditableStringList
            key={fieldKey}
            {...sharedProps}
            variant={fieldConfig.editableStringList?.variant}
            itemLabel={fieldConfig.editableStringList?.itemLabel}
            addLabel={fieldConfig.editableStringList?.addLabel}
            emptyMessage={fieldConfig.editableStringList?.emptyMessage}
            maxItems={fieldConfig.editableStringList?.maxItems}
            maxLength={fieldConfig.editableStringList?.maxLength}
            rows={fieldConfig.editableStringList?.rows}
          />
        )
      case 'email':


      case 'text':
        return (
          <FormInputText
            key={fieldKey}
            {...sharedProps}
            placeholder={fieldConfig.placeholder}
            type={fieldConfig.type === 'email' ? 'email' : 'text'}
          />
        )
      default:
        return (
          <FormInputText
            key={fieldKey}
            {...sharedProps}
            type={fieldConfig.type === 'email' ? 'email' : 'text'}
            placeholder={fieldConfig.placeholder}
          />
        )
    }
  }

  const groupedVisibleFields = hasFormSections
    ? visibleSectionFields.reduce<Array<{ key: string; section?: string; fields: CrudFormField<TValues>[] }>>(
      (groups, fieldConfig) => {
        const section = fieldConfig.section?.trim() || undefined
        const lastGroup = groups.at(-1)

        if (!lastGroup || lastGroup.section !== section) {
          groups.push({
            key: section ? `${section}-${groups.length}` : `group-${groups.length}`,
            section,
            fields: [fieldConfig],
          })

          return groups
        }

        lastGroup.fields.push(fieldConfig)
        return groups
      },
      [],
    )
    : []

  return (
    <form className="flex max-h-[calc(100vh-10rem)] flex-col" onSubmit={handleSubmit(onSubmit, onInvalid)} noValidate>
      {hasFormSections
        ? config.fields
          .filter((fieldConfig) => fieldConfig.type === 'hidden' || shouldHideField(fieldConfig))
          .map(renderHiddenField)
        : null}

      <div className="flex-1 overflow-y-auto px-1 pb-4 pt-1">
        {submitCount > 0 && Object.keys(errors).length > 0 && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 border border-red-200">
            <p className="text-sm font-bold text-red-700 mb-1">Please fix the following errors:</p>
            <ul className="list-disc list-inside text-xs text-red-600">
              {Object.entries(errors).map(([key, err]: [string, any]) => (
                <li key={key}>
                  <span className="font-semibold">{key}:</span> {err?.message || (typeof err === 'object' ? 'Invalid value' : String(err))}
                  {err && typeof err === 'object' && !err.message && Object.keys(err).length > 0 && (
                    <ul className="ml-4 list-circle">
                      {Object.entries(err).map(([subKey, subErr]: [string, any]) => (
                        <li key={subKey}><span className="font-semibold">{subKey}:</span> {subErr?.message || 'Invalid'}</li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {hasFormSections ? (
          <div className="space-y-5">
            {groupedVisibleFields.map((group) =>
              group.section ? (
                <section
                  key={group.key}
                  className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)]/55 p-4"
                >
                  <h3 className="text-lg font-semibold text-[var(--color-text-strong)]">{group.section}</h3>
                  <div className={formGridClass(config.columns)}>{group.fields.map(renderField)}</div>
                </section>
              ) : (
                <div key={group.key} className={formGridClass(config.columns)}>
                  {group.fields.map(renderField)}
                </div>
              ),
            )}
          </div>
        ) : (
          <div className={formGridClass(config.columns)}>{config.fields.map(renderField)}</div>
        )}
      </div>

      <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-[var(--color-border)] px-1 pt-4 sm:flex-row sm:justify-end">
        <Button
          type="button"
          label="Cancel"
          severity="secondary"
          outlined
          className="min-w-28"
          onClick={onCancel}
        />
        <Button
          type="submit"
          label={submitLabel}
          icon={mode === 'edit' ? <Check className="h-4 w-4" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
          className="min-w-32"
          loading={isSubmitting || isFormSubmitting}
        />
      </div>
    </form>
  )
}

function InfoScenarioCard({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const el = document.createElement('textarea')
      el.value = text
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-[var(--color-text-strong)]">{label}</span>
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="flex items-center gap-1 shrink-0 h-6 px-2 text-[11px] font-semibold rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-strong)] hover:bg-[var(--color-surface-muted)] transition-colors"
        >
          {copied
            ? <Check className="h-3 w-3 text-green-500" />
            : <Copy className="h-3 w-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <p className="text-[11px] leading-5 text-[var(--color-text-muted)] bg-[var(--color-surface-muted)] rounded px-2 py-1.5">
        {text}
      </p>
    </div>
  )
}
